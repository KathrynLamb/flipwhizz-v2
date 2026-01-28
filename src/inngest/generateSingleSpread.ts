// import { inngest } from "./client";
// import {
//   GoogleGenAI,
//   HarmCategory,
//   HarmBlockThreshold,
// } from "@google/genai";
// import { eq, inArray, or, sql } from "drizzle-orm";
// import {
//   storyPages,
//   storyStyleGuide,
//   characters,
//   locations,
//   storySpreads,
//   storySpreadScene,
//   storySpreadPresence,
// } from "@/db/schema";
// import { db } from "@/db";
// import { v2 as cloudinary } from "cloudinary";
// import { Readable } from "node:stream";
// import { v4 as uuid } from "uuid";
// import { z } from "zod";

// /* ---------------- CONFIG ---------------- */

// cloudinary.config({
//   cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
//   api_key: process.env.CLOUDINARY_API_KEY!,
//   api_secret: process.env.CLOUDINARY_API_SECRET!,
// });

// const client = new GoogleGenAI({
//   apiKey: process.env.GEMINI_API_KEY!,
//   apiVersion: "v1alpha",
// });

// const MODEL = "gemini-3-pro-image-preview";

// /* ---------------- EVENT SCHEMA ---------------- */

// const GenerateSingleSpreadSchema = z.object({
//   storyId: z.string().min(1),
//   leftPageId: z.string().min(1),
//   rightPageId: z.string().min(1).nullable().optional(),
//   pageLabel: z.string().min(1),
//   feedback: z.string().optional(),
// });

// /* ---------------- HELPERS ---------------- */

// async function getImagePart(url: string) {
//   const res = await fetch(url);
//   const buf = Buffer.from(await res.arrayBuffer());
//   return {
//     inlineData: { data: buf.toString("base64"), mimeType: "image/jpeg" },
//   };
// }

// async function saveImage(data: string, storyId: string) {
//   const buffer = Buffer.from(data, "base64");
//   return new Promise<string>((resolve, reject) => {
//     const stream = cloudinary.uploader.upload_stream(
//       {
//         folder: `flipwhizz/stories/${storyId}/spreads`,
//         filename_override: uuid(),
//       },
//       (err, res) => (err ? reject(err) : resolve(res!.secure_url))
//     );
//     Readable.from(buffer).pipe(stream);
//   });
// }

// function extractImage(result: any) {
//   return result?.candidates?.[0]?.content?.parts?.find(
//     (p: any) => p.inlineData?.data
//   )?.inlineData;
// }

// /* ---------------- WORKER ---------------- */

// export const generateSingleSpread = inngest.createFunction(
//   { id: "generate-single-spread", concurrency: 4, retries: 2 },
//   { event: "story/generate.single.spread" },
//   async ({ event, step }) => {
//     const parsed = GenerateSingleSpreadSchema.safeParse(event.data);

//     if (!parsed.success) {
//       console.error("❌ Invalid spread event", parsed.error, event.data);
//       throw new Error("Invalid story/generate.single.spread payload");
//     }

//     const {
//       storyId,
//       leftPageId,
//       rightPageId,
//       pageLabel,
//       feedback,
//     } = parsed.data;

//     const imageUrl = await step.run("generate-image", async () => {
//       /* ---------- PAGE TEXT ---------- */

//       const left = await db.query.storyPages.findFirst({
//         where: eq(storyPages.id, leftPageId),
//         columns: { text: true },
//       });

//       const right = rightPageId
//         ? await db.query.storyPages.findFirst({
//             where: eq(storyPages.id, rightPageId),
//             columns: { text: true },
//           })
//         : null;

//       /* ---------- STYLE ---------- */

//       const style = await db.query.storyStyleGuide.findFirst({
//         where: eq(storyStyleGuide.storyId, storyId),
//       });

//       /* ---------- SPREAD PLAN ---------- */

