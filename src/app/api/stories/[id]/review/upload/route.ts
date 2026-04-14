// app/api/stories/[id]/review/upload/route.ts

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import heicConvert from "heic-convert";

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
    const outputBuffer = await heicConvert({
      buffer,
      format: "JPEG",
      quality: 0.9,
    });
    return { buffer: Buffer.from(outputBuffer), format: "jpeg" };
  } catch (err) {
    console.error("HEIC conversion failed:", err);
    return { buffer, format: "jpeg" };
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: storyId } = await params;
    const form = await req.formData();
    const file = form.get("file") as File | null;

    if (!file || !(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const isVideo = file.type.startsWith("video/");
    const buffer = Buffer.from(await file.arrayBuffer());

    let uploadBuffer = buffer;
    let format: string | undefined;

    if (!isVideo) {
      const converted = await maybeConvertHeic(buffer, file.name);
      uploadBuffer = converted.buffer;
      format = converted.format;
    }

    const result = await new Promise<any>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: `flipwhizz/reviews/${storyId}`,
          resource_type: isVideo ? "video" : "image",
          ...(format && { format }),
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      uploadStream.end(uploadBuffer);
    });

    return NextResponse.json({
      url: result.secure_url,
      publicId: result.public_id,
      type: isVideo ? "video" : "photo",
    });
  } catch (err) {
    console.error("❌ Review media upload failed:", err);
    return NextResponse.json(
      { error: "Upload failed", details: err instanceof Error ? err.message : "Unknown" },
      { status: 500 }
    );
  }
}