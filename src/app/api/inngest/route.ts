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
// import { generateCoverSpreadPhaseB } from "@/inngest/generateCoverSpread.phaseB";
// In your inngest setup file (e.g. src/inngest/index.ts or wherever functions are registered)
// import { generateCoverSpreadV5 } from "./generateCoverSpread.v5";
// Remove or comment out: import { generateCoverSpreadPhaseB } from "./generateCoverSpread.phaseB";
import { buildSpreads } from "@/inngest/buildSpreads";
import { analyseReferencePhoto } from "@/inngest/analyseReferencePhoto";
import { generateCoverSpreadV5 } from "@/inngest/generateCoverSpread.v5";


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
    generateCoverSpreadV5,
    analyseReferencePhoto
  ],
});