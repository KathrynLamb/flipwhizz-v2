// // // // import { inngest } from "./client";
// // // // import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from "@google/genai";
// // // // import { eq, inArray, asc } from "drizzle-orm";
// // // // import { 
// // // //   storyPages, 
// // // //   storyStyleGuide, 
// // // //   characters, 
// // // //   locations,
// // // //   storyCharacters,
// // // //   storyLocations
// // // // } from "@/db/schema";
// // // // import { db } from "@/db";
// // // // import { v2 as cloudinary } from "cloudinary";
// // // // import { Readable } from "node:stream";
// // // // import { v4 as uuid } from "uuid";

// // // // // --- CONFIGURATION ---
// // // // cloudinary.config({
// // // //   cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
// // // //   api_key: process.env.CLOUDINARY_API_KEY!,
// // // //   api_secret: process.env.CLOUDINARY_API_SECRET!,
// // // // });

// // // // const client = new GoogleGenAI({
// // // //   apiKey: process.env.GEMINI_API_KEY,
// // // //   apiVersion: "v1alpha",
// // // // });

// // // // const GEMINI_IMAGE_MODEL = "gemini-3-pro-image-preview";

// // // // // --- HELPERS ---
// // // // async function fetchImageAsBase64(url: string) {
// // // //   try {
// // // //     const res = await fetch(url);
// // // //     if (!res.ok) throw new Error(`Failed to fetch: ${res.statusText}`);
// // // //     const arrayBuffer = await res.arrayBuffer();
// // // //     const buffer = Buffer.from(arrayBuffer);
// // // //     return {
// // // //       data: buffer.toString("base64"),
// // // //       mimeType: "image/jpeg",
// // // //     };
// // // //   } catch (e) {
// // // //     console.error("❌ Fetch failed for", url, e);
// // // //     return null;
// // // //   }
// // // // }

// // // // async function saveImageToStorage(
// // // //   base64Data: string,
// // // //   mimeType: string,
// // // //   storyId: string
// // // // ) {
// // // //   const buffer = Buffer.from(base64Data, "base64");
// // // //   const result: any = await new Promise((resolve, reject) => {
// // // //     const stream = cloudinary.uploader.upload_stream(
// // // //       {
// // // //         folder: `flipwhizz/stories/${storyId}/spreads`,
// // // //         filename_override: uuid(),
// // // //         resource_type: "image",
// // // //       },
// // // //       (err, res) => {
// // // //         if (err) reject(err);
// // // //         else resolve(res);
// // // //       }
// // // //     );
// // // //     Readable.from(buffer).pipe(stream);
// // // //   });
// // // //   return result.secure_url as string;
// // // // }

// // // // function extractInlineImage(result: any) {
// // // //   const parts = result.candidates?.[0]?.content?.parts || [];
// // // //   const imagePart = parts.find((p: any) => p.inlineData?.data);
// // // //   return imagePart?.inlineData
// // // //     ? { data: imagePart.inlineData.data, mimeType: imagePart.inlineData.mimeType }
// // // //     : null;
// // // // }

// // // // // --- 1. ORCHESTRATOR: PREPARE DATA ---
// // // // export const generateBookSpreads = inngest.createFunction(
// // // //   {
// // // //     id: "generate-book-spreads",
// // // //     concurrency: 3,
// // // //     retries: 2,
// // // //   },
// // // //   { event: "story/generate.spreads" },
// // // //   async ({ event, step }) => {
// // // //     const { storyId } = event.data;

// // // //     // A. Fetch Pages, Style, Characters, and Locations
// // // //     const data = await step.run("fetch-story-data", async () => {
// // // //       const p = await db.query.storyPages.findMany({
// // // //         where: eq(storyPages.storyId, storyId),
// // // //         orderBy: asc(storyPages.pageNumber),
// // // //       });

// // // //       const s = await db.query.storyStyleGuide.findFirst({
// // // //         where: eq(storyStyleGuide.storyId, storyId),
// // // //       });

// // // //       // Fetch Characters via Join Table
// // // //       const c = await db
// // // //         .select({
// // // //           id: characters.id,
// // // //           name: characters.name,
// // // //           referenceImageUrl: characters.portraitImageUrl,
// // // //         })
// // // //         .from(storyCharacters)
// // // //         .innerJoin(characters, eq(storyCharacters.characterId, characters.id))
// // // //         .where(eq(storyCharacters.storyId, storyId));

// // // //       // Fetch Locations via Join Table
// // // //       const l = await db
// // // //         .select({
// // // //           id: locations.id,
// // // //           name: locations.name,
// // // //           referenceImageUrl: locations.portraitImageUrl,
// // // //         })
// // // //         .from(storyLocations)
// // // //         .innerJoin(locations, eq(storyLocations.locationId, locations.id))
// // // //         .where(eq(storyLocations.storyId, storyId));

// // // //       if (!s) throw new Error("No style guide found");

// // // //       return { 
// // // //         pages: p, 
// // // //         style: s,
// // // //         references: [
// // // //           ...c.filter(x => x.referenceImageUrl).map(x => ({ type: 'character', name: x.name, url: x.referenceImageUrl! })),
// // // //           ...l.filter(x => x.referenceImageUrl).map(x => ({ type: 'location', name: x.name, url: x.referenceImageUrl! }))
// // // //         ]
// // // //       };
// // // //     });

// // // //     const spreadGroups = [];
// // // //     for (let i = 0; i < data.pages.length; i += 2) {
// // // //       spreadGroups.push(data.pages.slice(i, i + 2));
// // // //     }

// // // //     const events = spreadGroups.map((group) => {
// // // //       const leftPage = group[0];
// // // //       const rightPage = group[1] || null;

// // // //       return {
// // // //         name: "story/generate.single.spread",
// // // //         data: {
// // // //           storyId,
// // // //           styleSummary: data.style.summary,
// // // //           styleImage: data.style.sampleIllustrationUrl,
// // // //           allReferences: data.references, 
// // // //           leftPageId: leftPage.id,
// // // //           leftText: leftPage.text,
// // // //           rightPageId: rightPage?.id,
// // // //           rightText: rightPage?.text,
// // // //           pageNumbers: `${leftPage.pageNumber}-${rightPage ? rightPage.pageNumber : "end"}`,
// // // //         },
// // // //       };
// // // //     });

// // // //     if (events.length > 0) {
// // // //       await step.sendEvent("dispatch-spread-workers", events);
// // // //     }

