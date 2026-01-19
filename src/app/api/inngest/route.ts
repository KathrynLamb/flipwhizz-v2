// // src/app/api/inngest/route.ts
// import { serve } from "inngest/next";
// import { inngest } from "@/inngest/client";

// // Core Logic
// import { globalRewriteJob, extractWorldJob } from "@/inngest/functions";
// import { buildSpreadsPhaseA } from "@/inngest/buildSpreads.phaseA";


// // Visuals
// import { generateStyleSample } from "@/inngest/generateStyle";
// import { generateBookSpreads, generateSingleSpread } from "@/inngest/generateSpreads";
// import { generateBookCovers } from "@/inngest/generateBookCovers";

// export const { GET, POST, PUT } = serve({
//   client: inngest,
//   functions: [
//     globalRewriteJob,
//     extractWorldJob,
//     buildSpreadsJob,
//     generateStyleSample,
//     generateBookSpreads,
//     generateSingleSpread,
//     generateBookCovers,
//   ],
// });

// src/app/api/inngest/route.ts
import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";

// Core logic
import { globalRewriteJob, extractWorldJob } from "@/inngest/functions";
import { buildSpreadsPhaseA } from "@/inngest/buildSpreads.phaseA";

// Visuals
import { generateStyleSample } from "@/inngest/generateStyle";
import { generateSpreadImages } from "@/inngest/generateSpreadImages.phaseB";
import { generateBookSpreads, generateSingleSpread } from "@/inngest/generateSpreads";
import { generateBookCovers } from "@/inngest/generateBookCovers";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    globalRewriteJob,
    extractWorldJob,
    buildSpreadsPhaseA,     // ✅ correct name
    generateStyleSample,
    generateSpreadImages,  // ✅ Phase B registered
    generateBookSpreads,
    generateSingleSpread,
    generateBookCovers,
  ],
});
