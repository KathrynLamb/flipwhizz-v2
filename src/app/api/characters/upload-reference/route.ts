export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import heicConvert from "heic-convert";
import { db } from "@/db";
import { characters, storyCharacters } from "@/db/schema";
import { eq } from "drizzle-orm";
import { inngest } from "@/inngest/client";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

async function maybeConvertHeic(buffer: Buffer, filename: string) {
  const isHeic =
    filename.toLowerCase().endsWith(".heic") ||
    filename.toLowerCase().endsWith(".heif");

  if (!isHeic) return { buffer, format: "jpeg" };

  try {
    const outputBuffer = await heicConvert({ buffer, format: "JPEG", quality: 0.9 });
    return { buffer: Buffer.from(outputBuffer), format: "jpeg" };
  } catch (err) {
    console.error("HEIC conversion failed:", err);
    return { buffer, format: "jpeg" };
  }
}

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    const characterId = form.get("characterId") as string | null;

    if (!file || !(file instanceof File) || !characterId) {
      return NextResponse.json({ error: "Missing data" }, { status: 400 });
    }

    const originalBuffer = Buffer.from(await file.arrayBuffer());
    const { buffer, format } = await maybeConvertHeic(originalBuffer, file.name);

    const uploadResult = await new Promise<any>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: `flipwhizz/characters/${characterId}/reference`,
          resource_type: "image",
          format,
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      uploadStream.end(buffer);
    });

    const url = uploadResult.secure_url;
    console.log("✅ Character reference uploaded:", url);

    // Fetch existing visualDetails so we don't clobber other data
    const character = await db.query.characters.findFirst({
      where: eq(characters.id, characterId),
    });

    const existingVisualDetails =
      (character?.visualDetails as Record<string, any>) || {};

    // Save URL, clear AI portrait, set analysis to pending
    await db
      .update(characters)
      .set({
        referenceImageUrl: url,
        portraitImageUrl: null,
        visualDetails: {
          ...existingVisualDetails,
          photoAnalysis: {
            status: "pending",
            startedAt: new Date().toISOString(),
            imageUrl: url,
          },
        },
        updatedAt: new Date(),
      })
      .where(eq(characters.id, characterId));

    // Find the associated storyId for the analysis
    const storyLink = await db
      .select({ storyId: storyCharacters.storyId })
      .from(storyCharacters)
      .where(eq(storyCharacters.characterId, characterId))
      .limit(1)
      .then((rows) => rows[0]);

    // Fire background analysis (non-blocking)
    inngest
      .send({
        name: "character/reference-photo.uploaded",
        data: {
          characterId,
          storyId: storyLink?.storyId || "",
          imageUrl: url,
        },
      })
      .catch((err) => {
        // Don't fail the upload if Inngest send fails
        console.error("⚠️ Failed to send Inngest event:", err);
      });

    return NextResponse.json({ ok: true, url });
  } catch (err: any) {
    console.error("CHARACTER UPLOAD ERROR:", err);
    return NextResponse.json({ error: err.message || "Upload failed" }, { status: 500 });
  }
}