// // // //     return { spreadsQueued: events.length };
// // // //   }
// // // // );

// // // // // --- 2. WORKER: GENERATE WITH REFERENCES ---
// // // // export const generateSingleSpread = inngest.createFunction(
// // // //   {
// // // //     id: "generate-single-spread",
// // // //     concurrency: 8, 
// // // //     retries: 2, 
// // // //   },
// // // //   { event: "story/generate.single.spread" },
// // // //   async ({ event, step }) => {
// // // //     const {
// // // //       storyId,
// // // //       styleSummary,
// // // //       styleImage,
// // // //       allReferences = [],
// // // //       leftPageId,
// // // //       leftText,
// // // //       rightPageId,
// // // //       rightText,
// // // //       pageNumbers,
// // // //     } = event.data;

// // // //     const imageUrl = await step.run("generate-image", async () => {
// // // //       const parts: any[] = [];

// // // //       // A. ATTACH STYLE REFERENCE
// // // //       if (styleImage) {
// // // //         const imgData = await fetchImageAsBase64(styleImage);
// // // //         if (imgData) {
// // // //           parts.push({ text: "PRIMARY ART STYLE REFERENCE (Follow this style exactly):" });
// // // //           parts.push({ inlineData: imgData });
// // // //         }
// // // //       }

// // // //       // B. SMART REFERENCE INJECTION
// // // //       const fullText = `${leftText || ""} ${rightText || ""}`.toLowerCase();
// // // //       const relevantRefs = allReferences.filter((ref: any) => {
// // // //         return fullText.includes(ref.name.toLowerCase());
// // // //       });

// // // //       console.log(`Spread ${pageNumbers} Refs:`, relevantRefs.map((r: any) => r.name));

// // // //       for (const ref of relevantRefs) {
// // // //         if (ref.url) {
// // // //           const refImg = await fetchImageAsBase64(ref.url);
// // // //           if (refImg) {
// // // //             parts.push({ 
// // // //               text: `VISUAL REFERENCE FOR ${ref.type.toUpperCase()}: ${ref.name}` 
// // // //             });
// // // //             parts.push({ inlineData: refImg });
// // // //           }
// // // //         }
// // // //       }

// // // //       // C. BUILD PROMPT
// // // //       const textPrompt = `
// // // // You are a professional children's book illustrator.

// // // // TASK: Create a wide double-page spread (16:9).
// // // // STYLE: ${styleSummary}

// // // // SCENE CONTENT:
// // // // - Use the provided VISUAL REFERENCES for characters/locations mentioned in the text.
// // // // - Render the story text clearly into the layout.

// // // // LEFT PAGE TEXT:
// // // // "${leftText}"

// // // // RIGHT PAGE TEXT:
// // // // "${rightText || ""}"
// // // // `;

// // // //       parts.push({ text: textPrompt });

// // // //       // D. CALL GEMINI
// // // //       const response = await client.models.generateContent({
// // // //         model: GEMINI_IMAGE_MODEL,
// // // //         contents: [{ role: "user", parts }],
// // // //         config: { 
// // // //           responseModalities: ["IMAGE"],
// // // //           imageConfig: {
// // // //             aspectRatio: "16:9",
// // // //             imageSize: "2K"
// // // //           },
// // // //           safetySettings: [
// // // //             { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
// // // //             { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
// // // //             { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
// // // //             { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
// // // //           ]
// // // //         },
// // // //       });

// // // //       const output = extractInlineImage(response);
// // // //       if (!output) {
// // // //         throw new Error("Gemini returned no image.");
// // // //       }

// // // //       return await saveImageToStorage(output.data, output.mimeType, storyId);
// // // //     });

// // // //     // E. SAVE URL TO DB
// // // //     await step.run("save-to-db", async () => {
// // // //       const idsToUpdate = [leftPageId];
// // // //       if (rightPageId) idsToUpdate.push(rightPageId);

// // // //       await db
// // // //         .update(storyPages)
// // // //         .set({ imageUrl: imageUrl })
// // // //         .where(inArray(storyPages.id, idsToUpdate));
// // // //     });

// // // //     return { success: true, pages: pageNumbers, url: imageUrl };
// // // //   }
// // // // );

// // // import { inngest } from "./client";
// // // import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from "@google/genai";
// // // import { eq, inArray, asc } from "drizzle-orm";
// // // import { 
// // //   storyPages, 
// // //   storyStyleGuide, 
// // //   characters, 
// // //   locations,
// // //   storyCharacters,
// // //   storyLocations
// // // } from "@/db/schema";
// // // import { db } from "@/db";
// // // import { v2 as cloudinary } from "cloudinary";
// // // import { Readable } from "node:stream";
// // // import { v4 as uuid } from "uuid";

// // // // --- CONFIGURATION ---
// // // cloudinary.config({
// // //   cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
// // //   api_key: process.env.CLOUDINARY_API_KEY!,
// // //   api_secret: process.env.CLOUDINARY_API_SECRET!,
// // // });

// // // const client = new GoogleGenAI({
// // //   apiKey: process.env.GEMINI_API_KEY,
// // //   apiVersion: "v1alpha",
// // // });

// // // // Explicitly using the Pro Image Preview model for text rendering & consistency
// // // const GEMINI_IMAGE_MODEL = "gemini-3-pro-image-preview";

// // // // --- HELPERS ---

// // // async function getImagePart(urlOrBase64: string) {
// // //   try {
// // //     // 1. If it's already a Data URI (Base64 from DB)
// // //     if (urlOrBase64.startsWith("data:image")) {
// // //       const base64Data = urlOrBase64.split(",")[1];
// // //       return {
// // //         inlineData: {
// // //           data: base64Data,
// // //           mimeType: "image/jpeg",
// // //         },
// // //       };
// // //     }

// // //     // 2. If it's a remote URL (Cloudinary/S3)
// // //     const res = await fetch(urlOrBase64);
// // //     if (!res.ok) throw new Error(`Failed to fetch: ${res.statusText}`);
// // //     const arrayBuffer = await res.arrayBuffer();
// // //     const buffer = Buffer.from(arrayBuffer);
// // //     return {
// // //       inlineData: {
// // //         data: buffer.toString("base64"),
// // //         mimeType: "image/jpeg",
// // //       },
// // //     };
// // //   } catch (e) {
// // //     console.error("❌ Failed to process image reference", e);
// // //     return null;
// // //   }
// // // }

