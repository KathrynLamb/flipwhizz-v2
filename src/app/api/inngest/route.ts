// app/api/inngest/route.ts
import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";

// Core narrative
import { globalRewriteJob, extractWorldJob } from "@/inngest/functions";
import { buildSpreads } from "@/inngest/buildSpreads";
import { decideSpreadScenes } from "@/inngest/decideSpreadScenes";

// Visuals
import { generateStyleSample } from "@/inngest/generateStyle";
import { generateBookSpreads, generateSingleSpread } from "@/inngest/generateSpreadImages.phaseB";
import { reviseSingleSpread } from "@/inngest/reviseSingleSpread";
import { generateBookCovers } from "@/inngest/generateBookCovers";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    // Core pipeline
    globalRewriteJob,
    extractWorldJob,
    buildSpreads,
    decideSpreadScenes,

    // Visuals
    generateStyleSample,
    generateBookSpreads,    // ✅ ADDED: Orchestrator
    generateSingleSpread,   // ✅ Worker
    reviseSingleSpread,
    generateBookCovers,
  ],
});