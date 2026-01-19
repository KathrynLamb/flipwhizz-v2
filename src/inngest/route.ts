// src/app/api/inngest/route.ts
import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { extractWorldJob, globalRewriteJob } from "@/inngest/functions";
// import { buildSpreadsJob } from "@/inngest/buildSpreads.phaseA";
import { generateStyleSample } from "@/inngest/generateStyle";
import { generateBookCovers } from "@/inngest/generateBookCovers";
import { generateBookSpreads, generateSingleSpread } from "@/inngest/generateSpreads";
import { buildSpreadsPhaseA } from "@/inngest/buildSpreads.phaseA";
import { generateSpreadImages } from "@/inngest/generateSpreadImages.phaseB";


export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    globalRewriteJob,
    extractWorldJob,
    // buildSpreadsJob,
    buildSpreadsPhaseA,
    generateStyleSample,
    generateBookSpreads,
    generateSingleSpread,
    generateBookCovers,
    generateSpreadImages, 
  ],
});