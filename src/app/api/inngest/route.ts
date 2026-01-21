// src/app/api/inngest/route.ts
import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";

// Core
import { globalRewriteJob, extractWorldJob } from "@/inngest/functions";

// World / structure
import { buildSpreads } from "@/inngest/buildSpreads";
import { decideSpreadScenes } from "@/inngest/decideSpreadScenes";

// Visuals
import { generateStyleSample } from "@/inngest/generateStyle";
import { generateSpreadImages } from "@/inngest/generateSpreadImages.phaseB";
import { generateBookSpreads, generateSingleSpread } from "@/inngest/generateSpreads";
import { generateBookCovers } from "@/inngest/generateBookCovers";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    // Core
    globalRewriteJob,
    extractWorldJob,

    // REQUIRED ORDER
    buildSpreads,
    decideSpreadScenes,

    // Visuals
    generateStyleSample,
    generateSpreadImages,
    generateBookSpreads,
    generateSingleSpread,
    generateBookCovers,
  ],
});
