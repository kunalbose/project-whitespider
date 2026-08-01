-- Milestone 1b — Column Mapper: staged write proposals
--
-- A mapper node never writes to list_leads_membership.schema directly. It records a
-- PROPOSAL: the target container, the column, the value, and the value that is there
-- today. That single indirection is what makes the agent flow work:
--
--   test on 10 rows -> proposals exist in the DB -> UI renders a real before/after
--   diff -> user approves -> apply_write_proposals() commits them -> previous_value
--   still on the row makes it revertible.
--
-- Non-test runs propose and apply in one go, so real runs still leave an audit trail.
--
-- Run this in the Supabase SQL editor, after 0001_tools_registry.sql.

create table if not exists public.workflow_write_proposals (
  id              bigint generated always as identity primary key,
  execution_id    bigint not null references public.workflow_executions(id) on delete cascade,
  view_id         bigint,
  list_lead_id    bigint not null,
  node_id         text,                        -- React Flow node id, for tracing
  target          text not null,               -- resolved container (see columns.column_type)
  column_name     text not null,               -- serialized name
  column_raw_name text,                        -- what the user typed
  previous_value  jsonb,                       -- null when the column does not exist yet
  new_value       jsonb,
  is_new_column   boolean not null default false,
  status          text not null default 'proposed',
  created_at      timestamptz not null default now(),
  applied_at      timestamptz,

  constraint wwp_target_check check (
    target in ('schema', 'extra_field', 'internal_enrichment', 'external_enrichment')
  ),
  constraint wwp_status_check check (
    status in ('proposed', 'applied', 'discarded', 'reverted', 'skipped')
  )
);

create index if not exists wwp_execution_idx on public.workflow_write_proposals (execution_id);
create index if not exists wwp_status_idx    on public.workflow_write_proposals (status);

alter table public.workflow_write_proposals enable row level security;

drop policy if exists "write proposals are readable" on public.workflow_write_proposals;
create policy "write proposals are readable"
  on public.workflow_write_proposals for select
  to anon, authenticated
  using (true);

-- Read-only for the client, and that is the whole security model here. Every write goes
-- through the SECURITY DEFINER functions below, which run as the owner and bypass RLS.
--
-- This is not optional hardening. apply_write_proposals commits whatever proposal rows
-- exist for an execution, so if a client could INSERT its own row it could forge a
-- proposal and then call apply to write arbitrary values into any lead, skipping the
-- approval step entirely. Verified: with RLS off, the anon key can do exactly that.
revoke insert, update, delete on public.workflow_write_proposals from anon, authenticated;


-- ---------------------------------------------------------------------------
-- Helper: which key inside `schema` does a column_type live under?
--
-- Note the asymmetry, which is real and load-bearing: the column_type is
-- 'extra_field' (singular) but the schema key is 'extra_fields' (plural).
-- ---------------------------------------------------------------------------
create or replace function public.schema_container_for(p_column_type text)
returns text language sql immutable as $$
  select case p_column_type
    when 'extra_field'          then 'extra_fields'
    when 'internal_enrichment'  then 'internal_enrichment'
    when 'external_enrichment'  then 'external_enrichment'
    else null                                   -- 'schema' lives at the top level
  end;
$$;


