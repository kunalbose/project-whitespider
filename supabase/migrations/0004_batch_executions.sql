-- Milestone 2 — batch executions
--
-- A test run now covers N rows (10 by default) rather than the single row the canvas
-- picked. All N share one execution, so the Executions tab shows one entry and one
-- Approve commits the whole batch. Per-row identity is not lost: every
-- workflow_write_proposals row already carries its own list_lead_id, which is what the
-- before/after diff renders from.
--
-- That means the execution itself no longer belongs to one lead, so list_lead_id has to
-- be droppable. Batch runs write null; single-row runs still write the id.
--
-- Effect on idx_active_execution (list_lead_id, view_id) over active rows: Postgres
-- treats nulls as distinct in a unique index, so batch runs stop being guarded by it
-- while per-lead re-runs -- the case it exists for -- still are. Concurrent batch runs
-- on one view are therefore allowed, which is the intended behaviour.
--
-- Run this in the Supabase SQL editor, after 0003_attach_new_columns_to_view.sql.

alter table public.workflow_executions
  alter column list_lead_id drop not null;
