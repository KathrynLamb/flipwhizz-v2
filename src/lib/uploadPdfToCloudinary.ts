import { v2 as cloudinary } from "cloudinary";
import { Readable } from "node:stream";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
  api_key: process.env.CLOUDINARY_API_KEY!,
  api_secret: process.env.CLOUDINARY_API_SECRET!,
  secure: true,
});

export async function uploadPdfToCloudinary(
  buffer: Buffer,
  storyId: string,
  kind: "interior" | "cover"
): Promise<string> {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: `flipwhizz/pdfs/${storyId}`,
        resource_type: "raw",
        public_id: `${kind}-${Date.now()}.pdf`,
        format: "pdf",
      },
      (err, result) => {
        if (err) reject(err);
        else resolve(result!.secure_url);
      }
    );

    // ✅ stream buffer as single chunk
    Readable.from([buffer]).pipe(uploadStream);
  });
}