-- ---------------------------------------------------------------------------
-- propose_lead_write — record an intended write. Touches NO live data.
--
-- p_payload:
--   execution_id      bigint   required
--   list_lead_id      bigint   required
--   node_id           text
--   mode              text     'existing' | 'new'   (default 'existing')
--   column            text     raw column name the user picked or typed
--   value             jsonb    the resolved value (type preserved)
--   skip_if_populated boolean  default false
--
-- Returns the proposal so the node can show it as its OUTPUT.
-- ---------------------------------------------------------------------------
create or replace function public.propose_lead_write(p_payload jsonb)
returns jsonb language plpgsql security definer as $$
DECLARE
  v_execution_id  BIGINT  := (p_payload->>'execution_id')::BIGINT;
  v_lead_mem_id   BIGINT  := (p_payload->>'list_lead_id')::BIGINT;
  v_node_id       TEXT    := p_payload->>'node_id';
  v_mode          TEXT    := COALESCE(p_payload->>'mode', 'existing');
  v_raw_column    TEXT    := p_payload->>'column';
  v_value         JSONB   := p_payload->'value';
  v_skip          BOOLEAN := COALESCE((p_payload->>'skip_if_populated')::BOOLEAN, false);

  v_list_id       BIGINT;
  v_view_id       BIGINT;
  v_schema        JSONB;
  v_column_name   TEXT;
  v_column_type   TEXT;
  v_container     TEXT;
  v_previous      JSONB;
  v_is_new        BOOLEAN := false;
  v_status        TEXT := 'proposed';
  v_proposal      RECORD;