// // // async function saveImageToStorage(
// // //   base64Data: string,
// // //   mimeType: string,
// // //   storyId: string
// // // ) {
// // //   const buffer = Buffer.from(base64Data, "base64");
// // //   return new Promise<string>((resolve, reject) => {
// // //     const stream = cloudinary.uploader.upload_stream(
// // //       {
// // //         folder: `flipwhizz/stories/${storyId}/spreads`,
// // //         filename_override: uuid(),
// // //         resource_type: "image",
// // //       },
// // //       (err, res) => {
// // //         if (err) reject(err);
// // //         else resolve(res?.secure_url || "");
// // //       }
// // //     );
// // //     Readable.from(buffer).pipe(stream);
// // //   });
// // // }

// // // function extractInlineImage(result: any) {
// // //   const parts = result.candidates?.[0]?.content?.parts || [];
// // //   // Look for the part that has inlineData (image)
// // //   const imagePart = parts.find((p: any) => p.inlineData?.data);
// // //   return imagePart?.inlineData
// // //     ? { data: imagePart.inlineData.data, mimeType: imagePart.inlineData.mimeType }
// // //     : null;
// // // }

// // // // --- 1. ORCHESTRATOR ---
// // // export const generateBookSpreads = inngest.createFunction(
// // //   {
// // //     id: "generate-book-spreads",
// // //     concurrency: 5,
// // //     retries: 2,
// // //   },
// // //   { event: "story/generate.spreads" },
// // //   async ({ event, step }) => {
// // //     const { storyId } = event.data;

// // //     // A. Fetch Page Metadata (Lightweight)
// // //     const pages = await step.run("fetch-pages", async () => {
// // //       return await db.query.storyPages.findMany({
// // //         where: eq(storyPages.storyId, storyId),
// // //         orderBy: asc(storyPages.pageNumber),
// // //         columns: {
// // //           id: true,
// // //           pageNumber: true,
// // //         }
// // //       });
// // //     });

// // //     const spreadGroups = [];
// // //     for (let i = 0; i < pages.length; i += 2) {
// // //       spreadGroups.push(pages.slice(i, i + 2));
// // //     }

// // //     const events = spreadGroups.map((group) => {
// // //       const leftPage = group[0];
// // //       const rightPage = group[1] || null;

// // //       return {
// // //         name: "story/generate.single.spread",
// // //         data: {
// // //           storyId,
// // //           leftPageId: leftPage.id,
// // //           rightPageId: rightPage?.id,
// // //           pageLabel: `${leftPage.pageNumber}-${rightPage ? rightPage.pageNumber : "end"}`,
// // //         },
// // //       };
// // //     });

// // //     if (events.length > 0) {
// // //       await step.sendEvent("dispatch-spread-workers", events);
// // //     }

// // //     return { spreadsQueued: events.length };
// // //   }
// // // );

// // // // --- 2. WORKER ---
// // // export const generateSingleSpread = inngest.createFunction(
// // //   {
// // //     id: "generate-single-spread",
// // //     concurrency: 4, 
// // //     retries: 2, 
// // //   },
// // //   { event: "story/generate.single.spread" },
// // //   async ({ event, step }) => {
// // //     const {
// // //       storyId,
// // //       leftPageId,
// // //       rightPageId,
// // //       pageLabel
// // //     } = event.data;

// // //     // FETCH & GENERATE IN ONE STEP (To avoid passing huge Base64 strings in step output)
// // //     const imageUrl = await step.run("generate-and-upload", async () => {
      
// // //       // 1. DATABASE FETCH
// // //       const left = await db.query.storyPages.findFirst({
// // //         where: eq(storyPages.id, leftPageId),
// // //         columns: { text: true }
// // //       });
// // //       const right = rightPageId ? await db.query.storyPages.findFirst({
// // //         where: eq(storyPages.id, rightPageId),
// // //         columns: { text: true }
// // //       }) : null;

// // //       const style = await db.query.storyStyleGuide.findFirst({
// // //         where: eq(storyStyleGuide.storyId, storyId),
// // //       });

// // //       const c = await db
// // //         .select({
// // //           name: characters.name,
// // //           imageUrl: characters.portraitImageUrl,
// // //           description: characters.description,
// // //         })
// // //         .from(storyCharacters)
// // //         .innerJoin(characters, eq(storyCharacters.characterId, characters.id))
// // //         .where(eq(storyCharacters.storyId, storyId));

// // //       const l = await db
// // //         .select({
// // //           name: locations.name,
// // //           imageUrl: locations.portraitImageUrl,
// // //         })
// // //         .from(storyLocations)
// // //         .innerJoin(locations, eq(storyLocations.locationId, locations.id))
// // //         .where(eq(storyLocations.storyId, storyId));

// // //       // 2. CONSTRUCT PAYLOAD
// // //       const parts: any[] = [];
      
// // //       // -- A. Style Reference (Optional)
// // //       if (style?.sampleIllustrationUrl) {
// // //         const stylePart = await getImagePart(style.sampleIllustrationUrl);
// // //         if (stylePart) parts.push(stylePart);
// // //       }

// // //       // -- B. Character & Location References
// // //       // Filter based on text to avoid token limit, but ensure we send the image if they appear
// // //       const fullText = `${left?.text || ""} ${right?.text || ""}`.toLowerCase();
// // //       const relevantItems = [...c, ...l].filter(item => 
// // //         fullText.includes(item.name.toLowerCase())
// // //       );

// // //       // Add reference images to the parts array FIRST
// // //       // Gemini Docs: "The following example demonstrates uploading base64 encoded images... contents: [ { text... }, { inlineData... } ]"
// // //       // Order doesn't strictly matter, but putting images + text instruction is standard.
// // //       const referenceInstructions: string[] = [];

// // //       for (const item of relevantItems) {
// // //         if (item.imageUrl) {
// // //           const imgPart = await getImagePart(item.imageUrl);
// // //           if (imgPart) {
// // //             parts.push(imgPart);
// // //             referenceInstructions.push(`- Reference image provided for character/location: "${item.name}". The final image MUST look exactly like this reference.`);
// // //           }
// // //         }
// // //       }

// // //       // -- C. The Text Prompt
// // //       // NOTE: We now explicitly ask for text rendering since the user flagged it was missing.
// // //       const promptText = `
// // // You are a professional children's book illustrator.

// // // TASK:
// // // Create a single wide double-page spread (16:9 aspect ratio) illustrating the scene described below.

