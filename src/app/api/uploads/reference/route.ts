import { NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { Readable } from "node:stream";
import { v2 as cloudinary } from "cloudinary";

export const runtime = "nodejs";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
  api_key: process.env.CLOUDINARY_API_KEY!,
  api_secret: process.env.CLOUDINARY_API_SECRET!,
});

function isHeic(file: File) {
  const name = file.name?.toLowerCase() ?? "";
  const type = file.type ?? "";
  return (
    type === "image/heic" ||
    type === "image/heif" ||
    name.endsWith(".heic") ||
    name.endsWith(".heif")
  );
}

async function maybeConvertHeic(buffer: Buffer, file: File) {
  if (!isHeic(file)) {
    return { buffer, contentType: file.type || "application/octet-stream" };
  }

  try {
    const heicConvert = (await import("heic-convert")).default;
    const output = await heicConvert({
      buffer,
      format: "JPEG",
      quality: 0.9,
    });
    return { buffer: Buffer.from(output), contentType: "image/jpeg" };
  } catch (err) {
    console.warn("HEIC convert failed, uploading raw:", err);
    return { buffer, contentType: file.type };
  }
}

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    const userId = form.get("userId") as string | null;

    if (!file) return NextResponse.json({ error: "Missing file" }, { status: 400 });
    if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });

    const arrayBuffer = await file.arrayBuffer();
    const originalBuffer = Buffer.from(arrayBuffer);

    const { buffer } = await maybeConvertHeic(originalBuffer, file);

    const result: any = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: `flipwhizz/reference/${userId}`,
          filename_override: uuid(),
          resource_type: "image", // Auto-detect usually better, but 'image' is fine for strict enforcement
        },
        (err, res) => {
          if (err) reject(err);
          else resolve(res);
        }
      );

      Readable.from(buffer).pipe(stream);
    });

    return NextResponse.json({
      ok: true,
      url: result.secure_url,
      publicId: result.public_id,
    });
  } catch (err: any) {
    console.error("UPLOAD ERROR:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}