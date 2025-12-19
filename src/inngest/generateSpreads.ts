// import { inngest } from "./client";
// import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from "@google/genai";
// import { eq, inArray, asc } from "drizzle-orm";
// import { storyPages, storyStyleGuide } from "@/db/schema";
// import { db } from "@/db";
// import { v2 as cloudinary } from "cloudinary";
// import { Readable } from "node:stream";
// import { v4 as uuid } from "uuid";

// cloudinary.config({
//     cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
//     api_key: process.env.CLOUDINARY_API_KEY!,
//     api_secret: process.env.CLOUDINARY_API_SECRET!,
//   });
  

// const client = new GoogleGenAI({ 
//   apiKey: process.env.GEMINI_API_KEY,
//   apiVersion: "v1alpha"
// });

// // --- HELPERS ---
// async function fetchImageAsBase64(url: string) {
//     try {
//       const res = await fetch(url);
//       if (!res.ok) throw new Error(`Failed to fetch: ${res.statusText}`);
//       const arrayBuffer = await res.arrayBuffer();
//       const buffer = Buffer.from(arrayBuffer);
//       return {
//         data: buffer.toString("base64"),
//         mimeType: "image/jpeg",
//       };
//     } catch (e) {
//       console.error("❌ Fetch failed for", url, e);
//       return null;
//     }
//   }
  
//   async function saveImageToStorage(base64Data: string, mimeType: string, storyId: string) {
//     console.log("☁️ Uploading to Cloudinary...");
//     const buffer = Buffer.from(base64Data, "base64");
//     const result: any = await new Promise((resolve, reject) => {
//       const stream = cloudinary.uploader.upload_stream(
//         {
//           folder: `flipwhizz/style-samples/${storyId}`,
//           filename_override: uuid(),
//           resource_type: "image",
//         },
//         (err, res) => {
//           if (err) reject(err);
//           else resolve(res);
//         }
//       );
//       Readable.from(buffer).pipe(stream);
//     });
//     console.log("✅ Cloudinary URL:", result.secure_url);
//     return result.secure_url as string;
//   }
  
//   function extractInlineImage(result: any) {
//     const parts = result.candidates?.[0]?.content?.parts || [];
//     const thinking = parts.find((p: any) => p.text)?.text;
//     if (thinking) console.log("🤖 Gemini Thought Process:", thinking.substring(0, 150) + "...");
    
//     const imagePart = parts.find((p: any) => p.inlineData?.data);
//     return imagePart?.inlineData
//       ? { data: imagePart.inlineData.data, mimeType: imagePart.inlineData.mimeType }
//       : null;
//   }
  
// export const generateBookSpreads = inngest.createFunction(
//   { 
//     id: "generate-book-spreads",
//     // We run 3 spreads at a time to be fast but safe
//     concurrency: 3, 
//     // If one fails, retry it up to 2 times
//     retries: 2
//   },
//   { event: "story/generate.spreads" },
//   async ({ event, step }) => {
//     const { storyId } = event.data;

//     // 1. Fetch Data
//     const { pages, style } = await step.run("fetch-story-data", async () => {
//       const p = await db.query.storyPages.findMany({
//         where: eq(storyPages.storyId, storyId),
//         orderBy: asc(storyPages.pageNumber),
//       });
      
//       const s = await db.query.storyStyleGuide.findFirst({
//         where: eq(storyStyleGuide.storyId, storyId)
//       });

//       if (!s) throw new Error("No style guide found");
//       return { pages: p, style: s };
//     });

//     // 2. Group Pages into Spreads ( [1,2], [3,4], [5,6] ... )
//     const spreadGroups = [];
//     for (let i = 0; i < pages.length; i += 2) {
//       spreadGroups.push(pages.slice(i, i + 2));
//     }

//     // 3. Dispatch Events for EACH Spread
//     // We don't generate here directly to avoid timeouts. We dispatch "sub-jobs".
//     const events = spreadGroups.map((group) => {
//         // If it's the last odd page, handle it alone, otherwise pair them
//         const leftPage = group[0];
//         const rightPage = group[1] || null; // Might be null if odd number of pages

