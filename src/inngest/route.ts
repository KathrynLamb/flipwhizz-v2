// src/app/api/inngest/route.ts
import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { extractWorldJob, globalRewriteJob } from "@/inngest/functions";
import { generateStyleSample } from "@/inngest/generateStyle";
import { generateBookCovers } from "@/inngest/generateBookCovers";
import { generateBookSpreads, generateSingleSpread } from "@/inngest/generateSpreads";
import { generateSpreadImages } from "@/inngest/generateSpreadImages.phaseB";
import { decideSpreadScenes } from "@/inngest/decideSpreadScenes";
import { buildSpreads } from "@/inngest/buildSpreads";


export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    globalRewriteJob,
    extractWorldJob,
    decideSpreadScenes,
    generateStyleSample,
    generateBookSpreads,
    generateSingleSpread,
    generateBookCovers,
    generateSpreadImages, 
    buildSpreads, 
    
  ],
});