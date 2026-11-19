// src/inngest/detectStalledBooks.ts
//
// Every 15 minutes: find customers who stopped part-way (a book stuck at
// cards, places or before its first page; a chat that never became a story;
// a demo chat that never signed up) and record one event each, which emails
// Katy. Each place someone stops is reported once. See src/lib/events/stalled.ts.

import { inngest } from "./client";
import { detectStalled } from "@/lib/events/stalled";

export const detectStalledBooks = inngest.createFunction(
  {
    id: "detect-stalled-books",
    retries: 1,
    concurrency: 1,
    triggers: [{ cron: "TZ=Europe/London */15 * * * *" }],
  },
  async ({ step }) => step.run("scan", () => detectStalled()),
);