// // // STYLE:
// // // ${style?.summary || "Whimsical, colorful children's book illustration."}

// // // REFERENCES:
// // // ${referenceInstructions.length > 0 ? referenceInstructions.join("\n") : "No specific references provided, create original characters."}

// // // SCENE TEXT (Please render this text legibly on the image in a suitable font):
// // // Left Page: "${left?.text || ""}"
// // // Right Page: "${right?.text || ""}"

// // // VISUAL DESCRIPTION:
// // // Create a cohesive scene spanning both pages that represents the action in the text.
// // // Ensure characters match the provided reference images exactly.
// // // `;

// // //       parts.push({ text: promptText });

// // //       console.log(`Spread ${pageLabel} sending ${parts.length} parts (Images + Prompt) to Gemini`);

// // //       // 3. CALL GEMINI 3 PRO
// // //       const response = await client.models.generateContent({
// // //         model: GEMINI_IMAGE_MODEL,
// // //         contents: [{ role: "user", parts }],
// // //         config: { 
// // //           responseModalities: ["IMAGE"], // We only want the final image buffer
// // //           imageConfig: {
// // //             aspectRatio: "16:9",
// // //             imageSize: "2K"
// // //           },
// // //           safetySettings: [
// // //             { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
// // //           ]
// // //         },
// // //       });

// // //       const output = extractInlineImage(response);
// // //       if (!output) {
// // //         throw new Error("Gemini returned no image data.");
// // //       }

// // //       // 4. UPLOAD & RETURN
// // //       return await saveImageToStorage(output.data, output.mimeType, storyId);
// // //     });

// // //     // 5. UPDATE DB
// // //     await step.run("save-url-to-db", async () => {
// // //       const idsToUpdate = [leftPageId];
// // //       if (rightPageId) idsToUpdate.push(rightPageId);

// // //       await db
// // //         .update(storyPages)
// // //         .set({ imageUrl: imageUrl })
// // //         .where(inArray(storyPages.id, idsToUpdate));
// // //     });

// // //     return { success: true, pages: pageLabel, url: imageUrl };
// // //   }
// // // );


// import { inngest } from "./client";
// import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from "@google/genai";
// import { eq, inArray, asc, or, sql } from "drizzle-orm";
// import { 
//   storyPages, 
//   storyStyleGuide, 
//   characters, 
//   locations,
//   storyCharacters,
//   storyLocations,
//   storyPageCharacters,
//   storyPageLocations
// } from "@/db/schema";
// import { db } from "@/db";
// import { v2 as cloudinary } from "cloudinary";
// import { Readable } from "node:stream";
// import { v4 as uuid } from "uuid";

// // --- CONFIGURATION ---
// cloudinary.config({
//   cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
//   api_key: process.env.CLOUDINARY_API_KEY!,
//   api_secret: process.env.CLOUDINARY_API_SECRET!,
// });

// const client = new GoogleGenAI({
//   apiKey: process.env.GEMINI_API_KEY,
//   apiVersion: "v1alpha",
// });

// const GEMINI_IMAGE_MODEL = "gemini-3-pro-image-preview";

// // --- HELPERS ---

// async function getImagePart(urlOrBase64: string) {
//   try {
//     if (!urlOrBase64) return null;

//     // 1. If it's already a Data URI (Base64 from DB)
//     if (urlOrBase64.startsWith("data:image")) {
//       const base64Data = urlOrBase64.split(",")[1];
//       return {
//         inlineData: {
//           data: base64Data,
//           mimeType: "image/jpeg",
//         },
//       };
//     }

//     // 2. If it's a remote URL (Cloudinary/S3)
//     const res = await fetch(urlOrBase64);
//     if (!res.ok) throw new Error(`Failed to fetch: ${res.statusText}`);
//     const arrayBuffer = await res.arrayBuffer();
//     const buffer = Buffer.from(arrayBuffer);
//     return {
//       inlineData: {
//         data: buffer.toString("base64"),
//         mimeType: "image/jpeg",
//       },
//     };
//   } catch (e) {
//     console.error("❌ Failed to process image reference", e);
//     return null;
//   }
// }

// async function saveImageToStorage(
//   base64Data: string,
//   mimeType: string,
//   storyId: string
// ) {
//   const buffer = Buffer.from(base64Data, "base64");
//   return new Promise<string>((resolve, reject) => {
//     const stream = cloudinary.uploader.upload_stream(
//       {
//         folder: `flipwhizz/stories/${storyId}/spreads`,
//         filename_override: uuid(),
//         resource_type: "image",
//       },
//       (err, res) => {
//         if (err) reject(err);
//         else resolve(res?.secure_url || "");
//       }
//     );
//     Readable.from(buffer).pipe(stream);
//   });
// }

// function extractInlineImage(result: any) {
//   const parts = result.candidates?.[0]?.content?.parts || [];
//   const imagePart = parts.find((p: any) => p.inlineData?.data);
//   return imagePart?.inlineData
//     ? { data: imagePart.inlineData.data, mimeType: imagePart.inlineData.mimeType }
//     : null;
// }

// // --- 1. ORCHESTRATOR ---
// export const generateBookSpreads = inngest.createFunction(
//   {
//     id: "generate-book-spreads",
//     concurrency: 5,
//     retries: 2,
//   },
//   { event: "story/generate.spreads" },
//   async ({ event, step }) => {
//     const { storyId } = event.data;

//     // A. Fetch Page Metadata (Lightweight)
//     const pages = await step.run("fetch-pages", async () => {
//       return await db.query.storyPages.findMany({
//         where: eq(storyPages.storyId, storyId),
//         orderBy: asc(storyPages.pageNumber),
//         columns: {
//           id: true,
//           pageNumber: true,
//         }
//       });
//     });

//     const spreadGroups = [];
//     for (let i = 0; i < pages.length; i += 2) {
//       spreadGroups.push(pages.slice(i, i + 2));
//     }

//     const events = spreadGroups.map((group) => {
//       const leftPage = group[0];
//       const rightPage = group[1] || null;

//       return {
//         name: "story/generate.single.spread",
//         data: {
//           storyId,
//           leftPageId: leftPage.id,
//           rightPageId: rightPage?.id,
//           pageLabel: `${leftPage.pageNumber}-${rightPage ? rightPage.pageNumber : "end"}`,
//         },
//       };
//     });

//     if (events.length > 0) {
//       await step.sendEvent("dispatch-spread-workers", events);
//     }