//         return {
//             name: "story/generate.single.spread",
//             data: {
//                 storyId,
//                 styleSummary: style.summary,
//                 styleImage: style.sampleIllustrationUrl, // Use the generated sample as the "Truth"
//                 leftPageId: leftPage.id,
//                 leftText: leftPage.text,
//                 rightPageId: rightPage?.id,
//                 rightText: rightPage?.text,
//                 pageNumbers: `${leftPage.pageNumber}-${rightPage ? rightPage.pageNumber : 'end'}`
//             }
//         };
//     });

//     if (events.length > 0) {
//         await step.sendEvent("dispatch-spread-workers", events);
//     }

//     return { spreadsQueued: events.length };
//   }
// );

// // --- THE WORKER THAT GENERATES ONE SPREAD ---
// // --- THE WORKER THAT GENERATES ONE SPREAD (TEXT-IN-IMAGE VERSION) ---
// export const generateSingleSpread = inngest.createFunction(
//   {
//     id: "generate-single-spread",
//     // Concurrency allowed to be higher as this is mostly IO waiting on Gemini
//     concurrency: 8,
//   },
//   { event: "story/generate.single.spread" },
//   async ({ event, step }) => {
//     const {
//       storyId,
//       styleSummary,
//       styleImage,
//       leftPageId,
//       leftText,
//       rightPageId,
//       rightText,
//       pageNumbers,
//     } = event.data;

//     const imageUrl = await step.run("generate-image", async () => {
//       // 1. Prepare Style Reference
//       let parts: any[] = [];

//       // Use the Sample Image as the absolute style anchor
//       if (styleImage) {
//         // Assuming fetchImageAsBase64 is available in scope
//         const imgData = await fetchImageAsBase64(styleImage);
//         if (imgData) {
//           parts.push({
//             text: "ART & TYPOGRAPHY STYLE REFERENCE (Follow the illustration and text styling of this image):",
//           });
//           parts.push({ inlineData: imgData });
//         }
//       }

//       // 2. The Optimized Prompt for Text-In-Image
//       const textPrompt = `You are a master children's book Illustrator and Typographer.

// TASK: Create a complete double-page spread illustration that **incorporates the story text directly into the artwork as stylized typography.**

// STYLE DEFINITION: ${styleSummary}

// ***

// MANDATORY TEXT CONTENT (Crucial Requirements):
// 1. You MUST render the "Exact Story Text" provided below onto the final image.
// 2. Do not alter, summarize, or misspell the story text.
// 3. Place the 'Left Page Text' on the left half of the image.
// 4. Place the 'Right Page Text' on the right half of the image.

// <Left_Page_Text_Block>
// ${leftText}
// </Left_Page_Text_Block>

// <Right_Page_Text_Block>
// ${rightText ? rightText : "(No text for this page)"}
// </Right_Page_Text_Block>

// ***

// CREATIVE TYPOGRAPHY & DESIGN INSTRUCTIONS:
// - **Integration:** The main story text should not just be plastered on top. It should feel part of the world. (e.g., If the scene is spooky, use a slightly spooky, hand-drawn font. If it's whimsical, use playful lettering).
// - **Readability:** While stylized, the main story text MUST remain easily readable by a child. Ensure high contrast against the background.
// - **EXTRA TEXT ELEMENTS (Highly Encouraged):** Please enhance the scene by adding extra textual details into the environment where appropriate. Examples:
//     - Sound effects integrated into the action (e.g., "WHOOSH", "CREAK!", "POP!").
//     - Labels on objects, signs in the background, posters on walls, or magical glowing runes that fit the context of the story.

// LAYOUT & COMPOSITION:
// - Create ONE wide horizontal image (approx 2:1 aspect ratio) meant to be split down the center.
// - Ensure the left scene and right scene flow together seamlessly across the spine.
// - Do not place crucial text exactly on the center vertical line where the book folds.

// Generate the complete, text-integrated illustration now.
// `;

//       parts.push({ text: textPrompt });

//       // 3. Generate with Gemini Pro Vision
//       // Using a robust model version for complex instruction following + text rendering.
//       // 'gemini-1.5-pro-latest' or similar highly capable model is recommended here.
//       const response = await client.models.generateContent({
//         model: "gemini-1.5-pro-latest", 
//         contents: [{ role: "user", parts }],
//         // We only want an image back
//         config: { responseModalities: ["IMAGE"] },
//       });

