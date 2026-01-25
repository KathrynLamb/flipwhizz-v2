import { inngest } from "./client";
import { eq, inArray, sql } from "drizzle-orm";
import {
  storyPages,
  storyStyleGuide,
  storySpreads,
  storySpreadPresence,
  characters,
} from "@/db/schema";
import { db } from "@/db";
import { v2 as cloudinary } from "cloudinary";
import { Readable } from "node:stream";
import { v4 as uuid } from "uuid";
import { sendStoryImageMessage } from "@/lib/sendStoryImageMessage";

/* -------------------------------- CONFIG -------------------------------- */

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
  api_key: process.env.CLOUDINARY_API_KEY!,
  api_secret: process.env.CLOUDINARY_API_SECRET!,
});

/* -------------------------------- HELPERS -------------------------------- */

async function getImagePart(url: string) {
  const res = await fetch(url);
  const buf = Buffer.from(await res.arrayBuffer());
  return {
    inlineData: { data: buf.toString("base64"), mimeType: "image/jpeg" },
  };
}

async function saveImage(data: string, mime: string, storyId: string) {
  const buffer = Buffer.from(data, "base64");
  return new Promise<string>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: `flipwhizz/stories/${storyId}/spreads`,
        filename_override: uuid(),
      },
      (err, res) => (err ? reject(err) : resolve(res!.secure_url))
    );
    Readable.from(buffer).pipe(stream);
  });
}

function extractInlineImage(result: any) {
  const parts = result.candidates?.[0]?.content?.parts ?? [];
  return (
    parts.find((p: any) => p.inlineData && !p.thought)?.inlineData ??
    parts.filter((p: any) => p.inlineData).at(-1)?.inlineData ??
    null
  );
}

/* -------------------------------- WORKER -------------------------------- */

export const reviseSingleSpread = inngest.createFunction(
  { id: "revise-single-spread", concurrency: 2, retries: 1 },
  { event: "story/revise.single.spread" },
  async ({ event, step }) => {
    const { storyId, leftPageId, rightPageId, feedback } = event.data;

    if (!feedback || !feedback.trim()) {
      throw new Error("Feedback required for revision");
    }

    const imageUrl = await step.run("revise-image", async () => {
      /* 1️⃣ Existing image */
      const page = await db.query.storyPages.findFirst({
        where: eq(storyPages.id, leftPageId),
        columns: { imageUrl: true },
      });

      if (!page?.imageUrl) {
        throw new Error("No existing image to revise");
      }

      /* 2️⃣ Style guide */
      const style = await db.query.storyStyleGuide.findFirst({
        where: eq(storyStyleGuide.storyId, storyId),
      });

      /* 3️⃣ Character references for this spread */
      const spreadPresence = await db
        .select({
          characters: storySpreadPresence.characters,
        })
        .from(storySpreads)
        .leftJoin(
          storySpreadPresence,
          eq(storySpreads.id, storySpreadPresence.spreadId)
        )
        .where(eq(storySpreads.leftPageId, leftPageId))
        .limit(1)
        .then((r) => r[0]);

      const charIds =
        (spreadPresence?.characters as any[])?.map((c) => c.characterId) ?? [];

      const charRefs = charIds.length
        ? await db
            .select({
              name: characters.name,
              imageUrl: sql<string>`COALESCE(${characters.portraitImageUrl}, ${characters.referenceImageUrl})`,
            })
            .from(characters)
            .where(inArray(characters.id, charIds))
        : [];

      /* 4️⃣ Build parts (ORDER MATTERS) */
      const parts: any[] = [];

      if (style?.sampleIllustrationUrl) {
        parts.push({ text: "PRIMARY ART STYLE REFERENCE:" });
        parts.push(await getImagePart(style.sampleIllustrationUrl));
      }

      for (const c of charRefs) {
        if (!c.imageUrl) continue;
        parts.push({ text: `CHARACTER REFERENCE: ${c.name}` });
        parts.push(await getImagePart(c.imageUrl));
      }

      parts.push({ text: "EXISTING IMAGE (BASE IMAGE TO MODIFY):" });
      parts.push(await getImagePart(page.imageUrl));

      parts.push({
        text: `
You are revising an EXISTING children's book illustration.

APPLY ONLY THIS CHANGE:
"${feedback.trim()}"

ABSOLUTE RULES:
- Do NOT redraw the entire scene
- Do NOT change art style
- Do NOT change character faces, proportions, or clothing
- Do NOT move or resize story text
- Preserve lighting, composition, and mood unless explicitly requested
- If a requested change conflicts with these rules, make the MINIMAL possible adjustment

This is a controlled revision, not a new illustration.
        `.trim(),
      });

      /* 5️⃣ Send via story image chat */
      const response = await sendStoryImageMessage({
        parts,
        config: {
          responseModalities: ["IMAGE"],
          imageConfig: { aspectRatio: "16:9", imageSize: "2K" },
        },
      });
      
      const image = extractInlineImage(response);
      if (!image) throw new Error("No image returned from revision");

      return saveImage(image.data, image.mimeType, storyId);
    });

    /* 6️⃣ Save */
    await step.run("save-db", async () => {
      await db
        .update(storyPages)
        .set({ imageUrl })
        .where(inArray(storyPages.id, [leftPageId, rightPageId].filter(Boolean)));
    });

    return { success: true, imageUrl };
  }
);
