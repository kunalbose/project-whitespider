-- Milestone 1b fix — a workflow-created column must be attached to its view
--
-- apply_write_proposals registered a brand new column in `columns` but never inserted a
-- `view_columns` row. The grid renders exclusively from view_columns (see the query in
-- app/(view)/views/[viewId]/page.tsx), so a column created by a workflow run was
-- invisible in every view even though the value was written to the row correctly.
--
-- Observed case: proposal 1 applied employee_count_new to membership 42080. The value
-- landed at schema.internal_enrichment.employee_count_new, `columns` row 272 was created,
-- and view 1 still listed only column ids 11 through 66. Nothing pointed at 272.
--
-- The attach happens inside apply_write_proposals rather than in the app, so it shares the
-- transaction with the `columns` insert and the schema write. A column must never become
-- visible-but-unwritten or written-but-invisible because a second call failed in between.
--
-- Scope: the execution view only. workflow_write_proposals.view_id is captured at propose
-- time, so the run that created the column is exactly the view that gets it. Other views on
-- the list are left alone -- they are curated subsets and this migration does not touch them.
--
-- Run this in the Supabase SQL editor, after 0002_write_proposals.sql.
--
-- Keep quotes and semicolons out of comments in this file. The Supabase SQL editor tracks
-- quote state while splitting statements and does not exclude comments, so a single
-- unpaired apostrophe swallows everything after it and the errors point nowhere near the
-- real line.

create or replace function public.apply_write_proposals(p_execution_id bigint)
returns jsonb language plpgsql security definer as $$
DECLARE
  v_p           RECORD;
  v_schema      JSONB;
  v_list_id     BIGINT;
  v_lead_id     BIGINT;
  v_container   TEXT;
  v_max_order   INT;
  v_column_id   BIGINT;
  v_view_order  INT;
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

        -- DO UPDATE rather than DO NOTHING so RETURNING yields the id on the conflict
        -- path too. Several rows in one run propose the same new column, and only the
        -- first of them actually inserts it.
        INSERT INTO public.columns (list_id, column_name, column_raw_name, column_type, column_order)
        VALUES (v_list_id, v_p.column_name, v_p.column_raw_name, v_p.target, v_max_order)
        ON CONFLICT (list_id, column_name) DO UPDATE SET column_type = EXCLUDED.column_type
        RETURNING id INTO v_column_id;

        -- Registering the column is only half the job. Attach it to the view the run
        -- belongs to, or the grid will never render it.
        IF v_p.view_id IS NOT NULL AND v_column_id IS NOT NULL THEN
          SELECT COALESCE(MAX(column_order), 0) + 1 INTO v_view_order
          FROM public.view_columns WHERE view_id = v_p.view_id;

          -- NOT EXISTS rather than ON CONFLICT: view_columns has no unique constraint on
          -- (view_id, column_id) to conflict on.
          INSERT INTO public.view_columns (view_id, column_id, is_visible, column_order)
          SELECT v_p.view_id, v_column_id, true, v_view_order
          WHERE NOT EXISTS (
            SELECT 1 FROM public.view_columns
            WHERE view_id = v_p.view_id AND column_id = v_column_id
          );
        END IF;
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
      -- One bad row must not abort the whole approval. This block is a plpgsql
      -- subtransaction, so a failed attach rolls back the column insert and schema write
      -- for that proposal along with it -- no half-applied row.
      v_failed := v_failed + 1;
      v_errors := v_errors || jsonb_build_object('proposal_id', v_p.id, 'error', SQLERRM);
    END;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'applied', v_applied, 'failed', v_failed, 'errors', v_errors);
END;
$$;


-- ---------------------------------------------------------------------------
-- Backfill: columns already applied by the old function, still unattached.
--
-- Matches proposals back to their column through the membership list_id, and appends each
-- one to its view. row_number keeps the ordering correct when a single view has more than
-- one orphan, which a plain max() subquery would not.
-- ---------------------------------------------------------------------------
with orphans as (
  select distinct p.view_id, c.id as column_id
  from public.workflow_write_proposals p
  join public.list_leads_membership llm on llm.id = p.list_lead_id
  join public.columns c
    on c.list_id = llm.list_id
   and c.column_name = p.column_name
  where p.status = 'applied'
    and p.is_new_column
    and p.view_id is not null
    and not exists (
      select 1 from public.view_columns vc
      where vc.view_id = p.view_id and vc.column_id = c.id
    )
)
insert into public.view_columns (view_id, column_id, is_visible, column_order)
select
  o.view_id,
  o.column_id,
  true,
  coalesce(
    (select max(vc.column_order) from public.view_columns vc where vc.view_id = o.view_id),
    0
  ) + row_number() over (partition by o.view_id order by o.column_id)
from orphans o;