//       const output = extractInlineImage(response);
//       if (!output)
//         throw new Error(
//           "Gemini did not return an image. It may have triggered a safety filter or failed to follow instructions."
//         );

//       // 4. Upload to Cloudinary
//       // Assuming saveImageToStorage is available in scope
//       return await saveImageToStorage(output.data, output.mimeType, storyId);
//     });

//     // 5. Update DB (Save same URL to both pages)
//     await step.run("save-to-db", async () => {
//       const idsToUpdate = [leftPageId];
//       if (rightPageId) idsToUpdate.push(rightPageId);

//       await db
//         .update(storyPages)
//         .set({ imageUrl: imageUrl }) // Same image for both sides of the spread
//         .where(inArray(storyPages.id, idsToUpdate));
//     });

//     return { success: true, pages: pageNumbers };
//   }
// );


import { inngest } from "./client";
import { GoogleGenAI } from "@google/genai";
import { eq, inArray, asc } from "drizzle-orm";
import { storyPages, storyStyleGuide } from "@/db/schema";
import { db } from "@/db";
import { v2 as cloudinary } from "cloudinary";
import { Readable } from "node:stream";
import { v4 as uuid } from "uuid";

// --- CONFIGURATION ---
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
  api_key: process.env.CLOUDINARY_API_KEY!,
  api_secret: process.env.CLOUDINARY_API_SECRET!,
});

const client = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  apiVersion: "v1alpha",
});

// The specific model ID requested
const GEMINI_IMAGE_MODEL = "gemini-3-pro-image-preview";

// --- HELPERS ---
async function fetchImageAsBase64(url: string) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch: ${res.statusText}`);
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    return {
      data: buffer.toString("base64"),
      mimeType: "image/jpeg",
    };
  } catch (e) {
    console.error("❌ Fetch failed for", url, e);
    return null;
  }
}

async function saveImageToStorage(
  base64Data: string,
  mimeType: string,
  storyId: string
) {
  console.log("☁️ Uploading to Cloudinary...");
  const buffer = Buffer.from(base64Data, "base64");
  const result: any = await new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: `flipwhizz/style-samples/${storyId}`,
        filename_override: uuid(),
        resource_type: "image",
      },
      (err, res) => {
        if (err) reject(err);
        else resolve(res);
      }
    );
    Readable.from(buffer).pipe(stream);
  });
  console.log("✅ Cloudinary URL:", result.secure_url);
  return result.secure_url as string;
}

function extractInlineImage(result: any) {
  const parts = result.candidates?.[0]?.content?.parts || [];
  // Optional: log thinking process if available
  // const thinking = parts.find((p: any) => p.text)?.text;
  // if (thinking) console.log("🤖 Gemini Thought Process:", thinking.substring(0, 150) + "...");

  const imagePart = parts.find((p: any) => p.inlineData?.data);
  return imagePart?.inlineData
    ? { data: imagePart.inlineData.data, mimeType: imagePart.inlineData.mimeType }
    : null;
}

// --- MAIN ORCHESTRATOR FUNCTION ---
export const generateBookSpreads = inngest.createFunction(
  {
    id: "generate-book-spreads",
    concurrency: 3,
    retries: 2,
  },
  { event: "story/generate.spreads" },
  async ({ event, step }) => {
    const { storyId } = event.data;

    // 1. Fetch Data
    const { pages, style } = await step.run("fetch-story-data", async () => {
      const p = await db.query.storyPages.findMany({
        where: eq(storyPages.storyId, storyId),
        orderBy: asc(storyPages.pageNumber),
      });

      const s = await db.query.storyStyleGuide.findFirst({
        where: eq(storyStyleGuide.storyId, storyId),
      });

      if (!s) throw new Error("No style guide found");
      return { pages: p, style: s };
    });

    // 2. Group Pages into Spreads ( [1,2], [3,4], [5,6] ... )
    const spreadGroups = [];
    for (let i = 0; i < pages.length; i += 2) {
      spreadGroups.push(pages.slice(i, i + 2));
    }

    // 3. Dispatch Events for EACH Spread
    const events = spreadGroups.map((group) => {
      const leftPage = group[0];
      const rightPage = group[1] || null;

      return {
        name: "story/generate.single.spread",
        data: {
          storyId,
          styleSummary: style.summary,
          styleImage: style.sampleIllustrationUrl,
          leftPageId: leftPage.id,
          leftText: leftPage.text,
          rightPageId: rightPage?.id,
          rightText: rightPage?.text,
          pageNumbers: `${leftPage.pageNumber}-${
            rightPage ? rightPage.pageNumber : "end"
          }`,
        },
      };
    });

    if (events.length > 0) {
      await step.sendEvent("dispatch-spread-workers", events);
    }

    return { spreadsQueued: events.length };
  }
);

// --- THE WORKER THAT GENERATES ONE SPREAD (TEXT-IN-IMAGE VERSION) ---
export const generateSingleSpread = inngest.createFunction(
  {
    id: "generate-single-spread",
    // Concurrency allowed to be higher as this is mostly IO waiting on Gemini
    concurrency: 8,
  },
  { event: "story/generate.single.spread" },
  async ({ event, step }) => {
    const {
      storyId,
      styleSummary,
      styleImage,
      leftPageId,
      leftText,
      rightPageId,
      rightText,
      pageNumbers,
    } = event.data;

    const imageUrl = await step.run("generate-image", async () => {
      // 1. Prepare Style Reference
      let parts: any[] = [];

      if (styleImage) {
        const imgData = await fetchImageAsBase64(styleImage);
        if (imgData) {
          parts.push({
            text: "ART & TYPOGRAPHY STYLE REFERENCE (Follow the illustration and text styling of this image accurately):",
          });
          parts.push({ inlineData: imgData });
        }
      }

      // 2. The Prompt designed for integrating text into the image
      const textPrompt = `You are a master children's book Illustrator and Typographer.

