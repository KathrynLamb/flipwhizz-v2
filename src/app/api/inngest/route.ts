import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { globalRewriteJob, extractWorldJob } from "@/inngest/functions";
import { generateStyleSample } from "@/inngest/generateStyle"; // 👈 Import new function

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    globalRewriteJob,
    extractWorldJob,
    generateStyleSample, // 👈 Register it here
  ],
});