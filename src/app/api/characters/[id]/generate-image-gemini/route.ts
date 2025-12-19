import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { db } from "@/db";
import { characters } from "@/db/schema";
import { eq } from "drizzle-orm";
import { v2 as cloudinary } from "cloudinary";
import { Readable } from "node:stream";
import { v4 as uuid } from "uuid";

export const runtime = "nodejs";
export const maxDuration = 60;

/* ---------------- Gemini (CRITICAL) ---------------- */
const client = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
  apiVersion: "v1alpha", // ✅ REQUIRED
});

/* ---------------- Cloudinary ---------------- */
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
  api_key: process.env.CLOUDINARY_API_KEY!,
  api_secret: process.env.CLOUDINARY_API_SECRET!,
});

/* ---------------- Helpers ---------------- */

async function fetchImageAsBase64(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch reference image");
  const buffer = Buffer.from(await res.arrayBuffer());
  return {
    data: buffer.toString("base64"),
    mimeType: res.headers.get("content-type") || "image/jpeg",
  };
}

function extractInlineImage(result: any) {
  const parts = result.candidates?.[0]?.content?.parts || [];
  const imagePart = parts.find((p: any) => p.inlineData?.data);
  return imagePart?.inlineData ?? null;
}

async function uploadToCloudinary(
  base64: string,
  mimeType: string,
  characterId: string
) {
  const buffer = Buffer.from(base64, "base64");
  return new Promise<string>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: `flipwhizz/characters/${characterId}`,
        filename_override: uuid(),
        resource_type: "image",
      },
      (err, res) => {
        if (err) reject(err);
        else resolve(res!.secure_url);
      }
    );
    Readable.from(buffer).pipe(stream);
  });
}

/* ---------------- Route ---------------- */

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;

    const character = await db.query.characters.findFirst({
      where: eq(characters.id, id),
    });

    if (!character?.referenceImageUrl) {
      return NextResponse.json(
        { error: "Character or reference image missing" },
        { status: 400 }
      );
    }

    const refImage = await fetchImageAsBase64(character.referenceImageUrl);

    /* ---------------- Build PARTS (this was missing) ---------------- */
    const parts: any[] = [];

    parts.push({ text: "PHOTO REFERENCE (Preserve identity exactly):" });
    parts.push({ inlineData: refImage });

    parts.push({
      text: `
Children’s storybook illustration.

STRICT REQUIREMENTS:
- Preserve EXACT eye color from the photo
- Preserve eye size, spacing, and facial proportions
- Do NOT exaggerate eyes
- Do NOT change hair color
- Do NOT alter face shape
- Do NOT invent features

STYLE:
- Soft, hand-painted
- Gentle, warm
- NOT photorealistic
- NOT Pixar
- NOT chibi

Character name: ${character.name}
Description: ${character.description ?? ""}
`.trim(),
    });

    /* ---------------- Generate ---------------- */

    const response = await client.models.generateContent({
      model: "gemini-3-pro-image-preview",
      contents: [{ role: "user", parts }],
      config: { responseModalities: ["TEXT", "IMAGE"] },
    });

    const image = extractInlineImage(response);
    if (!image) {
      console.error("Gemini response:", JSON.stringify(response, null, 2));
      throw new Error("Gemini did not return an image");
    }

    /* ---------------- Upload ---------------- */

    const imageUrl = await uploadToCloudinary(
      image.data,
      image.mimeType,
      id
    );

    await db
      .update(characters)
      .set({ referenceImageUrl: imageUrl })
      .where(eq(characters.id, id));

    return NextResponse.json({ imageUrl });
  } catch (err: any) {
    console.error("[gemini character image error]", err);
    return NextResponse.json(
      { error: err.message ?? "Image generation failed" },
      { status: 500 }
    );
  }
}
