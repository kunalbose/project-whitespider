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