//     return { spreadsQueued: events.length };
//   }
// );

// // // --- 2. WORKER ---
// // export const generateSingleSpread = inngest.createFunction(
// //   {
// //     id: "generate-single-spread",
// //     concurrency: 4, 
// //     retries: 2, 
// //   },
// //   { event: "story/generate.single.spread" },
// //   async ({ event, step }) => {
// //     const {
// //       storyId,
// //       leftPageId,
// //       rightPageId,
// //       pageLabel
// //     } = event.data;

// //     const imageUrl = await step.run("generate-and-upload", async () => {
      
// //       // 1. FETCH TEXT
// //       const left = await db.query.storyPages.findFirst({
// //         where: eq(storyPages.id, leftPageId),
// //         columns: { text: true }
// //       });
// //       const right = rightPageId ? await db.query.storyPages.findFirst({
// //         where: eq(storyPages.id, rightPageId),
// //         columns: { text: true }
// //       }) : null;

// //       const style = await db.query.storyStyleGuide.findFirst({
// //         where: eq(storyStyleGuide.storyId, storyId),
// //       });

// //       // 2. FETCH ACTIVE CHARACTERS (The Fix for Consistency)
// //       // Instead of guessing from text, we ask the DB: "Who is assigned to this page?"
// //       const pageIdsToCheck = [leftPageId, rightPageId].filter(Boolean) as string[];
      
// //       const pageCharacters = await db
// //         .select({
// //           name: characters.name,
// //           imageUrl: characters.portraitImageUrl,
// //           description: characters.description,
// //           visualDetails: characters.visualDetails
// //         })
// //         .from(storyPageCharacters)
// //         .innerJoin(characters, eq(storyPageCharacters.characterId, characters.id))
// //         .where(inArray(storyPageCharacters.pageId, pageIdsToCheck));

// //       // 3. FALLBACK: If Phase A didn't assign anyone, check text match (Backup consistency)
// //       let activeCharacters = pageCharacters;
// //       if (activeCharacters.length === 0) {
// //         const allStoryChars = await db
// //             .select({
// //                 name: characters.name,
// //                 imageUrl: characters.portraitImageUrl,
// //                 description: characters.description,
// //                 visualDetails: characters.visualDetails
// //             })
// //             .from(storyCharacters)
// //             .innerJoin(characters, eq(storyCharacters.characterId, characters.id))
// //             .where(eq(storyCharacters.storyId, storyId));
            
// //         const fullText = `${left?.text || ""} ${right?.text || ""}`.toLowerCase();
// //         activeCharacters = allStoryChars.filter(c => fullText.includes(c.name.toLowerCase()));
// //       }

// //       // Filter duplicates by name
// //       const uniqueRefs = new Map();
// //       activeCharacters.forEach(c => {
// //           if(c.imageUrl) uniqueRefs.set(c.name, c);
// //       });
// //       const finalRefs = Array.from(uniqueRefs.values());

// //       // 4. CONSTRUCT PROMPT PAYLOAD
// //       const parts: any[] = [];
      
// //       // A. Style Reference
// //       if (style?.sampleIllustrationUrl) {
// //         const stylePart = await getImagePart(style.sampleIllustrationUrl);
// //         if (stylePart) {
// //           parts.push({ text: "STYLE REFERENCE IMAGE (Adopt this art style):" });
// //           parts.push(stylePart);
// //         }
// //       }

// //       // B. Character References
// //       const referenceInstructions: string[] = [];

// //       for (const ref of finalRefs) {
// //         const refPart = await getImagePart(ref.imageUrl as string);
        
// //         let visualText = ref.description || "";
// //         // Flatten visual details JSON if present
// //         if ((ref as any).visualDetails) {
// //             try {
// //                 const details = (ref as any).visualDetails;
// //                 if (typeof details === 'object') {
// //                     visualText += ` ${Object.entries(details).map(([k,v]) => `${k}: ${v}`).join(", ")}`;
// //                 }
// //             } catch(e) {}
// //         }

// //         if (refPart) {
// //           parts.push({ 
// //             text: `CHARACTER REFERENCE: "${ref.name}". \nVisual Description: ${visualText}.\n(The character in the final image MUST look exactly like this reference)` 
// //           });
// //           parts.push(refPart);
// //           referenceInstructions.push(`- Include character "${ref.name}" matching the reference image provided.`);
// //         }
// //       }

// //       // C. The Text Prompt
// //       const promptText = `
// // You are a professional children's book illustrator.

// // TASK:
// // Create a single wide double-page spread (16:9 aspect ratio).

// // STYLE:
// // ${style?.summary || "Whimsical, colorful children's book illustration."}

// // CHARACTERS TO INCLUDE:
// // ${referenceInstructions.length > 0 ? referenceInstructions.join("\n") : "- Create characters based on the text context."}

// // SCENE DESCRIPTION:
// // Left Page Action: "${left?.text || ""}"
// // Right Page Action: "${right?.text || ""}"

// // CRITICAL INSTRUCTION - TEXT RENDERING:
// // You MUST render the story text directly onto the image.
// // 1. On the LEFT side of the image, write: "${left?.text || ""}"
// // 2. On the RIGHT side of the image, write: "${right?.text || ""}"
// // 3. Ensure the text is large, legible, and dark enough to read against the background.
// // 4. If a page has no text, leave that side's text area empty.

// // COMPOSITION:
// // - Ensure characters are consistent with reference images.
// // - Leave space for the text so it does not cover faces.
// // `;

// //       parts.push({ text: promptText });

// //       console.log(`Spread ${pageLabel}: Sending ${parts.length} parts to Gemini. Refs: ${finalRefs.map(r => r.name).join(', ')}`);

// //       // 5. CALL GEMINI
// //       const response = await client.models.generateContent({
// //         model: GEMINI_IMAGE_MODEL,
// //         contents: [{ role: "user", parts }],
// //         config: { 
// //           responseModalities: ["IMAGE"],
// //           imageConfig: {
// //             aspectRatio: "16:9",
// //             imageSize: "2K"
// //           },
// //           safetySettings: [
// //             { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
// //           ]
// //         },
// //       });

// //       const output = extractInlineImage(response);
// //       if (!output) {
// //         throw new Error("Gemini returned no image data.");
// //       }

// //       return await saveImageToStorage(output.data, output.mimeType, storyId);
// //     });

