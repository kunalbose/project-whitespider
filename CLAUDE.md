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

## Templating

Tool arguments go through `resolveTemplates()` (`lib/tools/template.ts`) before execution.
`{{ item.email }}`, `{{ item.extra_fields["company"] }}` — **field paths only**. No eval, no
expression grammar, deliberately. A string that is exactly one template preserves the value's
type (numbers stay numbers); a mixed string interpolates. An unresolvable path throws
`TemplateError` naming the path and the node.

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
  select policy or reads silently come back empty.
- The engine walks straight-line graphs recursively and re-executes shared branches; `if` nodes
  split items across `true`/`false` handles. DAG traversal is deferred, not forgotten.
