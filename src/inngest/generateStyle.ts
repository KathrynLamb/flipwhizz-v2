// import { inngest } from "./client";
// import { GoogleGenAI } from "@google/genai";
// import { eq, asc } from "drizzle-orm";
// import { db } from "@/db";
// import { storyPages, storyStyleGuide } from "@/db/schema";
// import { v2 as cloudinary } from "cloudinary";
// import { Readable } from "node:stream";
// import { v4 as uuid } from "uuid";

// /* ------------------------------------------------------------------
//    CONFIG
// ------------------------------------------------------------------ */

// cloudinary.config({
//   cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
//   api_key: process.env.CLOUDINARY_API_KEY!,
//   api_secret: process.env.CLOUDINARY_API_SECRET!,
// });

// const client = new GoogleGenAI({
//   apiKey: process.env.GEMINI_API_KEY!,
//   apiVersion: "v1alpha",
// });

// // Using the same model you requested for consistency
// const MODEL = "gemini-3-pro-image-preview";

// /* ------------------------------------------------------------------
//    HELPERS
// ------------------------------------------------------------------ */

// async function fetchImageAsBase64(url: string) {
//   try {
//     const res = await fetch(url);
//     if (!res.ok) throw new Error(`Failed to fetch ${url}`);
//     const buffer = Buffer.from(await res.arrayBuffer());
//     return { data: buffer.toString("base64"), mimeType: "image/jpeg" };
//   } catch (e) {
//     console.error("Failed to fetch reference image:", url);
//     return null;
//   }
// }

// async function uploadImage(base64: string, storyId: string) {
//   const buffer = Buffer.from(base64, "base64");

//   const result: any = await new Promise((resolve, reject) => {
//     const stream = cloudinary.uploader.upload_stream(
//       {
//         folder: `flipwhizz/style-samples/${storyId}`,
//         filename_override: uuid(),
//         resource_type: "image",
//       },
//       (err, res) => (err ? reject(err) : resolve(res))
//     );

//     Readable.from(buffer).pipe(stream);
//   });

//   return result.secure_url as string;
// }

// function extractImage(result: any) {
//   const candidate = result?.candidates?.[0];
//   const parts = candidate?.content?.parts ?? [];
//   const imagePart = parts.find((p: any) => p.inlineData?.data);
  
//   if (imagePart?.inlineData) {
//     return imagePart.inlineData;
//   }

//   // Debugging Safety Blocks
//   if (candidate?.finishReason && candidate.finishReason !== "STOP") {
//     console.error("⚠️ Gemini Blocked. Reason:", candidate.finishReason);
//     if (candidate.safetyRatings) {
//       console.error("⚠️ Safety Ratings:", JSON.stringify(candidate.safetyRatings, null, 2));
//     }
//   }

//   return null;
// }

// /* ------------------------------------------------------------------
//    MAIN EXPORT: generateStyleSample
// ------------------------------------------------------------------ */

// export const generateStyleSample = inngest.createFunction(
//   { id: "generate-style-sample", concurrency: 1 },
//   { event: "style/generate.sample" },
//   async ({ event, step }) => {
//     const { storyId, references = [], force = false } = event.data;

//     if (!storyId) throw new Error("Missing storyId");

//     /* --------------------------------------------------
//        LOAD STORY TEXT (FIRST 2 PAGES)
//     -------------------------------------------------- */

//     const pages = await db.query.storyPages.findMany({
//       where: eq(storyPages.storyId, storyId),
//       orderBy: asc(storyPages.pageNumber),
//       limit: 2,
//     });

//     if (!pages.length) throw new Error("No story pages found");

//     const leftText = pages[0]?.text ?? "";
//     const rightText = pages[1]?.text ?? "";

//     /* --------------------------------------------------
//        CHECK EXISTING
//     -------------------------------------------------- */

//     const existing = await db.query.storyStyleGuide.findFirst({
//       where: eq(storyStyleGuide.storyId, storyId),
//     });

//     if (existing?.sampleIllustrationUrl && !force) {
//       return { skipped: true, url: existing.sampleIllustrationUrl };
//     }