TASK: Create a complete double-page spread illustration that **incorporates the story text directly into the artwork as stylized typography.**

STYLE DEFINITION: ${styleSummary}

***

MANDATORY TEXT CONTENT (Crucial Requirements):
1. You MUST render the exact "Story Text" provided below onto the final image.
2. Do not alter, summarize, or misspell the story text.
3. Place the 'Left Page Text' on the left half of the image.
4. Place the 'Right Page Text' on the right half of the image.

<Left_Page_Text_Block>
${leftText}
</Left_Page_Text_Block>

<Right_Page_Text_Block>
${rightText ? rightText : "(No text for this page)"}
</Right_Page_Text_Block>

***

CREATIVE TYPOGRAPHY & DESIGN INSTRUCTIONS:
- **Integration:** The main story text should feel part of the world (e.g., painted onto a wall, formed by clouds, or just stylized magically in open space).
- **Readability:** The text MUST remain easily readable by a child. Ensure high contrast against the background.
- **Bonus Elements:** Enhance the scene by adding sound effects (e.g., "WHOOSH", "POP!") or environmental text (signs, labels) that fit the context.

LAYOUT & COMPOSITION:
- Create ONE wide horizontal image (approx 2:1 aspect ratio) meant to be split down the center.
- Ensure the left scene and right scene flow together seamlessly across the central spine.
- Do not place crucial text exactly on the center vertical line where the book folds.

Generate the complete, text-integrated illustration now.
`;

      parts.push({ text: textPrompt });

      // 3. Generate with the requested Gemini model
      const response = await client.models.generateContent({
        model: GEMINI_IMAGE_MODEL,
        contents: [{ role: "user", parts }],
        // We explicitly request only an image back
        config: { responseModalities: ["IMAGE"] },
      });

      const output = extractInlineImage(response);
      if (!output)
        throw new Error(
          "Gemini did not return an image. It may have failed to generate or was blocked."
        );

      // 4. Upload to Cloudinary
      return await saveImageToStorage(output.data, output.mimeType, storyId);
    });

    // 5. Update DB (Save same URL to both pages of the spread)
    await step.run("save-to-db", async () => {
      const idsToUpdate = [leftPageId];
      if (rightPageId) idsToUpdate.push(rightPageId);

      await db
        .update(storyPages)
        .set({ imageUrl: imageUrl })
        .where(inArray(storyPages.id, idsToUpdate));
    });

    return { success: true, pages: pageNumbers };
  }
);