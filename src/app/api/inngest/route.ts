// api/inngest/routeModule.ts
import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";

// Core narrative
import { globalRewriteJob, extractWorldJob } from "@/inngest/functions";
import { buildSpreads } from "@/inngest/buildSpreads";


// Visuals
import { generateStyleSample } from "@/inngest/generateStyle";
// import { generateSingleSpread } from "@/inngest/generateSingleSpread";
import { reviseSingleSpread } from "@/inngest/reviseSingleSpread";
import { generateBookCovers } from "@/inngest/generateBookCovers";
import { generateBookSpreads } from "@/inngest/generateBookSpreads";
import { generateSingleSpread } from "@/inngest/generateSpreadImages.phaseB";
import { decideSpreadScenes } from "@/inngest/decideSpreadScenes"; // Make sure this path is correct
import { routeModule } from "next/dist/build/templates/pages";


export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    // Core pipeline
    globalRewriteJob,
    extractWorldJob,
    buildSpreads,

    // Visuals
    generateStyleSample,
    generateSingleSpread,
    reviseSingleSpread,
    generateBookCovers,
    decideSpreadScenes,
    generateBookSpreads
  ],
});
