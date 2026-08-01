This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.


Future Plans for the project:

1. Bull MQ queue mode batching for lead_member enrichment.
2. API Endpoint for direct lead addition from clay/3rd party apps(batching logic - from single items recieved).
3. Campaign Page that connects to lead_lists/clay_tables, has settings for each sequencers, copy variants for each sequencer and can upload to the sequencer.
4. Master List table, for internal enrichment(api calls, llm, js code), custom enrichments(reply%, -ve reply%, last_reached_out_to, number_of_times_reached_out, llm_based_signal for type of offer they are open to), filtering, sorting, column re-arrangement, creating child list from parent list(based on filtering and enrichments).

5. Bring Supabase to selfhost, so we can package it like EmailBison and sell.

6. Domain Purchase and Email Setup Pipeline(API Based).
7. Connecting Email Inboxes to the system via Oauth and doing realtime reply management. Maybe connect with LLM too.
8. Connecting Whatsapp, Slack, Linkedin etc, so we can do realtime reply management and respond to messages and tasks, intent, sentiment, next steps with LLM.

9. Use react flow to make an interface or something that will work on the list.

Future plan dated - 31st July, 3:01 AM, 2026: 
WhiteSpider Architecture Roadmap
Current State ✅
Next.js backend executes workflows.
Tools are TypeScript files inside the repo.
Native/control tools exist.
Workflows are manually connected.
No conversation agent.
No capability analyzer.
No worker/execution service.
Phase 1 — Separate Planning from Execution

Goal: Stop Next.js from executing workflows.

 Create an Execution Service (initially can just be another Node process).
 Move the Workflow Engine into the Execution Service.
 Move workflow execution from Next.js to the Execution Service.
 Next.js becomes responsible only for:
Building workflows
Saving workflows
Triggering preview
Triggering execution
Showing results

This is the biggest architectural change.

Phase 2 — Introduce Workers

Goal: Prepare for long-running jobs.

 Add a Job Runner.
 Add a Worker process.
 Worker executes workflows.
 Support chunked execution for large datasets.
 Add progress reporting.
Phase 3 — Organize Execution Layer

Inside the Execution Service:

 Workflow Engine
 Execution Context
 Control Nodes (If, Loop, Merge, etc.)
 Tool Executor
 Job Runner
 Test Runner

These become the core execution components.

Phase 4 — Tool Registry

Move from:

Engine knows every tool

to:

Engine

↓

Tool Registry

↓

Tool

Registry stores metadata like:

Name
Runtime
Version
Input Schema
Output Schema
Entry Point
Phase 5 — Runtime Abstraction

Instead of:

Python Tool

Think:

Runtime

↓

Tool

Initially you'll only implement:

 TypeScript Runtime

Later:

 Python Runtime
 Docker Runtime
 Others

This keeps WhiteSpider language-agnostic.

Phase 6 — Conversation Agent

Once execution is stable:

 Add Conversation Agent.
 Agent builds workflows from user requests.
Phase 7 — Capability Analyzer

Before building a workflow:

 Check Tool Registry.
 Decide whether existing tools are sufficient.
 Detect missing capabilities.
Phase 8 — Tool Factory

Only after everything above exists.

Responsible for:

 Generate tool
 Generate tests
 Run tests inside the Execution Service
 Publish tool
 Register tool
Phase 9 — Self-Improving Platform

Final state:

User

↓

Conversation Agent

↓

Capability Analyzer

↓

Workflow

↓

Execution Service

↓

Worker

↓

Tools

If a tool doesn't exist:

Capability Analyzer

↓

Tool Factory

↓

Generate

↓

Test

↓

Register

↓

Available immediately
Biggest Architectural Decisions We've Finalized
✅ Separate Planning (Next.js) from Execution (Execution Service).
✅ Only one execution environment should exist.
✅ Preview and production should use the same execution engine.
✅ Workers execute workflows.
✅ Next.js should never execute workflows.
✅ Tool testing happens inside the Execution Service.
✅ Introduce a Tool Registry instead of hardcoding tools.
✅ Design around runtimes, not Python.
✅ Start with a TypeScript runtime (since your tools already are TS), but make the registry runtime-aware so Python and other runtimes can be added later.
✅ Add agents only after the execution platform is mature.


Current plan:

1. I wanna replicate Miles work which is ICP, scrape etc onto my sheet. (Done)
2. I wanna create a research agent that can take any query and do research and generate output (query agnostic)
3. I wanna create an agent node that can do any job and has a selector for model etc and prompt and shit so I can use AI in the workflow
4. I wanna create an agent that can use tools and such inside the workflow kinda like the one n8n has.

These will help me execute a presentation of the MVP properly

Current fixes:
1. Nuances between agent executions saving (test node) and manual workflows.
2. Input and output mapping and mapping them against multi items and referencing multiple nodes back output and keeping a map of items (what it means is that lets say each item created 2 items, so if there were 2 inputs, there would be 4 outputs there the map breaks, we need to be able to handle that)
3. Agent history is not saved, Agent has only 1 chat context per view, I dont know if there is context being saved, I need to do better here.