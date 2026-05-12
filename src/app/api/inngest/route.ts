// app/api/inngest/route.ts
import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";

// Core narrative
import { globalRewriteJob } from "@/inngest/functions";
import { ensureWorld } from "@/inngest/ensureWorld";

import { decideScenes } from "@/inngest/decideSpreadScenes";
import { buildSpreadPrompts } from "@/inngest/buildSpreadPrompts";

// Visuals
import { generateStyleSample } from "@/inngest/generateStyle";
// import { generateBookSpreads, generateSingleSpread } from "@/inngest/generateSpreadImages.phaseB";
import { generateBookSpreads, generateSingleSpread } from "@/inngest/generateBookSpreads";

import { reviseSingleSpread } from "@/inngest/reviseSingleSpread";
import { buildSpreads } from "@/inngest/buildSpreads";
import { analyseReferencePhoto } from "@/inngest/analyseReferencePhoto";
import { generateCoverSpreadV5 } from "@/inngest/generateCoverSpread.v5";


export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    // Core pipeline
    globalRewriteJob,
    ensureWorld,
    buildSpreads,
    decideScenes,
    buildSpreadPrompts,     // ✅ NEW: art director phase

    // Visuals
    generateStyleSample,
    generateBookSpreads,
    generateSingleSpread,
    reviseSingleSpread,
    generateCoverSpreadV5,
    analyseReferencePhoto,
  ],
});