//     if (force) {
//       await db
//         .update(storyStyleGuide)
//         .set({ sampleIllustrationUrl: null })
//         .where(eq(storyStyleGuide.storyId, storyId));
//     }

//     /* --------------------------------------------------
//        BUILD PROMPT
//     -------------------------------------------------- */

//     const parts: any[] = [];

//     // Attach references
//     for (const ref of references) {
//       if (!ref.url) continue;
//       const img = await fetchImageAsBase64(ref.url);
//       if (img) {
//         parts.push({
//           text: ref.type === "style"
//             ? "PRIMARY ART STYLE REFERENCE. Follow this style exactly."
//             : `CHARACTER REFERENCE: ${ref.label}`,
//         });
//         parts.push({ inlineData: img });
//       }
//     }

//     // Main prompt
//     parts.push({
//       text: `
// You are a professional children's book illustrator.
// TASK: Create ONE COMPLETE DOUBLE-PAGE SPREAD (2:1 aspect ratio).

// LEFT PAGE TEXT: "${leftText}"
// RIGHT PAGE TEXT: "${rightText}"

// REQUIREMENTS:
// 1. Render the text clearly into the image (Typography).
// 2. Follow the art style of the reference images provided.
// 3. Left text on left side, Right text on right side.
// `,
//     });

//     /* --------------------------------------------------
//        GENERATE
//     -------------------------------------------------- */

//     const imageUrl = await step.run("generate-sample-spread", async () => {
//       console.log(`🤖 Generating sample with ${MODEL}…`);

//       const response = await client.models.generateContent({
//         model: MODEL,
//         contents: [{ role: "user", parts }],
//         config: { 
//           responseModalities: ["IMAGE"],
//           // CRITICAL SAFETY SETTINGS
//           safetySettings: [
//             { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
//             { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
//             { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_ONLY_HIGH" },
//             { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" },
//             { category: "HARM_CATEGORY_CIVIC_INTEGRITY", threshold: "BLOCK_ONLY_HIGH" }
//           ]
//         },
//       });

//       const image = extractImage(response);
//       if (!image) throw new Error("No image returned from Gemini (likely safety block)");

//       return uploadImage(image.data, storyId);
//     });

//     /* --------------------------------------------------
//        SAVE
//     -------------------------------------------------- */

//     await db
//       .update(storyStyleGuide)
//       .set({
//         sampleIllustrationUrl: imageUrl,
//         updatedAt: new Date(),
//       })
//       .where(eq(storyStyleGuide.storyId, storyId));

//     return { success: true, url: imageUrl };
//   }
// );

import { inngest } from "./client";
import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { eq, asc } from "drizzle-orm";
import { db } from "@/db";
import { storyPages, storyStyleGuide } from "@/db/schema";
import { v2 as cloudinary } from "cloudinary";
import { Readable } from "node:stream";
import { v4 as uuid } from "uuid";

/* ------------------------------------------------------------------
   CONFIG
------------------------------------------------------------------ */

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
  api_key: process.env.CLOUDINARY_API_KEY!,
  api_secret: process.env.CLOUDINARY_API_SECRET!,
});

const client = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
  apiVersion: "v1alpha",
});

const MODEL = "gemini-3-pro-image-preview";

/* ------------------------------------------------------------------
   HELPERS
------------------------------------------------------------------ */

