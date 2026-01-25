// // src/app/api/inngest/route.ts
// import { serve } from "inngest/next";
// import { inngest } from "@/inngest/client";
// import { extractWorldJob, globalRewriteJob } from "@/inngest/functions";
// import { generateStyleSample } from "@/inngest/generateStyle";
// import { generateBookCovers } from "@/inngest/generateBookCovers";

// // import { generateSpreadImages } from "@/inngest/generateSpreadImages.phaseB";
// import { decideSpreadScenes } from "@/inngest/decideSpreadScenes";
// import { buildSpreads } from "@/inngest/buildSpreads";
// import { generateBookSpreads } from "@/inngest/generateSpreads";
// import { generateSingleSpread } from "@/inngest/generateSpreadImages.phaseB";
// // import { 
// //   generateBookSpreads, 
// //   generateSingleSpread 
// // } from "@/inngest/generateBookSpreads"; 


// export const { GET, POST, PUT } = serve({
//   client: inngest,
//   functions: [
//     globalRewriteJob,
//     extractWorldJob,
//     decideSpreadScenes,
//     generateStyleSample,
//     generateBookSpreads,
//     generateSingleSpread,
//     generateBookCovers,
//     // generateSpreadImages, 
//     buildSpreads, 
    
//   ],
// });


// src/app/api/inngest/route.ts
import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";

// Core text / structure
import { globalRewriteJob, extractWorldJob } from "@/inngest/functions";
import { buildSpreads } from "@/inngest/buildSpreads";
import { decideSpreadScenes } from "@/inngest/decideSpreadScenes";

// Visual generation
import { generateStyleSample } from "@/inngest/generateStyle";
import { generateBookSpreads } from "@/inngest/generateSpreads";
import { generateSingleSpread } from "@/inngest/generateSingleSpread";
import { reviseSingleSpread } from "@/inngest/reviseSingleSpread";
import { generateBookCovers } from "@/inngest/generateBookCovers";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    // Core narrative pipeline
    globalRewriteJob,
    extractWorldJob,
    buildSpreads,
    decideSpreadScenes,

    // Visuals
    generateStyleSample,
    generateBookSpreads,
    generateSingleSpread,
    reviseSingleSpread,
    generateBookCovers,
  ],
});