BEGIN
  SET LOCAL search_path = public;

  IF v_execution_id IS NULL OR v_lead_mem_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'execution_id and list_lead_id are required');
  END IF;

  IF v_raw_column IS NULL OR btrim(v_raw_column) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'column is required');
  END IF;

  SELECT llm.list_id, COALESCE(llm.schema, '{}'::JSONB)
  INTO v_list_id, v_schema
  FROM public.list_leads_membership llm
  WHERE llm.id = v_lead_mem_id;

  IF v_list_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Membership ID not found');
  END IF;

  SELECT we.view_id INTO v_view_id FROM public.workflow_executions we WHERE we.id = v_execution_id;

  -- Resolve the column. An existing column keeps its own container, and a brand new
  -- one always becomes an internal_enrichment.
  SELECT c.column_name, c.column_type
  INTO v_column_name, v_column_type
  FROM public.columns c
  WHERE c.list_id = v_list_id
    AND (c.column_raw_name = v_raw_column OR c.column_name = v_raw_column)
  ORDER BY (c.column_raw_name = v_raw_column) DESC
  LIMIT 1;

  IF v_column_name IS NULL THEN
    IF v_mode = 'existing' THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', format('Column %L does not exist on this list. Choose "new column" to create it.', v_raw_column)
      );
    END IF;
    v_column_name := serialize_column_name(v_raw_column);
    v_column_type := 'internal_enrichment';
    v_is_new      := true;
  END IF;

  -- email and domain are identity keys used to match leads across imports. Rewriting
  -- them from a workflow would silently break that matching, so they are refused.
  IF v_column_type = 'schema' AND v_column_name IN ('email', 'domain') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format('%L is an identity field and cannot be mapped', v_column_name)
    );
  END IF;

  v_container := schema_container_for(v_column_type);

  IF v_container IS NULL THEN
    v_previous := v_schema -> v_column_name;
  ELSE
    v_previous := v_schema -> v_container -> v_column_name;
  END IF;

  -- Skip-if-already-populated. An empty string counts as unpopulated.
  IF v_skip
     AND v_previous IS NOT NULL
     AND v_previous <> 'null'::JSONB
     AND btrim(COALESCE(v_previous #>> '{}', '')) <> '' THEN
    v_status := 'skipped';
  END IF;

  INSERT INTO public.workflow_write_proposals
    (execution_id, view_id, list_lead_id, node_id, target,
     column_name, column_raw_name, previous_value, new_value, is_new_column, status)
  VALUES
    (v_execution_id, v_view_id, v_lead_mem_id, v_node_id, v_column_type,
     v_column_name, v_raw_column, v_previous, v_value, v_is_new, v_status)
  RETURNING * INTO v_proposal;

  RETURN jsonb_build_object(
    'success',        true,
    'proposal_id',    v_proposal.id,
    'target',         v_column_type,
    'column',         v_column_name,
    'previous_value', v_previous,
    'new_value',      v_value,
    'is_new_column',  v_is_new,
    'status',         v_status
  );
END;
$$;


-- ---------------------------------------------------------------------------
-- apply_write_proposals — commit every proposed write for an execution.
--
-- Creates the `columns` row for new columns here, not at propose time: metadata
-- must not change for a run the user has not approved.
-- ---------------------------------------------------------------------------
create or replace function public.apply_write_proposals(p_execution_id bigint)
returns jsonb language plpgsql security definer as $$
DECLARE
  v_p           RECORD;
  v_schema      JSONB;
  v_list_id     BIGINT;
  v_lead_id     BIGINT;
  v_container   TEXT;
  v_max_order   INT;
  v_applied     INT := 0;
  v_failed      INT := 0;
  v_errors      JSONB := '[]'::JSONB;
BEGIN
  SET LOCAL search_path = public;

  FOR v_p IN
    SELECT * FROM public.workflow_write_proposals
    WHERE execution_id = p_execution_id AND status = 'proposed'
    ORDER BY id
  LOOP
    BEGIN
      SELECT llm.list_id, llm.lead_id, COALESCE(llm.schema, '{}'::JSONB)
      INTO v_list_id, v_lead_id, v_schema
      FROM public.list_leads_membership llm
      WHERE llm.id = v_p.list_lead_id;

      IF v_list_id IS NULL THEN
        RAISE EXCEPTION 'Membership % not found', v_p.list_lead_id;
      END IF;

      -- Register the column the first time we actually commit it.
      IF v_p.is_new_column THEN
        SELECT COALESCE(MAX(column_order), 0) + 1 INTO v_max_order
        FROM public.columns WHERE list_id = v_list_id;

        INSERT INTO public.columns (list_id, column_name, column_raw_name, column_type, column_order)
        VALUES (v_list_id, v_p.column_name, v_p.column_raw_name, v_p.target, v_max_order)
        ON CONFLICT (list_id, column_name) DO UPDATE SET column_type = EXCLUDED.column_type;
      END IF;

      v_container := schema_container_for(v_p.target);

      IF v_container IS NULL THEN
        v_schema := jsonb_set(v_schema, ARRAY[v_p.column_name], COALESCE(v_p.new_value, 'null'::JSONB), true);

        -- Keep the denormalized leads row in step for native fields.
        IF v_p.column_name NOT IN ('email', 'domain') AND v_lead_id IS NOT NULL THEN
          EXECUTE format('UPDATE public.leads SET %I = %L, updated_at = NOW() WHERE id = %L',
                         v_p.column_name, v_p.new_value #>> '{}', v_lead_id);
        END IF;
      ELSE
        IF v_schema -> v_container IS NULL OR jsonb_typeof(v_schema -> v_container) <> 'object' THEN
          v_schema := jsonb_set(v_schema, ARRAY[v_container], '{}'::JSONB, true);
        END IF;
        v_schema := jsonb_set(v_schema, ARRAY[v_container, v_p.column_name],
                              COALESCE(v_p.new_value, 'null'::JSONB), true);
      END IF;

      UPDATE public.list_leads_membership
      SET schema = v_schema,
          last_enriched_at = NOW(),
          last_enriched_source = 'workflow',
          status = 'enriched'
      WHERE id = v_p.list_lead_id;

      UPDATE public.workflow_write_proposals
      SET status = 'applied', applied_at = NOW()
      WHERE id = v_p.id;

      v_applied := v_applied + 1;

    EXCEPTION WHEN OTHERS THEN
      -- One bad row must not abort the whole approval.
      v_failed := v_failed + 1;
      v_errors := v_errors || jsonb_build_object('proposal_id', v_p.id, 'error', SQLERRM);
    END;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'applied', v_applied, 'failed', v_failed, 'errors', v_errors);
END;
$$;


-- ---------------------------------------------------------------------------
-- revert_write_proposals — put previous_value back. This is the undo that
-- capturing previous_value at propose time buys.
-- ---------------------------------------------------------------------------
create or replace function public.revert_write_proposals(p_execution_id bigint)
returns jsonb language plpgsql security definer as $$
DECLARE
  v_p         RECORD;
  v_schema    JSONB;
  v_container TEXT;
  v_reverted  INT := 0;
BEGIN
  SET LOCAL search_path = public;

  FOR v_p IN
    SELECT * FROM public.workflow_write_proposals
    WHERE execution_id = p_execution_id AND status = 'applied'
    ORDER BY id DESC
  LOOP
    SELECT COALESCE(llm.schema, '{}'::JSONB) INTO v_schema
    FROM public.list_leads_membership llm WHERE llm.id = v_p.list_lead_id;

    v_container := schema_container_for(v_p.target);

    IF v_p.previous_value IS NULL THEN
      -- The key did not exist before this write, so remove it entirely.
      IF v_container IS NULL THEN
        v_schema := v_schema - v_p.column_name;
      ELSE
        v_schema := jsonb_set(v_schema, ARRAY[v_container],
                              COALESCE(v_schema -> v_container, '{}'::JSONB) - v_p.column_name, true);
      END IF;
    ELSE
      IF v_container IS NULL THEN
        v_schema := jsonb_set(v_schema, ARRAY[v_p.column_name], v_p.previous_value, true);
      ELSE
        v_schema := jsonb_set(v_schema, ARRAY[v_container, v_p.column_name], v_p.previous_value, true);
      END IF;
    END IF;

    UPDATE public.list_leads_membership SET schema = v_schema WHERE id = v_p.list_lead_id;

    UPDATE public.workflow_write_proposals SET status = 'reverted' WHERE id = v_p.id;
    v_reverted := v_reverted + 1;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'reverted', v_reverted);
END;
$$;


-- ---------------------------------------------------------------------------
-- discard_write_proposals — reject the staged writes for an execution outright.
--
-- Keep quotes and semicolons out of comments in this file. The Supabase SQL editor
-- tracks quote state while splitting statements and does not exclude comments, so a
-- single unpaired apostrophe swallows everything after it and the errors it produces
-- point nowhere near the real line.
-- ---------------------------------------------------------------------------
create or replace function public.discard_write_proposals(p_execution_id bigint)
returns jsonb language plpgsql security definer as $$
DECLARE
  v_discarded INT;
BEGIN
  SET LOCAL search_path = public;

  UPDATE public.workflow_write_proposals
  SET status = 'discarded'
  WHERE execution_id = p_execution_id AND status = 'proposed';

  GET DIAGNOSTICS v_discarded = ROW_COUNT;

  RETURN jsonb_build_object('success', true, 'discarded', v_discarded);
END;
$$;


grant execute on function public.propose_lead_write(jsonb)      to anon, authenticated;
grant execute on function public.apply_write_proposals(bigint)  to anon, authenticated;
grant execute on function public.revert_write_proposals(bigint) to anon, authenticated;
grant execute on function public.discard_write_proposals(bigint) to anon, authenticated;


-- ---------------------------------------------------------------------------
-- Palette entry. Native node, so it lives in node_types (not `tools`) — it needs
-- the execution context and elevated writes that a portable tool must not have.
-- ---------------------------------------------------------------------------
-- `where not exists` rather than `on conflict`, since node_types.key has no unique
-- constraint to conflict on.
insert into public.node_types (name, key, description, category, is_active, config_schema)
select
  'Map to Column',
  'map_column',
  'Write a value from a previous step into a column on the row. Existing columns keep their container, and new columns become internal enrichments.',
  'Data',
  true,
  '{
    "type": "object",
    "properties": {
      "mode":              { "type": "string",  "enum": ["existing", "new"], "default": "existing" },
      "column":            { "type": "string",  "description": "Column to write to" },
      "value":             { "type": "string",  "description": "Value, supports {{ item.field }}" },
      "skipIfPopulated":   { "type": "boolean", "default": false }
    },
    "required": ["column", "value"]
  }'::jsonb
where not exists (
  select 1 from public.node_types where key = 'map_column'
);