async function fetchImageAsBase64(url: string) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch ${url}`);
    const buffer = Buffer.from(await res.arrayBuffer());
    return { data: buffer.toString("base64"), mimeType: "image/jpeg" };
  } catch (e) {
    console.error("Failed to fetch reference image:", url);
    return null;
  }
}

async function uploadImage(base64: string, storyId: string) {
  const buffer = Buffer.from(base64, "base64");

  const result: any = await new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: `flipwhizz/style-samples/${storyId}`,
        filename_override: uuid(),
        resource_type: "image",
      },
      (err, res) => (err ? reject(err) : resolve(res))
    );

    Readable.from(buffer).pipe(stream);
  });

  return result.secure_url as string;
}

function extractImage(result: any) {
  const candidate = result?.candidates?.[0];
  const parts = candidate?.content?.parts ?? [];
  const imagePart = parts.find((p: any) => p.inlineData?.data);
  
  if (imagePart?.inlineData) {
    return imagePart.inlineData;
  }

  // Debugging Safety Blocks
  if (candidate?.finishReason && candidate.finishReason !== "STOP") {
    console.error("⚠️ Gemini Blocked. Reason:", candidate.finishReason);
    if (candidate.safetyRatings) {
      console.error("⚠️ Safety Ratings:", JSON.stringify(candidate.safetyRatings, null, 2));
    }
  }

  return null;
}

/* ------------------------------------------------------------------
   MAIN EXPORT: generateStyleSample
------------------------------------------------------------------ */

export const generateStyleSample = inngest.createFunction(
  { id: "generate-style-sample", concurrency: 1 },
  { event: "style/generate.sample" },
  async ({ event, step }) => {
    const { storyId, references = [], force = false } = event.data;

    if (!storyId) throw new Error("Missing storyId");

    /* --------------------------------------------------
       LOAD STORY TEXT (FIRST 2 PAGES)
    -------------------------------------------------- */

    const pages = await db.query.storyPages.findMany({
      where: eq(storyPages.storyId, storyId),
      orderBy: asc(storyPages.pageNumber),
      limit: 2,
    });

    if (!pages.length) throw new Error("No story pages found");

    const leftText = pages[0]?.text ?? "";
    const rightText = pages[1]?.text ?? "";

    /* --------------------------------------------------
       CHECK EXISTING
    -------------------------------------------------- */

    const existing = await db.query.storyStyleGuide.findFirst({
      where: eq(storyStyleGuide.storyId, storyId),
    });

    if (existing?.sampleIllustrationUrl && !force) {
      return { skipped: true, url: existing.sampleIllustrationUrl };
    }

    if (force) {
      await db
        .update(storyStyleGuide)
        .set({ sampleIllustrationUrl: null })
        .where(eq(storyStyleGuide.storyId, storyId));
    }

    /* --------------------------------------------------
       BUILD PROMPT
    -------------------------------------------------- */

    const parts: any[] = [];

    // Attach references
    for (const ref of references) {
      if (!ref.url) continue;
      const img = await fetchImageAsBase64(ref.url);
      if (img) {
        parts.push({
          text: ref.type === "style"
            ? "PRIMARY ART STYLE REFERENCE. Follow this style exactly."
            : `CHARACTER REFERENCE: ${ref.label}`,
        });
        parts.push({ inlineData: img });
      }
    }

    // Main prompt
    parts.push({
      text: `
You are a professional children's book illustrator.
TASK: Create ONE COMPLETE DOUBLE-PAGE SPREAD (2:1 aspect ratio).

LEFT PAGE TEXT: "${leftText}"
RIGHT PAGE TEXT: "${rightText}"

REQUIREMENTS:
1. Render the text clearly into the image (Typography).
2. Follow the art style of the reference images provided.
3. Left text on left side, Right text on right side.
`,
    });

    /* --------------------------------------------------
       GENERATE
    -------------------------------------------------- */

    const imageUrl = await step.run("generate-sample-spread", async () => {
      console.log(`🤖 Generating sample with ${MODEL}…`);

      const response = await client.models.generateContent({
        model: MODEL,
        contents: [{ role: "user", parts }],
        config: { 
          responseModalities: ["IMAGE"],
          // ✅ FIXED: Use the Enum values instead of raw strings
          safetySettings: [
            { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
            { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
            { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
            { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
          ]
        },
      });

      const image = extractImage(response);
      if (!image) throw new Error("No image returned from Gemini (likely safety block)");

      return uploadImage(image.data, storyId);
    });

    /* --------------------------------------------------
       SAVE
    -------------------------------------------------- */

    await db
      .update(storyStyleGuide)
      .set({
        sampleIllustrationUrl: imageUrl,
        updatedAt: new Date(),
      })
      .where(eq(storyStyleGuide.storyId, storyId));

    return { success: true, url: imageUrl };
  }
);