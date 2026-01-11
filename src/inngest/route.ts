import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";

// 🔴 IMPORT ALL JOBS EXPLICITLY
import { globalRewriteJob, extractWorldJob } from "@/inngest/functions";
import { buildSpreadsJob } from "@/inngest/buildSpreads";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    globalRewriteJob,
    extractWorldJob,
    buildSpreadsJob,
  ],
});
