# ProjectWhiteSpider

Next.js 15 (App Router) + React 19 + Supabase + React Flow. Tailwind v4, zustand, BullMQ/Redis
for queues, sonner for toasts. `npm run dev` / `npm run build`.

## Target architecture

Four layers. The long-term shape is: a **Conversation Agent** plans once → compiles a frozen
**workflow** → a **Workflow Engine** executes it across many rows → a **Tool Factory** expands
capabilities over time. The permanent assets are **tools** (reusable building blocks) and
**workflows** (reusable combinations of them).

Milestone 1 (done) built only the bottom of that stack: the Supabase tool registry and the Tool
Host, driven manually through the existing canvas. There is no agent, no factory, and no
job/worker system yet. See [Plan.md](Plan.md) for what is still deferred — DAG traversal,
pairedItem lineage, workflow freeze/preview, parallel workers, loop nodes.

## The Tool Host boundary — the one rule

**Nothing above `executeTool()` knows how a tool is implemented.**

```
engine.ts (case 'tool')
     │
     ▼
executeTool()                    ← lib/tools/client.ts  ** THE SWAP POINT **
     │
     ├─ TOOL_HOST_URL set?  ──► POST {TOOL_HOST_URL}/execute   (standalone host)
     └─ unset (default)     ──► in-process runTool()           (today)
                                     │
                                     ▼
                            tool-host/executor.ts
                            registry lookup → import → invoke → envelope
```

`lib/tools/client.ts` is the only file that changes when tools move off-box. Do not reach past
it — the engine, the UI, and the API routes must never import a tool module directly.

`app/api/tool-host/execute/route.ts` is the same executor over HTTP. The engine does **not**
call it (a self-request would be pointless); it exists to make the contract curl-testable and is
exactly the surface a standalone host replaces.

### Wire contract — identical in both directions, forever

```jsonc
// POST /api/tool-host/execute
{ "tool": "fake_company_lookup", "arguments": { "domain": "acme.com" } }

// 200
{ "success": true,  "result": { "company_name": "Acme Inc", "employee_count": 240 } }
// 200 — tool-level failure is NOT a transport failure
{ "success": false, "error": { "message": "domain is required", "code": "BAD_INPUT" } }
```

Only malformed requests are 4xx. A tool that fails still returns 200 with `success: false`.

## Adding a tool — exactly three steps

1. **Write the file** — `tool-host/tools/<impl>.ts`, exporting
   `execute(args, ctx): Promise<any>`. Return the result **directly**; `throw` (ideally
   `ToolFailure(message, code)`) on failure. Never build the `{success, error}` envelope
   yourself — `executor.ts` owns that, which is what keeps generated tools simple.
2. **Add one line** to `tool-host/registry.ts`: `<impl>: () => import('./tools/<impl>')`.
3. **Insert one row** in the Supabase `tools` table (`implementation` = the registry key). Its
   `input_schema` is what renders the config form — there is no per-tool React code.

Refresh the browser. The tool appears in the Add Node sidebar, is configurable, and runs. **If
adding a tool ever requires touching anything else, something has regressed.**

Two things the registry row controls that are easy to miss:

- **`timeout_ms`** overrides the executor's 30s default for that tool alone. A tool that makes
  several network calls needs it; raising the global default instead would let every future tool
  hang for minutes before anyone noticed. Null means use the default.
- **`"format": "textarea"`** on a string property renders a multi-line box instead of an input.
  It is the only presentation hint the generated form takes, and it exists so a tool that wants a
  paragraph does not need React code to ask for one.

Tools that call out to a provider read their credentials from the environment
(`SCRAPING_DOG_API_KEY`, `ANTHROPIC_API_KEY`) rather than taking them as arguments — a key in an
argument would be templated, saved into the workflow graph, and snapshotted into every execution.

## Native nodes vs tools — when to break the rule above

A **tool** is a pure function of its arguments. It gets no execution context and no
database privileges, which is exactly what makes it portable enough to move to a
standalone host later.

A **native node** is the exception, and needs all four registration points (a
`node_types` row, the `nodeTypes` map, `nodeConfigRegistry`, and a `case` in
`engine.ts`). Only reach for one when the node genuinely needs something a tool must not
have — the execution context, or elevated writes. `map_column` is the reference example:
it needs the execution id and the lead id, and it writes through SECURITY DEFINER RPCs.
If a new capability does not need those, it is a tool. Adding native nodes casually is
the regression this architecture exists to prevent.

## Staged writes — the Column Mapper

