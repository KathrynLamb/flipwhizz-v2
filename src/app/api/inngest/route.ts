// app/api/inngest/route.ts
import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";

// Core narrative
import { globalRewriteJob } from "@/inngest/functions";
import { ensureWorld } from "@/inngest/ensureWorld"; // ✅ NEW IMPORT

import { decideScenes } from "@/inngest/decideSpreadScenes";

// Visuals
import { generateStyleSample } from "@/inngest/generateStyle";
import { generateBookSpreads, generateSingleSpread } from "@/inngest/generateSpreadImages.phaseB";
import { reviseSingleSpread } from "@/inngest/reviseSingleSpread";
import { generateCoverSpreadPhaseB } from "@/inngest/generateCoverSpread.phaseB";
import { buildSpreads } from "@/inngest/buildSpreads";
import { analyseReferencePhoto } from "@/inngest/analyseReferencePhoto";


export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    // Core pipeline
    globalRewriteJob,
    ensureWorld,        // ✅ CHANGED: was extractWorldJob
    buildSpreads,
    decideScenes,

    // Visuals
    generateStyleSample,
    generateBookSpreads,    // ✅ ADDED: Orchestrator
    generateSingleSpread,   // ✅ Worker
    reviseSingleSpread,
    generateCoverSpreadPhaseB,
    analyseReferencePhoto
  ],
});