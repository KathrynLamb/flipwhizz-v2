import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";

// Core narrative
import { globalRewriteJob, extractWorldJob } from "@/inngest/functions";
import { buildSpreads } from "@/inngest/buildSpreads";
import { decideSpreadScenes } from "@/inngest/decideSpreadScenes";

// Visuals
import { generateStyleSample } from "@/inngest/generateStyle";
// import { generateSingleSpread } from "@/inngest/generateSingleSpread";
import { reviseSingleSpread } from "@/inngest/reviseSingleSpread";
import { generateBookCovers } from "@/inngest/generateBookCovers";
import { generateBookSpreads } from "@/inngest/generateBookSpreads";
import { generateSingleSpread } from "@/inngest/generateSpreadImages.phaseB";

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
    generateSingleSpread,
    reviseSingleSpread,
    generateBookCovers,

    generateBookSpreads
  ],
});
