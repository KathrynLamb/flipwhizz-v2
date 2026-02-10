// src/app/api/uploads/reference/route.ts
import { NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import heicConvert from "heic-convert";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

async function maybeConvertHeic(buffer: Buffer, filename: string) {
  const isHeic = filename.toLowerCase().endsWith(".heic") || 
                 filename.toLowerCase().endsWith(".heif");

  if (!isHeic) {
    return { buffer, format: "jpeg" };
  }

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

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");
    const storyId = formData.get("storyId") as string;

    console.log("file", file);

    if (!file || !(file instanceof File)) {
      console.error("Invalid file:", file);
      return NextResponse.json({ error: "Missing or invalid file" }, { status: 400 });
    }

    // Convert File to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const originalBuffer = Buffer.from(arrayBuffer);

    const { buffer, format } = await maybeConvertHeic(originalBuffer, file.name);

    // Upload to Cloudinary
    const uploadResult = await new Promise<any>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: `flipwhizz/style-references/${storyId}`,
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

    console.log("✅ Uploaded to Cloudinary:", uploadResult.secure_url);

    return NextResponse.json({
      url: uploadResult.secure_url,
      storyId,
    });

  } catch (err: any) {
    console.error("UPLOAD ERROR:", err);
    return NextResponse.json(
      { error: err.message || "Upload failed" },
      { status: 500 }
    );
  }
}