-- Milestone 2b — saved workflows, many per view
--
-- Until now nothing persisted a workflow at all. The canvas held nodes and edges in React
-- state and the only durable record was workflow_executions.snapshot, written per run, so
-- closing the tab lost the graph.
--
-- A workflow is one row whose `graph` jsonb holds the React Flow {nodes, edges} exactly as
-- the canvas and the engine already pass it around. It is deliberately NOT normalized into
-- the workflow_nodes / workflow_edges tables: those are empty, referenced nowhere, and key
-- to view_id rather than to a workflow, which is the one-workflow-per-view assumption this
-- migration removes. Storing the graph whole means no assembly or disassembly on either
-- side of every read and write.
--
-- Saving overwrites and bumps `version`. Run history stays honest because every execution
-- keeps a full snapshot of what ran plus the version number it ran at.
--
-- Run this in the Supabase SQL editor, after 0004_batch_executions.sql.
--
-- Keep quotes and semicolons out of comments in this file. The Supabase SQL editor tracks
-- quote state while splitting statements and does not exclude comments, so a single
-- unpaired apostrophe swallows everything after it.

create table if not exists public.workflows (
  id          bigint generated always as identity primary key,
  view_id     bigint not null references public.list_views(id) on delete cascade,
  name        text not null,
  description text,
  graph       jsonb not null default '{"nodes":[],"edges":[]}'::jsonb,
  version     integer not null default 1,
  status      text not null default 'draft',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint workflows_status_check check (status in ('draft', 'active', 'archived'))
);

create index if not exists workflows_view_idx on public.workflows (view_id);


-- Which workflow produced a run. Nullable: executions predating this migration have none,
-- and an ad-hoc canvas run still legitimately belongs to no saved workflow. on delete set
-- null so deleting a workflow never destroys its run history.
--
-- workflow_version already existed on this table and was never populated -- it is the right
-- home for the version that ran, so no new column for it.
alter table public.workflow_executions
  add column if not exists workflow_id bigint references public.workflows(id) on delete set null;

create index if not exists workflow_executions_workflow_idx
  on public.workflow_executions (workflow_id);


-- ---------------------------------------------------------------------------
-- Version bumping lives here, not in the client.
--
-- A caller that forgets to increment silently corrupts the audit trail, and the
-- executions pointing at that version then describe a graph that never existed. Comparing
-- the graph rather than bumping unconditionally means a rename or a status change does not
-- invent a version that has no new definition behind it.
-- ---------------------------------------------------------------------------
create or replace function public.touch_workflow()
returns trigger language plpgsql as $$
BEGIN
  IF NEW.graph IS DISTINCT FROM OLD.graph THEN
    NEW.version := OLD.version + 1;
  END IF;

  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

drop trigger if exists workflows_touch on public.workflows;
create trigger workflows_touch
  before update on public.workflows
  for each row execute function public.touch_workflow();


-- ---------------------------------------------------------------------------
-- RLS
--
-- Read and write for anon, which is a deliberate departure from the rule that write paths
-- go through SECURITY DEFINER RPCs. That rule protects list_leads_membership, where a
-- forged write corrupts real lead data. A workflow is app metadata in the same class as
-- workflow_executions, which the run stream route already inserts into directly with the
-- anon key.
--
-- This is the correct policy for an app with no auth. The moment sign-in exists, workflows
-- and workflow_executions both need scoping to the owning user -- neither is safe as-is
-- once more than one tenant shares the database.
-- ---------------------------------------------------------------------------
alter table public.workflows enable row level security;

drop policy if exists "workflows are readable" on public.workflows;
create policy "workflows are readable"
  on public.workflows for select
  to anon, authenticated
  using (true);

drop policy if exists "workflows are writable" on public.workflows;
create policy "workflows are writable"
  on public.workflows for all
  to anon, authenticated
  using (true)
  with check (true);