// //     // 6. UPDATE DB
// //     await step.run("save-url-to-db", async () => {
// //       const idsToUpdate = [leftPageId];
// //       if (rightPageId) idsToUpdate.push(rightPageId);

// //       await db
// //         .update(storyPages)
// //         .set({ imageUrl: imageUrl })
// //         .where(inArray(storyPages.id, idsToUpdate));
// //     });

// //     return { success: true, pages: pageLabel, url: imageUrl };
// //   }
// // );



// // ... (Imports and Orchestrator remain the same) ...

// // --- 2. WORKER ---
// export const generateSingleSpread = inngest.createFunction(
//   {
//     id: "generate-single-spread",
//     concurrency: 4, 
//     retries: 2, 
//   },
//   { event: "story/generate.single.spread" },
//   async ({ event, step }) => {
//     const {
//       storyId,
//       leftPageId,
//       rightPageId,
//       pageLabel
//     } = event.data;

//     const imageUrl = await step.run("generate-and-upload", async () => {
      
//       // 1. FETCH TEXT
//       const left = await db.query.storyPages.findFirst({
//         where: eq(storyPages.id, leftPageId),
//         columns: { text: true }
//       });
//       const right = rightPageId ? await db.query.storyPages.findFirst({
//         where: eq(storyPages.id, rightPageId),
//         columns: { text: true }
//       }) : null;

//       const style = await db.query.storyStyleGuide.findFirst({
//         where: eq(storyStyleGuide.storyId, storyId),
//       });

//       // 2. FETCH SPECIFIC CHARACTERS & LOCATIONS FOR THIS SPREAD
//       // We look at the "Join Tables" (storyPageCharacters / storyPageLocations) 
//       // because Phase A successfully mapped them there.
//       const pageIdsToCheck = [leftPageId, rightPageId].filter(Boolean) as string[];
      
//       // A. Characters on these pages
//       const pageChars = await db
//         .select({
//           name: characters.name,
//           // Priority: Generated Image -> User Upload -> Null
//           imageUrl: sql<string>`COALESCE(${characters.portraitImageUrl}, ${characters.referenceImageUrl})`,
//           description: characters.description,
//           visualDetails: characters.visualDetails,
//           type: sql<string>`'character'`
//         })
//         .from(storyPageCharacters)
//         .innerJoin(characters, eq(storyPageCharacters.characterId, characters.id))
//         .where(inArray(storyPageCharacters.pageId, pageIdsToCheck));

//       // B. Locations on these pages
//       const pageLocs = await db
//         .select({
//           name: locations.name,
//           // Priority: Generated Image -> User Upload -> Null
//           imageUrl: sql<string>`COALESCE(${locations.portraitImageUrl}, ${locations.referenceImageUrl})`,
//           description: locations.description,
//           visualDetails: locations.visualDetails,
//           type: sql<string>`'location'`
//         })
//         .from(storyPageLocations)
//         .innerJoin(locations, eq(storyPageLocations.locationId, locations.id))
//         .where(inArray(storyPageLocations.pageId, pageIdsToCheck));

//       let activeRefs = [...pageChars, ...pageLocs];

//       // 3. FALLBACK (If Phase A missed tagging)
//       // If no refs found via DB, we search the text for names of ANY story character/location
//       if (activeRefs.length === 0) {
//         const fullText = `${left?.text || ""} ${right?.text || ""}`.toLowerCase();

//         // Load ALL characters/locations for this story
//         const allChars = await db.select({
//             name: characters.name,
//             imageUrl: sql<string>`COALESCE(${characters.portraitImageUrl}, ${characters.referenceImageUrl})`,
//             description: characters.description,
//             visualDetails: characters.visualDetails,
//             type: sql<string>`'character'`,
//             role: storyCharacters.role
//         }).from(storyCharacters).innerJoin(characters, eq(storyCharacters.characterId, characters.id)).where(eq(storyCharacters.storyId, storyId));

//         const allLocs = await db.select({
//             name: locations.name,
//             imageUrl: sql<string>`COALESCE(${locations.portraitImageUrl}, ${locations.referenceImageUrl})`,
//             description: locations.description,
//             visualDetails: locations.visualDetails,
//             type: sql<string>`'location'`
//         }).from(storyLocations).innerJoin(locations, eq(storyLocations.locationId, locations.id)).where(eq(storyLocations.storyId, storyId));

//         // Filter by text match
//         const matched = [...allChars, ...allLocs].filter(item => fullText.includes(item.name.toLowerCase()));
        
//         // Always include Protagonist if "she/he" is present but no specific name found
//         if (matched.length === 0 && (fullText.includes(" she ") || fullText.includes(" he "))) {
//             const protagonist = allChars.find(c => c.role === 'protagonist');
//             if (protagonist) matched.push(protagonist);
//         }

//         activeRefs = matched;
//       }

//       // 4. DEDUPLICATE (In case left and right page have same char)
//       const uniqueMap = new Map();
//       activeRefs.forEach(item => {
//           if (item.imageUrl && !uniqueMap.has(item.name)) {
//               uniqueMap.set(item.name, item);
//           }
//       });
//       const finalRefs = Array.from(uniqueMap.values());

//       // 5. CONSTRUCT PROMPT PARTS
//       const parts: any[] = [];
      
//       // A. Style Guide Image
//       if (style?.sampleIllustrationUrl) {
//         const stylePart = await getImagePart(style.sampleIllustrationUrl);
//         if (stylePart) {
//           parts.push({ text: "PRIMARY ART STYLE REFERENCE (Follow this style exactly):" });
//           parts.push(stylePart);
//         }
//       }

//       // B. Character & Location References
//       const referenceInstructions: string[] = [];

//       for (const ref of finalRefs) {
//         const refPart = await getImagePart(ref.imageUrl as string);
        
//         let visualText = ref.description || "";
//         // Parse JSON visual details if available
//         if ((ref as any).visualDetails) {
//             try {
//                 const details = (ref as any).visualDetails;
//                 if (typeof details === 'object') {
//                     visualText += ` ${Object.entries(details).map(([k,v]) => `${k}: ${v}`).join(", ")}`;
//                 }
//             } catch(e) {}
//         }

//         if (refPart) {
//           parts.push({ 
//             text: `REFERENCE FOR ${ref.type.toUpperCase()}: "${ref.name}".\nVisual Description: ${visualText}.\n(The ${ref.type} in the final image MUST look exactly like this reference)` 
//           });
//           parts.push(refPart);
//           referenceInstructions.push(`- Include ${ref.type} "${ref.name}" matching the reference image provided.`);
//         }
//       }

