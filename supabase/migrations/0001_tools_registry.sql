-- Milestone 1 — Tool Registry
--
-- The `tools` table is the registry the Tool Host reads at execution time and the
-- Add Node palette reads at render time. Adding a capability = one file in
-- tool-host/tools/, one line in tool-host/registry.ts, one row here.
--
-- Run this in the Supabase SQL editor. This file is the checked-in source of truth.

create table if not exists public.tools (
  id             uuid primary key default gen_random_uuid(),
  name           text unique not null,          -- 'fake_company_lookup' (stable id, used by nodes)
  display_name   text not null,                 -- 'Company Lookup'
  description    text,
  category       text not null default 'Tool',  -- feeds the palette; never 'Execution'
  input_schema   jsonb not null default '{"type":"object","properties":{}}'::jsonb,
  output_schema  jsonb,
  implementation text not null,                 -- registry key -> tool-host/tools/<impl>.ts
  runtime        text not null default 'local', -- 'local' | 'http'   (http = future Railway)
  endpoint       text,                          -- required when runtime='http'
  supports_batch boolean not null default false,-- declared now, honored in a later milestone
  version        integer not null default 1,
  status         text not null default 'active',-- 'active' | 'draft' | 'disabled'
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint tools_runtime_check check (runtime in ('local', 'http')),
  constraint tools_status_check  check (status in ('active', 'draft', 'disabled')),
  constraint tools_http_needs_endpoint check (runtime <> 'http' or endpoint is not null)
);

create index if not exists tools_status_idx on public.tools (status);

-- The app reads tools with the anon key, same as node_types.
alter table public.tools enable row level security;

drop policy if exists "tools are readable" on public.tools;
create policy "tools are readable"
  on public.tools for select
  to anon, authenticated
  using (true);


-- ---------------------------------------------------------------------------
-- Seed tools
--
-- Each proves a distinct property of the stack rather than being useful:
--   echo                -> the whole path works, with zero logic
--   normalize_email     -> {{ item.field }} templating pulls real list data
--   fake_company_lookup -> async latency, optional args, enrichment-shaped output
--
-- input_schema is what renders the config form. There is no per-tool React code.
-- ---------------------------------------------------------------------------

insert into public.tools
  (name, display_name, description, category, implementation, input_schema, output_schema)
values
  (
    'echo',
    'Echo',
    'Returns whatever arguments it was given. Useful for testing templating.',
    'Tool',
    'echo',
    '{
      "type": "object",
      "properties": {
        "message": { "type": "string", "description": "Anything you want echoed back" }
      },
      "required": []
    }'::jsonb,
    '{
      "type": "object",
      "properties": { "received": { "type": "object" } }
    }'::jsonb
  ),
  (
    'normalize_email',
    'Normalize Email',
    'Lowercases and trims an email address, extracts its domain, and flags whether it looks valid.',
    'Tool',
    'normalizeEmail',
    '{
      "type": "object",
      "properties": {
        "email": { "type": "string", "description": "Email address to normalize" }
      },
      "required": ["email"]
    }'::jsonb,
    '{
      "type": "object",
      "properties": {
        "email":      { "type": "string" },
        "normalized": { "type": "string" },
        "domain":     { "type": "string" },
        "is_valid":   { "type": "boolean" }
      }
    }'::jsonb
  ),
  (
    'fake_company_lookup',
    'Company Lookup',
    'Returns deterministic fake firmographics for a domain. Stands in for a real enrichment provider.',
    'Tool',
    'fakeCompanyLookup',
    '{
      "type": "object",
      "properties": {
        "domain":        { "type": "string",  "description": "Company domain, e.g. acme.com" },
        "max_employees": { "type": "number",  "description": "Optional cap on the returned employee count" }
      },
      "required": ["domain"]
    }'::jsonb,
    '{
      "type": "object",
      "properties": {
        "domain":         { "type": "string" },
        "company_name":   { "type": "string" },
        "employee_count": { "type": "number" },
        "industry":       { "type": "string" }
      }
    }'::jsonb
  )
on conflict (name) do nothing;