`map_column` never writes a value. It records a **proposal** (`workflow_write_proposals`)
holding the target container, column, `new_value`, and the `previous_value` that is there
today. That indirection is what makes the agent flow work: test across N rows → proposals
exist in the DB → the Executions tab renders a real before/after diff → the user approves
→ `apply_write_proposals()` commits. `previous_value` is what makes `revert_write_proposals()`
possible.

Test runs stage only. Non-test runs stage and then apply once, after the flow succeeds, so
a mid-flow failure cannot half-apply a row.

Column routing: an **existing** column keeps whatever container its `columns.column_type`
says (`schema` → top level, `extra_field` → `schema.extra_fields`, and so on). A **new**
column is created as an `internal_enrichment`, and its `columns` row is only inserted at
apply time — unapproved runs must not mutate list metadata. `email` and `domain` are
refused outright; they are the identity keys used to match leads across imports.

Watch the singular/plural asymmetry: the `column_type` is `extra_field` but the schema key
is `extra_fields`. `schema_container_for()` in SQL is the single place that mapping lives.

## Templating

Tool arguments go through `resolveTemplates()` (`lib/tools/template.ts`) before execution.
`{{ item.email }}`, `{{ item.extra_fields["company"] }}` — **field paths only**. No eval, no
expression grammar, deliberately. A string that is exactly one template preserves the value's
type (numbers stay numbers); a mixed string interpolates. An unresolvable path throws
`TemplateError` naming the path and the node.

## Saved workflows

A workflow is one `workflows` row scoped to a view, whose `graph` jsonb holds the React Flow
`{ nodes, edges }` verbatim. That is the shape every layer already speaks — `executeFlow`, the
canvas's `initialNodes`/`initialEdges`, the agent's compiler, and `workflow_executions.snapshot` —
so nothing assembles or disassembles a graph on the way in or out.

`name` is optional everywhere it is accepted. `POST` generates `<list>-<view>-workflow-<n>` when it
is blank, and `PATCH` treats a blank name as "no change" rather than as an erase — so the canvas's
name field can be cleared without ever leaving a workflow nameless. That is what lets **New** open
a canvas immediately instead of gating on a naming step.

Saving overwrites and the `workflows_touch` trigger bumps `version`, but **only when the graph
actually changed**, so a rename does not invent a version with no new definition behind it. Never
set `version` from the client. Executions record `workflow_id` and the `workflow_version` read at
run time, alongside the full `snapshot` of what ran — three independent records of the same fact,
which is what makes run history survive later edits.

`workflow_nodes`, `workflow_edges`, and `node_executions` are **vestigial**: empty, referenced
nowhere, and keyed to `view_id` from an earlier one-workflow-per-view design. Do not build on them.

The canvas is mounted with `key={workflow.id}` in `WorkflowsPanel`. `useNodesState` treats its
argument as *initial* state and never re-syncs, so without the key, switching workflows leaves the
previous graph on screen.

## Standing gotchas

- **`next.config.ts` sets `typescript.ignoreBuildErrors: true` and `eslint.ignoreDuringBuilds:
  true`.** A green `npm run build` does **not** mean the types check. Run `npx tsc --noEmit`
  yourself. This is how a route importing a deleted export survived until runtime.
- **The DB schema lives in the hosted Supabase project, not in this repo.** Only
  `supabase/migrations/` is checked in, and it is not applied automatically — the user runs it in
  the SQL editor. Assume tables have more columns than any migration file shows.
- **`@/*` maps to the repo root**, not `src/`. `@/tool-host/executor` and `@/lib/supabase` both
  work with no tsconfig change.
- **`tool-host/registry.ts` must stay a static map.** A computed `import(\`./tools/${x}\`)`
  cannot be statically analyzed and breaks under the Next.js bundler.
- **Supabase is accessed with the anon key** (`lib/supabase.ts`), so any new table needs an RLS
  select policy or reads silently come back empty. `SUPABASE_SERVICE_ROLE_KEY` is referenced by
  `app/api/leads/[id]/single/route.ts` but is **not** in `.env`, so that route silently falls back
  to anon. Any write path must therefore go through a SECURITY DEFINER RPC.
- **`internal_enrichment` was never actually written by `enrich_single_lead`** — the RPC computes
  `v_internal_enrichment` and then only merges `extra_fields` and `external_enrichment` back into
  the schema. Values routed there by that function are dropped. `apply_write_proposals` handles it
  correctly; the older RPC is still wrong.
- **`app/(dashboard)/leads/[listId]/splits/download/route.ts` reads `internal_enrichments` /
  `external_enrichments` (plural).** The real `column_type` values are singular, so enrichment
  columns silently export as blank there. Not fixed, since nothing in this work depends on it.
- The engine walks straight-line graphs recursively and re-executes shared branches; `if` nodes
  split items across `true`/`false` handles. DAG traversal is deferred, not forgotten.
