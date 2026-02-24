export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import heicConvert from "heic-convert";
import { db } from "@/db";
import { locations } from "@/db/schema";
import { eq } from "drizzle-orm";

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
    const locationId = form.get("locationId") as string | null;

    if (!file || !(file instanceof File) || !locationId) {
      return NextResponse.json({ error: "Missing data" }, { status: 400 });
    }

    const originalBuffer = Buffer.from(await file.arrayBuffer());
    const { buffer, format } = await maybeConvertHeic(originalBuffer, file.name);

    const uploadResult = await new Promise<any>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: `flipwhizz/locations/${locationId}/reference`,
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
    console.log("✅ Location reference uploaded:", url);

    await db
      .update(locations)
      .set({
        referenceImageUrl: url,
        portraitImageUrl: null,
        updatedAt: new Date(),
      })
      .where(eq(locations.id, locationId));

    return NextResponse.json({ ok: true, url });
  } catch (err: any) {
    console.error("LOCATION UPLOAD ERROR:", err);
    return NextResponse.json({ error: err.message || "Upload failed" }, { status: 500 });
  }
}