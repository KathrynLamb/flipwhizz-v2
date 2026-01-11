// src/app/api/inngest/route.ts
import { serve } from "inngest/next";
import { inngest } from "@/inngest/client"; // ✅ MUST be your client.ts

import { globalRewriteJob, extractWorldJob } from "@/inngest/functions";
import { buildSpreadsJob } from "@/inngest/buildSpreads";

import { generateStyleSample } from "@/inngest/generateStyle";
import {
  generateBookSpreads,
  generateSingleSpread,
} from "@/inngest/generateSpreads";
import {
  generateBookCovers,
  generateSingleCover,
  generateWrapAroundCover,
} from "@/inngest/generateBookCovers";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    globalRewriteJob,
    extractWorldJob,
    buildSpreadsJob,

    generateStyleSample,
    generateBookSpreads,
    generateSingleSpread,
    generateBookCovers,
    generateSingleCover,
    generateWrapAroundCover,
  ],
});
