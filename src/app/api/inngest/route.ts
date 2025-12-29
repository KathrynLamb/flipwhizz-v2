import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { globalRewriteJob, extractWorldJob } from "@/inngest/functions";
import { generateStyleSample } from "@/inngest/generateStyle"; // 👈 Import new function
import { generateBookSpreads, generateSingleSpread } from "@/inngest/generateSpreads"; // Import new
import { generateBookCovers, generateSingleCover, generateWrapAroundCover } from "@/inngest/generateBookCovers";


export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    globalRewriteJob,
    extractWorldJob,
    generateStyleSample,
    generateBookSpreads, // The Manager
    generateSingleSpread, 
    generateBookCovers,
    generateSingleCover,
    generateWrapAroundCover,
  ],
});


// import { serve } from "inngest/next";
// import { inngest } from "@/inngest/client";

// // Import existing functions
// import { 
//   generateBookSpreads, 
//   generateSingleSpread 
// } from "@/inngest/generateSpreads";

// import { generateStyleSample } from "@/inngest/generateStyleSample";
// import { extractWorldJob } from "@/inngest/extractWorld";
// import { globalRewriteJob } from "@/inngest/globalRewrite";

// // Import NEW cover functions
// import { 
//   generateBookCovers, 
//   generateSingleCover,
//   generateWrapAroundCover 
// } from "@/inngest/generateCovers";

// // Register ALL functions
// export const { GET, POST, PUT } = serve({
//   client: inngest,
//   functions: [
//     // Existing functions
//     extractWorldJob,
//     generateBookSpreads,
//     generateSingleSpread,
//     generateStyleSample,
//     globalRewriteJob,
    
//     // NEW cover functions
//     generateBookCovers,
//     generateSingleCover,
//     generateWrapAroundCover,
//   ],
// });