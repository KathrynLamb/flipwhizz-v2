// app/api/inngest/route.ts
import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";

// Image steps (spreads, covers, full-body references) can take 30-90s each.
export const maxDuration = 300;

// Core narrative
import { globalRewriteJob } from "@/inngest/functions";
import { ensureWorld } from "@/inngest/ensureWorld";

import { decideScenes } from "@/inngest/decideSpreadScenes";
import { buildSpreadPrompts } from "@/inngest/buildSpreadPrompts";

// Visuals
import { generateStyleSample } from "@/inngest/generateStyle";
import { generateBookSpreads } from "@/inngest/generateBookSpreads";
import { generateSingleSpread } from "@/inngest/spreadWorker"; // compose -> check and fix -> letter
import { refreshCharacter } from "@/inngest/refreshCharacter";
import { reletterBook } from "@/inngest/reletter";
import { reviseSingleSpread } from "@/inngest/reviseSingleSpread";
import { buildSpreads } from "@/inngest/buildSpreads";
import { analyseReferencePhoto } from "@/inngest/analyseReferencePhoto";
import { generateCoverSpreadV5 } from "@/inngest/generateCoverSpread.v5";

// Alerts
import { alertOnFunctionFailure } from "@/inngest/alertOnFailure";
import { dailyHealthCheck } from "@/inngest/dailyHealthCheck";


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
    refreshCharacter,
    reletterBook,
    reviseSingleSpread,
    generateCoverSpreadV5,
    analyseReferencePhoto,

    // Alerts: emails Katy whenever any function above fails for good
    alertOnFunctionFailure,
    dailyHealthCheck,       // 08:00 UK digest of anything stuck
  ],
});