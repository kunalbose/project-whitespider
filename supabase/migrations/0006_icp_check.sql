-- icp_check — the first tool in the registry that touches the network
--
-- Two things here. A timeout_ms column on tools, and the registry row for icp_check.
--
-- WHY timeout_ms
--
-- The Tool Host applies a flat 30 second budget to every tool. That was fine while every
-- tool was a pure local transform. icp_check makes up to 6 HTTP scrapes and 2 model calls,
-- so it cannot finish in 30 seconds, and raising the global default would quietly let every
-- future tool hang for two minutes before anyone noticed it was stuck.
--
-- A per-row override keeps the operational envelope of a tool next to its schemas, which is
-- where the rest of its configuration already lives. Null means use the default, so every
-- existing row keeps the behaviour it has today.
--
-- WHY the row is here rather than typed into the table editor
--
-- output_schema has to match what tool-host/tools/icpCheck.ts actually returns, field for
-- field. The Capability Analyzer resolves downstream templates against it, so a drift
-- between the two shows up as a workflow that validates and then fails at run time.
--
-- Run this in the Supabase SQL editor, after 0005_workflows.sql. It is re-runnable.
--
-- Keep quotes and semicolons out of comments in this file. The Supabase SQL editor tracks
-- quote state while splitting statements and does not exclude comments, so a single
-- apostrophe in a comment swallows everything after it.

alter table public.tools
  add column if not exists timeout_ms integer;

comment on column public.tools.timeout_ms is
  'Per-tool execution budget in ms. Null falls back to the Tool Host default of 30000.';

-- Nothing has a foreign key onto tools, so replacing the row wholesale is safe and makes
-- this file re-runnable while the schemas are still being iterated on.
delete from public.tools where name = 'icp_check';

insert into public.tools (
  name,
  display_name,
  description,
  category,
  input_schema,
  output_schema,
  implementation,
  runtime,
  endpoint,
  supports_batch,
  version,
  status,
  timeout_ms
) values (
  'icp_check',
  'ICP Check',
  'Scrapes a company website through ScrapingDog and judges whether the company falls inside an ICP you describe. Returns 0 for not in ICP, 1 for confidently in ICP, and 2 for not sure, alongside the ICP the company itself appears to sell to and a summary of what it does. Costs one ScrapingDog credit per page read, up to max_pages.',
  'Tool',
  '{
    "type": "object",
    "required": ["website", "icp_description"],
    "properties": {
      "website": {
        "type": "string",
        "description": "Company homepage or bare domain, e.g. acme.com"
      },
      "icp_description": {
        "type": "string",
        "format": "textarea",
        "description": "Describe the ideal customer profile to judge this company against"
      },
      "max_pages": {
        "type": "number",
        "description": "Pages to read including the homepage. Default 4, hard maximum 6. Each page costs one credit."
      }
    }
  }'::jsonb,
  '{
    "type": "object",
    "properties": {
      "icp_match": { "type": "number" },
      "icp_match_label": { "type": "string" },
      "company_icp": { "type": "string" },
      "company_summary": { "type": "string" },
      "reasoning": { "type": "string" },
      "pages_scraped": { "type": "array" },
      "credits_used": { "type": "number" }
    }
  }'::jsonb,
  'icpCheck',
  'local',
  null,
  false,
  1,
  'active',
  120000
);
