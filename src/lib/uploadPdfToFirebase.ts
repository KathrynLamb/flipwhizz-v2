import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function uploadPdfToFirebase(
  buffer: Buffer,
  storyId: string
): Promise<string> {
  console.log(`📤 Uploading PDF to Cloudinary: ${storyId} (${buffer.length} bytes)`);

  const result = await new Promise<any>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        resource_type: "raw",
        folder: `flipwhizz/stories/${storyId}/pdf`,
        public_id: `story-${storyId}`,
        overwrite: true,
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );
    stream.end(buffer);
  });

  console.log("✅ PDF uploaded to Cloudinary:", result.secure_url);
  return result.secure_url;
}