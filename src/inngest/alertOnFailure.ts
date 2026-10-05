// src/inngest/alertOnFailure.ts
//
// Catch-all: Inngest emits "inngest/function.failed" whenever ANY function
// fails after its retries are used up. This turns each one into an alert
// email + PostHog event, so no pipeline step can fail silently.

import { inngest } from "./client";
import { sendAlert } from "@/lib/alerts";

export const alertOnFunctionFailure = inngest.createFunction(
  {
    id: "alert-on-function-failure",
    retries: 2,
    triggers: [{ event: "inngest/function.failed" }],
  },
  async ({ event }) => {
    const data = (event.data ?? {}) as {
      function_id?: string;
      run_id?: string;
      error?: { message?: string; name?: string; stack?: string };
      event?: { name?: string; data?: Record<string, unknown> };
    };

    const original = data.event?.data ?? {};
    const pick = (k: string) => (typeof original[k] === "string" ? (original[k] as string) : null);

    const fn = data.function_id ?? "unknown-function";
    const err = new Error(data.error?.message || "Inngest function failed");
    if (data.error?.stack) err.stack = data.error.stack;

    await sendAlert({
      area: `inngest/${fn}`,
      title: `Background job failed: ${fn}`,
      severity: "error",
      error: err,
      storyId: pick("storyId"),
      projectId: pick("projectId"),
      userId: pick("userId"),
      context: {
        run_id: data.run_id,
        triggering_event: data.event?.name,
        event_data: original,
        inngest_runs: "https://app.inngest.com/env/production/runs",
      },
    });

    return { alerted: true, function_id: fn };
  },
);