//       const spread = await db
//         .select({
//           scene: storySpreadScene.sceneSummary,
//           prompt: storySpreadScene.illustrationPrompt,
//           mood: storySpreadScene.mood,
//           characters: storySpreadPresence.characters,
//           locationId: storySpreadPresence.primaryLocationId,
//         })
//         .from(storySpreads)
//         .leftJoin(
//           storySpreadScene,
//           eq(storySpreads.id, storySpreadScene.spreadId)
//         )
//         .leftJoin(
//           storySpreadPresence,
//           eq(storySpreads.id, storySpreadPresence.spreadId)
//         )
//         .where(
//           rightPageId
//             ? or(
//                 eq(storySpreads.leftPageId, leftPageId),
//                 eq(storySpreads.rightPageId, rightPageId)
//               )
//             : eq(storySpreads.leftPageId, leftPageId)
//         )
//         .limit(1)
//         .then((r) => r[0]);

//       if (!spread) throw new Error(`No spread plan for ${pageLabel}`);

//       /* ---------- BUILD PARTS ---------- */

//       const parts: any[] = [];
//       const rules: string[] = [];

//       // STYLE
//       if (style?.sampleIllustrationUrl) {
//         parts.push({ text: "STYLE REFERENCE:" });
//         parts.push(await getImagePart(style.sampleIllustrationUrl));
//       }

//       // CHARACTERS
//       const charIds =
//         Array.isArray(spread.characters)
//           ? spread.characters.map((c: any) => c.characterId)
//           : [];

//       if (charIds.length) {
//         const chars = await db
//           .select({
//             name: characters.name,
//             imageUrl: sql<string>`
//               COALESCE(${characters.portraitImageUrl}, ${characters.referenceImageUrl})
//             `,
//           })
//           .from(characters)
//           .where(inArray(characters.id, charIds));

//         for (const c of chars) {
//           if (!c.imageUrl) continue;
//           parts.push({ text: `CHARACTER: ${c.name}` });
//           parts.push(await getImagePart(c.imageUrl));
//           rules.push(`- ${c.name} must match reference`);
//         }
//       }

//       // LOCATION
//       if (spread.locationId) {
//         const loc = await db.query.locations.findFirst({
//           where: eq(locations.id, spread.locationId),
//           columns: {
//             name: true,
//             portraitImageUrl: true,
//             referenceImageUrl: true,
//             description: true,
//           },
//         });

//         if (loc?.portraitImageUrl || loc?.referenceImageUrl) {
//           parts.push({ text: `LOCATION: ${loc.name}` });
//           parts.push(
//             await getImagePart(
//               loc.portraitImageUrl || loc.referenceImageUrl!
//             )
//           );
//           rules.push(`- Scene must be set in ${loc.name}`);
//         }
//       }

//       /* ---------- PROMPT ---------- */

//       parts.push({
//         text: `
// You are a professional children's book illustrator.

// STYLE:
// ${style?.summary ?? "Whimsical children's illustration"}

// AVOID:
// ${style?.negativePrompt ?? "Photorealism, text distortion"}

// SCENE:
// ${spread.prompt ?? spread.scene ?? "A child-friendly scene"}

// ${spread.mood ? `MOOD: ${spread.mood}` : ""}

// ${feedback ? `IMPORTANT REVISION:\n${feedback}` : ""}

// TEXT TO PLACE ON IMAGE:
// LEFT: "${left?.text ?? ""}"
// RIGHT: "${right?.text ?? ""}"

// RULES:
// ${rules.join("\n")}
// - Render text ON the image
// - Text must be readable
// - Preserve layout and identity
//         `.trim(),
//       });

//       const res = await client.models.generateContent({
//         model: MODEL,
//         contents: [{ role: "user", parts }],
//         config: {
//           responseModalities: ["IMAGE"],
//           imageConfig: { aspectRatio: "16:9", imageSize: "2K" },
//           safetySettings: [
//             {
//               category: HarmCategory.HARM_CATEGORY_HARASSMENT,
//               threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
//             },
//           ],
//         },
//       });

//       const image = extractImage(res);
//       if (!image) throw new Error("No image returned from Gemini");

//       return saveImage(image.data, storyId);
//     });

//     await step.run("save-db", async () => {
//       const ids = [leftPageId, ...(rightPageId ? [rightPageId] : [])];
//       await db.update(storyPages).set({ imageUrl }).where(inArray(storyPages.id, ids));
//     });

//     return { success: true, pageLabel, imageUrl };
//   }
// );
