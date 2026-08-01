import { supabase } from '@/lib/supabase';
import { collectTemplatePaths, TemplateError } from '@/lib/tools/template';

/**
 * The Capability Analyzer.
 *
 * The conversation agent proposes; this module disposes. Nothing an LLM says about what
 * the registry can do is taken on trust — `analyzeGraph` re-derives it from the `tools`
 * rows and the list's real columns, and a graph that does not pass never reaches the
 * engine.
 *
 * Deliberately has no LLM in it. Every check here is one the model could get wrong and
 * a user would only find out about mid-run, against real rows.
 */

export type ToolCapability = {
    name: string;
    display_name: string;
    description: string | null;
    input_schema: any;
    output_schema: any;
};

export type ColumnCapability = {
    column_name: string;
    column_raw_name: string | null;
    column_type: string;
};

export type Catalog = {
    tools: ToolCapability[];
    columns: ColumnCapability[];
    listId: number | null;
};

/** A proposed node, as the agent describes it — not yet React Flow shaped. */
export type GraphNodeSpec =
    | { id: string; type: 'test' }
    | { id: string; type: 'tool'; toolName: string; arguments: Record<string, any>; label?: string }
    | {
          id: string;
          type: 'map_column';
          mode: 'existing' | 'new';
          column: string;
          value: any;
          skipIfPopulated?: boolean;
          label?: string;
      };

export type GraphSpec = {
    nodes: GraphNodeSpec[];
    edges: { source: string; target: string }[];
};

export type Gap = { node?: string; problem: string };
export type Analysis = { ok: true } | { ok: false; gaps: Gap[] };

/** Identity keys used to match leads across imports; propose_lead_write refuses these too. */
const IDENTITY_COLUMNS = new Set(['email', 'domain']);

/**
 * Everything the agent is allowed to know about: active tools, and the columns that
 * actually exist on this view's list.
 */
export async function loadCapabilities(viewId: number): Promise<Catalog> {
    const { data: tools, error: toolsError } = await supabase
        .from('tools')
        .select('name, display_name, description, input_schema, output_schema')
        .eq('status', 'active')
        .order('name');

    if (toolsError) throw new Error(`Could not load tools: ${toolsError.message}`);

    const { data: view } = await supabase
        .from('list_views')
        .select('lead_list_id')
        .eq('id', viewId)
        .single();

    const listId = view?.lead_list_id ?? null;
    let columns: ColumnCapability[] = [];

    if (listId) {
        const { data, error } = await supabase
            .from('columns')
            .select('column_name, column_raw_name, column_type')
            .eq('list_id', listId)
            .order('column_order');

        if (error) throw new Error(`Could not load columns: ${error.message}`);
        columns = data ?? [];
    }

    return { tools: tools ?? [], columns, listId };
}

/**
 * Can this graph actually run, against this list, with these tools?
 *
 * Returns every problem rather than the first, so the agent can fix a graph in one pass
 * instead of discovering issues one round trip at a time.
 */
export function analyzeGraph(graph: GraphSpec, catalog: Catalog): Analysis {
    const gaps: Gap[] = [];
    const nodes = graph.nodes ?? [];
    const edges = graph.edges ?? [];

    if (nodes.length === 0) return { ok: false, gaps: [{ problem: 'The workflow has no nodes.' }] };

    const byId = new Map(nodes.map((n) => [n.id, n]));
    const toolsByName = new Map(catalog.tools.map((t) => [t.name, t]));
    const columnNames = new Set(
        catalog.columns.flatMap((c) => [c.column_name, c.column_raw_name].filter(Boolean) as string[])
    );

    // --- shape: exactly one start, reachable, no diamonds -------------------------------
    const starts = nodes.filter((n) => n.type === 'test');
    if (starts.length !== 1) {
        gaps.push({
            problem: `A workflow needs exactly one start node, found ${starts.length}.`,
        });
    }

    for (const edge of edges) {
        if (!byId.has(edge.source)) gaps.push({ problem: `Edge from unknown node '${edge.source}'.` });
        if (!byId.has(edge.target)) gaps.push({ problem: `Edge to unknown node '${edge.target}'.` });
    }

    // The engine walks the graph recursively and re-executes shared branches, so a node
    // reachable two ways runs twice and stages duplicate proposals. Until DAG traversal
    // lands, a merge point is a compile error rather than a silent double write.
    const indegree = new Map<string, number>();
    for (const edge of edges) indegree.set(edge.target, (indegree.get(edge.target) ?? 0) + 1);
    for (const [id, count] of indegree) {
        if (count > 1) {
            gaps.push({
                node: id,
                problem:
                    'Two branches merge into this node. The engine would run it once per branch and write duplicates, so merges are not supported yet.',
            });
        }
    }

    if (starts.length === 1) {
        const reachable = new Set<string>();
        const queue = [starts[0].id];
        while (queue.length) {
            const id = queue.shift()!;
            if (reachable.has(id)) continue;
            reachable.add(id);
            for (const e of edges) if (e.source === id) queue.push(e.target);
        }

        for (const node of nodes) {
            if (!reachable.has(node.id)) {
                gaps.push({ node: node.id, problem: 'This node is not connected to the start node.' });
            }
        }
    }

    // --- per-node checks ---------------------------------------------------------------
    // What a node can read: the list's columns, plus whatever every upstream node emits.
    const upstreamFields = fieldsAvailablePerNode(nodes, edges, toolsByName, columnNames);

    for (const node of nodes) {
        if (node.type === 'tool') {
            const tool = toolsByName.get(node.toolName);

            if (!tool) {
                gaps.push({
                    node: node.id,
                    problem: `No active tool named '${node.toolName}' is in the registry.`,
                });
                continue;
            }

            const required: string[] = tool.input_schema?.required ?? [];
            for (const key of required) {
                const value = node.arguments?.[key];
                if (value === undefined || value === null || value === '') {
                    gaps.push({
                        node: node.id,
                        problem: `'${tool.display_name}' requires the argument '${key}', which is not set.`,
                    });
                }
            }

            checkTemplates(node.arguments, node.id, upstreamFields.get(node.id), gaps);
        }

        if (node.type === 'map_column') {
            if (!node.column) {
                gaps.push({ node: node.id, problem: 'No column selected to write to.' });
            } else {
                const existing = catalog.columns.find(
                    (c) => c.column_name === node.column || c.column_raw_name === node.column
                );

                // Mirrors the refusal inside propose_lead_write, so the user hears it while
                // reviewing the plan instead of as a failed row mid-run.
                if (existing?.column_type === 'schema' && IDENTITY_COLUMNS.has(existing.column_name)) {
                    gaps.push({
                        node: node.id,
                        problem: `'${existing.column_name}' is an identity field used to match leads across imports and cannot be written to.`,
                    });
                }

                if (node.mode === 'existing' && !existing) {
                    gaps.push({
                        node: node.id,
                        problem: `Column '${node.column}' does not exist on this list. Use mode 'new' to create it.`,
                    });
                }
            }

            checkTemplates(node.value, node.id, upstreamFields.get(node.id), gaps);
        }
    }

    return gaps.length === 0 ? { ok: true } : { ok: false, gaps };
}