//       // C. Final Text Prompt
//       const promptText = `
// You are a professional children's book illustrator.

// TASK:
// Create a single wide double-page spread (16:9 aspect ratio).

// STYLE:
// ${style?.summary || "Whimsical, colorful children's book illustration."}

// ELEMENTS TO INCLUDE:
// ${referenceInstructions.length > 0 ? referenceInstructions.join("\n") : "Create elements fitting the story context."}

// STORY SEGMENT:
// Left Page: "${left?.text || ""}"
// Right Page: "${right?.text || ""}"

// CRITICAL INSTRUCTION - TEXT RENDERING:
// You MUST render the story text directly onto the image.
// 1. On the LEFT side, write: "${left?.text || ""}"
// 2. On the RIGHT side, write: "${right?.text || ""}"
// 3. Ensure text is large, dark, and legible against the background.
// 4. Use a font style that matches the illustration (e.g. hand-written or serif).

// COMPOSITION:
// - Ensure characters and locations match the provided reference images.
// - Leave clear space for the text so it does not cover important visual elements.
// `;

//       parts.push({ text: promptText });

//       console.log(`Spread ${pageLabel}: Sending ${parts.length} parts to Gemini. Refs: ${finalRefs.map(r => r.name).join(', ')}`);

//       // 6. CALL GEMINI
//       const response = await client.models.generateContent({
//         model: GEMINI_IMAGE_MODEL,
//         contents: [{ role: "user", parts }],
//         config: { 
//           responseModalities: ["IMAGE"],
//           imageConfig: {
//             aspectRatio: "16:9",
//             imageSize: "2K"
//           },
//           safetySettings: [
//             { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
//           ]
//         },
//       });

//       const output = extractInlineImage(response);
//       if (!output) {
//         throw new Error("Gemini returned no image data.");
//       }

//       return await saveImageToStorage(output.data, output.mimeType, storyId);
//     });

//     // 7. SAVE URL TO DB
//     await step.run("save-url-to-db", async () => {
//       const idsToUpdate = [leftPageId];
//       if (rightPageId) idsToUpdate.push(rightPageId);

//       await db
//         .update(storyPages)
//         .set({ imageUrl: imageUrl })
//         .where(inArray(storyPages.id, idsToUpdate));
//     });

//     return { success: true, pages: pageLabel, url: imageUrl };
//   }
// );




import { inngest } from "./client";
import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { eq, inArray, asc, or, sql } from "drizzle-orm";
import { 
  storyPages, 
  storyStyleGuide, 
  characters, 
  locations,
  storySpreads,
  storySpreadScene,
  storySpreadPresence
} from "@/db/schema";
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

// The model capable of Text + Reference Images + High Quality Gen
const GEMINI_IMAGE_MODEL = "gemini-3-pro-image-preview";

// --- HELPERS ---

async function getImagePart(urlOrBase64: string) {
  try {
    if (!urlOrBase64) return null;

    // 1. If it's already a Data URI (Base64 from DB)
    if (urlOrBase64.startsWith("data:image")) {
      const base64Data = urlOrBase64.split(",")[1];
      return {
        inlineData: {
          data: base64Data,
          mimeType: "image/jpeg",
        },
      };
    }

    // 2. If it's a remote URL (Cloudinary/S3)
    const res = await fetch(urlOrBase64);
    if (!res.ok) throw new Error(`Failed to fetch: ${res.statusText}`);
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    return {
      inlineData: {
        data: buffer.toString("base64"),
        mimeType: "image/jpeg",
      },
    };
  } catch (e) {
    console.error("❌ Failed to process image reference", e);
    return null;
  }
}

async function saveImageToStorage(
  base64Data: string,
  mimeType: string,
  storyId: string
) {
  const buffer = Buffer.from(base64Data, "base64");
  return new Promise<string>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: `flipwhizz/stories/${storyId}/spreads`,
        filename_override: uuid(),
        resource_type: "image",
      },
      (err, res) => {
        if (err) reject(err);
        else resolve(res?.secure_url || "");
      }
    );
    Readable.from(buffer).pipe(stream);
  });
}

function extractInlineImage(result: any) {
  const parts = result.candidates?.[0]?.content?.parts || [];
  const imagePart = parts.find((p: any) => p.inlineData?.data);
  return imagePart?.inlineData
    ? { data: imagePart.inlineData.data, mimeType: imagePart.inlineData.mimeType }
    : null;
}

// --- 1. ORCHESTRATOR ---
export const generateBookSpreads = inngest.createFunction(
  {
    id: "generate-book-spreads",
    concurrency: 5,
    retries: 2,
  },
  { event: "story/generate.spreads" },
  async ({ event, step }) => {
    const { storyId } = event.data;

    // A. Fetch Page Metadata
    const pages = await step.run("fetch-pages", async () => {
      return await db.query.storyPages.findMany({
        where: eq(storyPages.storyId, storyId),
        orderBy: asc(storyPages.pageNumber),
        columns: {
          id: true,
          pageNumber: true,
        }
      });
    });

    const spreadGroups = [];
    for (let i = 0; i < pages.length; i += 2) {
      spreadGroups.push(pages.slice(i, i + 2));
    }

    const events = spreadGroups.map((group) => {
      const leftPage = group[0];
      const rightPage = group[1] || null;

      return {
        name: "story/generate.single.spread",
        data: {
          storyId,
          leftPageId: leftPage.id,
          rightPageId: rightPage?.id,
          pageLabel: `${leftPage.pageNumber}-${rightPage ? rightPage.pageNumber : "end"}`,
        },
      };
    });

    if (events.length > 0) {
      await step.sendEvent("dispatch-spread-workers", events);
    }

    return { spreadsQueued: events.length };
  }
);

