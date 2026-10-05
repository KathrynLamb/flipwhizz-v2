// src/inngest/dailyHealthCheck.ts
//
// Every morning at 08:00 UK time: look for anything stuck and email one
// digest. Sends nothing when everything is healthy.

import { inngest } from "./client";
import { runHealthCheck, sendDigest } from "@/lib/healthCheck";

export const dailyHealthCheck = inngest.createFunction(
  {
    id: "daily-health-check",
    retries: 2,
    triggers: [{ cron: "TZ=Europe/London 0 8 * * *" }],
  },
  async ({ step }) => {
    const report = await step.run("run-checks", () => runHealthCheck());
    const result = await step.run("send-digest", () => sendDigest(report));
    return { total: report.total, ...result };
  },
);