/**
 * For each node, the set of `item.*` fields its input could carry.
 *
 * A tool node replaces the item with its own output, so downstream sees the tool's
 * output_schema keys and nothing else. That mirrors `context.data = outputs` in the
 * engine. map_column passes the item through unchanged.
 */
function fieldsAvailablePerNode(
    nodes: GraphNodeSpec[],
    edges: { source: string; target: string }[],
    toolsByName: Map<string, ToolCapability>,
    columnNames: Set<string>
): Map<string, Set<string> | null> {
    const emits = new Map<string, Set<string> | null>();
    const byId = new Map(nodes.map((n) => [n.id, n]));

    const emitsOf = (id: string, seen = new Set<string>()): Set<string> | null => {
        if (emits.has(id)) return emits.get(id)!;
        if (seen.has(id)) return null;
        seen.add(id);

        const node = byId.get(id);
        let result: Set<string> | null;

        if (!node || node.type === 'test') {
            result = columnNames;
        } else if (node.type === 'tool') {
            const schema = toolsByName.get(node.toolName)?.output_schema;
            const props = schema?.properties;
            // No declared output schema means we cannot say what it emits — treat as
            // unknown and skip field checking downstream rather than reject valid work.
            result = props ? new Set(Object.keys(props)) : null;
        } else {
            // map_column returns { ...input, _mapped }, so the item survives intact.
            const parent = edges.find((e) => e.target === id);
            const inherited = parent ? emitsOf(parent.source, seen) : columnNames;
            result = inherited ? new Set([...inherited, '_mapped']) : null;
        }

        emits.set(id, result);
        return result;
    };

    const available = new Map<string, Set<string> | null>();
    for (const node of nodes) {
        const parent = edges.find((e) => e.target === node.id);
        available.set(node.id, parent ? emitsOf(parent.source) : columnNames);
    }

    return available;
}

/** Every `{{ item.x }}` in a value must name a field the node will actually receive. */
function checkTemplates(
    value: any,
    nodeId: string,
    available: Set<string> | null | undefined,
    gaps: Gap[]
) {
    let paths;

    try {
        paths = collectTemplatePaths(value, `node '${nodeId}'`);
    } catch (err) {
        gaps.push({
            node: nodeId,
            problem: err instanceof TemplateError ? err.message : String(err),
        });
        return;
    }

    for (const { expr, segments } of paths) {
        if (segments[0] !== 'item') {
            if (segments[0] === '$now') continue;
            gaps.push({
                node: nodeId,
                problem: `'{{ ${expr} }}' reads '${segments[0]}', but only 'item' and '$now' are available.`,
            });
            continue;
        }

        // Unknown upstream shape (a tool with no output_schema) — nothing to check against.
        if (!available) continue;

        const field = segments[1];
        if (!field) {
            gaps.push({ node: nodeId, problem: `'{{ ${expr} }}' does not name a field.` });
            continue;
        }

        // The nested containers are real schema keys, and what is inside them varies per
        // row, so a path into one cannot be checked statically.
        if (['extra_fields', 'internal_enrichment', 'external_enrichment'].includes(field)) continue;

        if (!available.has(field)) {
            gaps.push({
                node: nodeId,
                problem: `'{{ ${expr} }}' reads '${field}', which the previous step does not produce.`,
            });
        }
    }
}