// --- 2. WORKER ---
export const generateSingleSpread = inngest.createFunction(
  {
    id: "generate-single-spread",
    concurrency: 4, 
    retries: 2, 
  },
  { event: "story/generate.single.spread" },
  async ({ event, step }) => {
    const {
      storyId,
      leftPageId,
      rightPageId,
      pageLabel
    } = event.data;

    const imageUrl = await step.run("generate-and-upload", async () => {
      
      // 1. FETCH TEXT
      const left = await db.query.storyPages.findFirst({
        where: eq(storyPages.id, leftPageId),
        columns: { text: true }
      });
      const right = rightPageId ? await db.query.storyPages.findFirst({
        where: eq(storyPages.id, rightPageId),
        columns: { text: true }
      }) : null;

      // 2. FETCH STYLE
      const style = await db.query.storyStyleGuide.findFirst({
        where: eq(storyStyleGuide.storyId, storyId),
      });

      // 3. FETCH SCENE PLAN (From Phase A)
      // We need to find the spread that corresponds to these pages
      const spread = await db
        .select({
            id: storySpreads.id,
            sceneSummary: storySpreadScene.sceneSummary,
            illustrationPrompt: storySpreadScene.illustrationPrompt,
            mood: storySpreadScene.mood,
            charactersJson: storySpreadPresence.characters, // The list of char IDs present
            primaryLocationId: storySpreadPresence.primaryLocationId
        })
        .from(storySpreads)
        .leftJoin(storySpreadScene, eq(storySpreads.id, storySpreadScene.spreadId))
        .leftJoin(storySpreadPresence, eq(storySpreads.id, storySpreadPresence.spreadId))
        .where(
            or(
                eq(storySpreads.leftPageId, leftPageId),
                eq(storySpreads.rightPageId, rightPageId ?? "impossible_id")
            )
        )
        .limit(1)
        .then(rows => rows[0]);

      if (!spread) throw new Error(`Spread plan not found for pages ${pageLabel}`);

      // 4. RESOLVE REFERENCES (Images)
      // Get Character Images based on the IDs in the JSON plan
      const charIds = (spread.charactersJson as any[])?.map(c => c.characterId) || [];
      
      const charRefs = charIds.length > 0 
        ? await db.select({
            name: characters.name,
            imageUrl: sql<string>`COALESCE(${characters.portraitImageUrl}, ${characters.referenceImageUrl})`,
            description: characters.description,
            visualDetails: characters.visualDetails
          })
          .from(characters)
          .where(inArray(characters.id, charIds))
        : [];

      // Get Location Image
      let locRef = null;
      if (spread.primaryLocationId) {
         const loc = await db.query.locations.findFirst({
             where: eq(locations.id, spread.primaryLocationId),
             columns: { name: true, portraitImageUrl: true, referenceImageUrl: true, description: true }
         });
         if (loc) {
             locRef = {
                 name: loc.name,
                 imageUrl: loc.portraitImageUrl || loc.referenceImageUrl,
                 description: loc.description
             };
         }
      }

      // 5. CONSTRUCT PROMPT PAYLOAD
      const parts: any[] = [];
      
      // A. Style Reference
      if (style?.sampleIllustrationUrl) {
        const stylePart = await getImagePart(style.sampleIllustrationUrl);
        if (stylePart) {
          parts.push({ text: "PRIMARY ART STYLE REFERENCE (Follow this style exactly):" });
          parts.push(stylePart);
        }
      }

      // B. Character References
      const referenceInstructions: string[] = [];

      for (const char of charRefs) {
        if (!char.imageUrl) continue;
        const refPart = await getImagePart(char.imageUrl);
        
        // Flatten visual details for prompt text
        let visualText = char.description || "";
        if ((char as any).visualDetails) {
            try {
                const details = (char as any).visualDetails;
                if (typeof details === 'object') {
                    visualText += ` ${Object.entries(details).map(([k,v]) => `${k}: ${v}`).join(", ")}`;
                }
            } catch(e) {}
        }

        if (refPart) {
          parts.push({ 
            text: `CHARACTER REFERENCE: "${char.name}".\nVisual Description: ${visualText}.\n(The character in the final image MUST look exactly like this reference)` 
          });
          parts.push(refPart);
          referenceInstructions.push(`- Character "${char.name}" MUST appear and match the reference image.`);
        }
      }

      // C. Location Reference
      if (locRef && locRef.imageUrl) {
          const locPart = await getImagePart(locRef.imageUrl);
          if (locPart) {
              parts.push({ text: `LOCATION REFERENCE: "${locRef.name}". Description: ${locRef.description}` });
              parts.push(locPart);
              referenceInstructions.push(`- Setting must match location "${locRef.name}" reference.`);
          }
      }

      // D. The Final Text Prompt (Using the AI-Generated Scene Description)
      const promptText = `
You are a professional children's book illustrator.

TASK:
Create a single wide double-page spread (16:9 aspect ratio).

STYLE:
${style?.summary || "Whimsical, colorful children's book illustration."}
${spread.mood ? `MOOD: ${spread.mood}` : ""}

SCENE DESCRIPTION:
${spread.illustrationPrompt || spread.sceneSummary || "A generic scene matching the text below."}

REQUIRED ELEMENTS:
${referenceInstructions.join("\n")}

STORY TEXT TO RENDER:
Left Page Text: "${left?.text || ""}"
Right Page Text: "${right?.text || ""}"

CRITICAL INSTRUCTIONS:
1. **TEXT RENDERING**: You MUST render the story text directly onto the image. Text should be large, dark, and legible. Place Left Page Text on the left half, Right Page Text on the right half.
2. **CONSISTENCY**: Use the provided reference images for characters and locations. They must look consistent.
3. **COMPOSITION**: Leave negative space (plain backgrounds) where text is placed so it is easy to read.
`;

      parts.push({ text: promptText });

      console.log(`Spread ${pageLabel}: Sending ${parts.length} parts to Gemini. Scene: ${spread.sceneSummary?.slice(0,50)}...`);

      // 6. CALL GEMINI
      const response = await client.models.generateContent({
        model: GEMINI_IMAGE_MODEL,
        contents: [{ role: "user", parts }],
        config: { 
          responseModalities: ["IMAGE"],
          imageConfig: {
            aspectRatio: "16:9",
            imageSize: "2K"
          },
          safetySettings: [
            { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
          ]
        },
      });

      const output = extractInlineImage(response);
      if (!output) {
        throw new Error("Gemini returned no image data.");
      }

      return await saveImageToStorage(output.data, output.mimeType, storyId);
    });

    // 7. SAVE URL TO DB
    await step.run("save-url-to-db", async () => {
      const idsToUpdate = [leftPageId];
      if (rightPageId) idsToUpdate.push(rightPageId);

      await db
        .update(storyPages)
        .set({ imageUrl: imageUrl })
        .where(inArray(storyPages.id, idsToUpdate));
    });

    return { success: true, pages: pageLabel, url: imageUrl };
  }
);