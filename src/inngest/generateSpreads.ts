import { inngest } from "./client";
import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { eq, inArray, asc } from "drizzle-orm";
import { storyPages, storyStyleGuide } from "@/db/schema";
import { db } from "@/db";
import { v2 as cloudinary } from "cloudinary";
import { Readable } from "node:stream";
import { v4 as uuid } from "uuid";

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
    api_key: process.env.CLOUDINARY_API_KEY!,
    api_secret: process.env.CLOUDINARY_API_SECRET!,
  });
  

const client = new GoogleGenAI({ 
  apiKey: process.env.GEMINI_API_KEY,
  apiVersion: "v1alpha"
});

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
  
  async function saveImageToStorage(base64Data: string, mimeType: string, storyId: string) {
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
    const thinking = parts.find((p: any) => p.text)?.text;
    if (thinking) console.log("🤖 Gemini Thought Process:", thinking.substring(0, 150) + "...");
    
    const imagePart = parts.find((p: any) => p.inlineData?.data);
    return imagePart?.inlineData
      ? { data: imagePart.inlineData.data, mimeType: imagePart.inlineData.mimeType }
      : null;
  }
  
export const generateBookSpreads = inngest.createFunction(
  { 
    id: "generate-book-spreads",
    // We run 3 spreads at a time to be fast but safe
    concurrency: 3, 
    // If one fails, retry it up to 2 times
    retries: 2
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
        where: eq(storyStyleGuide.storyId, storyId)
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
    // We don't generate here directly to avoid timeouts. We dispatch "sub-jobs".
    const events = spreadGroups.map((group) => {
        // If it's the last odd page, handle it alone, otherwise pair them
        const leftPage = group[0];
        const rightPage = group[1] || null; // Might be null if odd number of pages

        return {
            name: "story/generate.single.spread",
            data: {
                storyId,
                styleSummary: style.summary,
                styleImage: style.sampleIllustrationUrl, // Use the generated sample as the "Truth"
                leftPageId: leftPage.id,
                leftText: leftPage.text,
                rightPageId: rightPage?.id,
                rightText: rightPage?.text,
                pageNumbers: `${leftPage.pageNumber}-${rightPage ? rightPage.pageNumber : 'end'}`
            }
        };
    });

    if (events.length > 0) {
        await step.sendEvent("dispatch-spread-workers", events);
    }

    return { spreadsQueued: events.length };
  }
);

// --- THE WORKER THAT GENERATES ONE SPREAD ---
export const generateSingleSpread = inngest.createFunction(
    { id: "generate-single-spread", concurrency: 4 },
    { event: "story/generate.single.spread" },
    async ({ event, step }) => {
        const { 
            storyId, styleSummary, styleImage, 
            leftPageId, leftText, 
            rightPageId, rightText, 
            pageNumbers 
        } = event.data;

        const imageUrl = await step.run("generate-image", async () => {
            // 1. Prepare Style Reference
            let parts: any[] = [];
            
            // We use the Sample Image we generated in the design phase as the style anchor
            if (styleImage) {
                // You'll need to export fetchImageAsBase64 or copy it here
                const imgData = await fetchImageAsBase64(styleImage); 
                if (imgData) {
                    parts.push({ text: "ART STYLE REFERENCE (Follow this style exactly):" });
                    parts.push({ inlineData: imgData });
                }
            }

            // 2. Prompt
            const textPrompt = `You are a children's book illustrator.
            TASK: Create a double-page spread illustration.
            STYLE: ${styleSummary}
            
            CONTENT:
            Left Page Scene: "${leftText}"
            ${rightText ? `Right Page Scene: "${rightText}"` : "Right Page: End of book."}
            
            IMPORTANT:
            - Create one cohesive image that spans both pages.
            - Keep the center of the image (the gutter) relatively clear of important faces/text.
            - Render the text legibly on the pages.
            `;
            
            parts.push({ text: textPrompt });

            // 3. Generate
            const response = await client.models.generateContent({
                model: "gemini-3-pro-image-preview",
                contents: [{ role: "user", parts }],
                config: { responseModalities: ["TEXT", "IMAGE"] }
            });

            const output = extractInlineImage(response);
            if (!output) throw new Error("No image generated");

            // 4. Upload
            return await saveImageToStorage(output.data, output.mimeType, storyId);
        });

        // 5. Update DB (Save same URL to both pages)
        await step.run("save-to-db", async () => {
            const idsToUpdate = [leftPageId];
            if (rightPageId) idsToUpdate.push(rightPageId);

            await db.update(storyPages)
                .set({ imageUrl: imageUrl }) // Same image for both
                .where(inArray(storyPages.id, idsToUpdate));
        });

        return { success: true, pages: pageNumbers };
    }
);