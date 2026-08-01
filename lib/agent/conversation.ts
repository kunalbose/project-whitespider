import Anthropic from '@anthropic-ai/sdk';
import { betaTool } from '@anthropic-ai/sdk/helpers/beta/json-schema';
import { loadCapabilities, analyzeGraph, type Catalog, type GraphSpec } from '@/lib/agent/capability';
import { compile, type CompiledGraph } from '@/lib/agent/compile';

/**
 * The Conversation Agent.
 *
 * Talks to the user, and reaches the tool registry only through the Capability Analyzer —
 * `list_capabilities` and `check_workflow` are both thin wrappers over capability.ts. The
 * agent cannot assert that a tool exists; it can only ask.
 *
 * It proposes a workflow and stops. Running it is the user's click, and applying the
 * writes is a second click on the proposals drawer. Two gates, neither of them here.
 */

const MODEL = 'claude-opus-5';

const SYSTEM = `You help a user turn a plain-language request into a workflow that runs over the rows of a lead list.

## How the system works

A workflow is a graph. It starts at a single "test" node — the rows enter there — and each
following node receives the items the previous node produced. There is one node per step.

Two kinds of step exist:

- **tool** — a pure function of its arguments, from the registry. It REPLACES the item with its
  own output, so anything downstream sees the tool's output fields and nothing else.
- **map_column** — the only way to write anything back to the list. It passes the item through
  unchanged, so steps after it still see what came in.

## Rules you cannot work around

- **Only tools in the registry exist.** Never invent one, never assume a capability. Call
  \`list_capabilities\` first, every time.
- **Arguments use field paths only**: \`{{ item.email }}\`, \`{{ item.extra_fields["company"] }}\`.
  There is no expression language — no function calls, no arithmetic, no conditionals inside a
  template. If a value needs computing, a tool has to compute it.
- **\`map_column\` is the only write.** A tool cannot save anything.
- **\`email\` and \`domain\` cannot be written to.** They are identity keys used to match leads
  across imports.
- **No merges.** Two branches cannot flow into the same node. Keep the graph a straight line or a
  tree.
- Writing to a column that does not exist yet requires \`mode: "new"\`; it will be created as an
  internal enrichment when the user approves.

## How to work

1. Call \`list_capabilities\` to see the tools and the list's real columns.
2. Ask the user whatever you genuinely need in order to build the right thing — which column to
   write to, what to do about rows that already have a value. Ask about things that change the
   workflow, not things you can reasonably decide.
3. Draft the graph and call \`check_workflow\`. If it returns gaps, fix them and check again.
4. Call \`propose_workflow\` once it passes.

**If the registry cannot do part of the job, say so plainly and name what is missing** — for
example, "nothing in the registry looks up a company's funding round from a domain." Do not
substitute a tool that does something adjacent and hope it is close enough, and do not quietly drop
the part you cannot do. Offer to build the rest without that step, and let the user decide.

After proposing, tell the user in one or two sentences what the workflow will write and to which
column. They will run it against 10 rows and review every change before anything is saved, so do
not ask for confirmation you do not need — propose, and let them run it.`;

/** Loose on purpose: the analyzer is what validates a graph, not the schema. */
const GRAPH_SCHEMA = {
    type: 'object',
    properties: {
        nodes: {
            type: 'array',
            description: 'Every step, including exactly one node of type "test" as the start.',
            items: {
                type: 'object',
                properties: {
                    id: { type: 'string', description: 'Short unique id, e.g. "start", "lookup".' },
                    type: { type: 'string', enum: ['test', 'tool', 'map_column'] },
                    label: { type: 'string', description: 'Optional display name.' },
                    toolName: { type: 'string', description: 'tool nodes: the registry `name`.' },
                    arguments: {
                        type: 'object',
                        description: 'tool nodes: argument values, templates allowed.',
                        additionalProperties: true,
                    },
                    mode: {
                        type: 'string',
                        enum: ['existing', 'new'],
                        description: 'map_column nodes: whether the column already exists.',
                    },
                    column: { type: 'string', description: 'map_column nodes: the column to write.' },
                    value: { type: 'string', description: 'map_column nodes: the value, templates allowed.' },
                    skipIfPopulated: {
                        type: 'boolean',
                        description: 'map_column nodes: leave rows that already have a value alone.',
                    },
                },
                required: ['id', 'type'],
                additionalProperties: false,
            },
        },
        edges: {
            type: 'array',
            items: {
                type: 'object',
                properties: { source: { type: 'string' }, target: { type: 'string' } },
                required: ['source', 'target'],
                additionalProperties: false,
            },
        },
    },
    required: ['nodes', 'edges'],
    additionalProperties: false,
} as const;

