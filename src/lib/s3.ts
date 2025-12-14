// src/lib/s3.ts
import { Readable } from "node:stream";
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
  api_key: process.env.CLOUDINARY_API_KEY!,
  api_secret: process.env.CLOUDINARY_API_SECRET!,
});

/**
 * Uploads a Buffer and returns a public URL.
 * (Shim: uses Cloudinary "raw" uploads, but keeps the name uploadToS3
 * so existing workflow code compiles unchanged.)
 */
export async function uploadToS3(
  key: string,
  buffer: Buffer,
  contentType = "application/pdf"
): Promise<string> {
  if (!buffer?.length) throw new Error("uploadToS3: empty buffer");

  // Cloudinary public_id cannot contain leading slashes
  const cleanKey = key.replace(/^\/+/, "").replace(/\.pdf$/i, "");

  const result = await new Promise<any>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        resource_type: "raw", // ✅ PDFs should be "raw"
        folder: "flipwhizz",
        public_id: cleanKey,
        overwrite: true,
        // Helpful metadata
        context: { contentType },
      },
      (err, res) => {
        if (err) reject(err);
        else resolve(res);
      }
    );

    Readable.from(buffer).pipe(stream);
  });

  const url = result?.secure_url as string | undefined;
  if (!url) throw new Error("uploadToS3: Cloudinary did not return secure_url");

  return url;
}