export type AgentEvent =
    | { type: 'text'; text: string }
    | { type: 'tool'; name: string }
    | { type: 'workflow'; graph: CompiledGraph; spec: GraphSpec }
    | { type: 'done' }
    | { error: string };

export type ChatMessage = { role: 'user' | 'assistant'; content: string };

/**
 * Runs one turn, emitting events as they happen. `emit` is called from inside the agent
 * loop, so the caller can stream without waiting for the turn to finish.
 */
export async function runAgentTurn(
    viewId: number,
    messages: ChatMessage[],
    emit: (event: AgentEvent) => void
): Promise<void> {
    if (!process.env.ANTHROPIC_API_KEY) {
        throw new Error('ANTHROPIC_API_KEY is not set');
    }

    const client = new Anthropic();
    const catalog: Catalog = await loadCapabilities(viewId);

    const listCapabilities = betaTool({
        name: 'list_capabilities',
        description:
            'The tools in the registry and the columns on this list. Call before designing anything — this is the only source of truth about what exists.',
        inputSchema: { type: 'object', properties: {}, additionalProperties: false },
        run: async () => {
            emit({ type: 'tool', name: 'Reading the tool registry' });
            return JSON.stringify({
                tools: catalog.tools.map((t) => ({
                    name: t.name,
                    display_name: t.display_name,
                    description: t.description,
                    input_schema: t.input_schema,
                    output_schema: t.output_schema,
                })),
                columns: catalog.columns.map((c) => ({
                    name: c.column_name,
                    label: c.column_raw_name,
                    container: c.column_type,
                })),
            });
        },
    });

    const checkWorkflow = betaTool({
        name: 'check_workflow',
        description:
            'Check a draft graph against the registry and the list. Returns every problem at once so you can fix them in one pass. Use this before proposing.',
        inputSchema: GRAPH_SCHEMA,
        run: async (input) => {
            emit({ type: 'tool', name: 'Checking the workflow' });
            const analysis = analyzeGraph(input as unknown as GraphSpec, catalog);
            return analysis.ok
                ? JSON.stringify({ ok: true })
                : JSON.stringify({ ok: false, gaps: analysis.gaps });
        },
    });

    const proposeWorkflow = betaTool({
        name: 'propose_workflow',
        description:
            'Show the user a finished workflow. Rejected unless it passes the same checks as check_workflow, so run that first.',
        inputSchema: GRAPH_SCHEMA,
        run: async (input) => {
            const spec = input as unknown as GraphSpec;
            const analysis = analyzeGraph(spec, catalog);

            if (!analysis.ok) {
                return JSON.stringify({
                    ok: false,
                    error: 'This workflow does not pass validation, so it was not shown to the user.',
                    gaps: analysis.gaps,
                });
            }

            emit({ type: 'tool', name: 'Building the workflow' });
            emit({ type: 'workflow', graph: compile(spec, catalog), spec });

            return JSON.stringify({
                ok: true,
                note: 'Shown to the user, who can now run it against 10 rows. Summarize what it writes.',
            });
        },
    });

    const runner = client.beta.messages.toolRunner({
        model: MODEL,
        // Thinking and text share this budget on Opus 5, so it needs headroom.
        max_tokens: 32000,
        thinking: { type: 'adaptive' },
        system: SYSTEM,
        tools: [listCapabilities, checkWorkflow, proposeWorkflow],
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        stream: true,
    });

    for await (const stream of runner) {
        for await (const event of stream) {
            if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
                emit({ type: 'text', text: event.delta.text });
            }
        }
    }

    emit({ type: 'done' });
}
