import Replicate from "replicate";
import { db } from "@/db";
import { characters } from "@/db/schema";
import { eq } from "drizzle-orm";
import { v2 as cloudinary } from "cloudinary";
import { Readable } from "node:stream";

export const runtime = "nodejs";

/* ---------------- Cloudinary config ---------------- */
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
  api_key: process.env.CLOUDINARY_API_KEY!,
  api_secret: process.env.CLOUDINARY_API_SECRET!,
});

/* ---------------- Replicate client ---------------- */
const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN!,
});

/* ---------------- Helpers ---------------- */

async function streamToBuffer(stream: ReadableStream): Promise<Buffer> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }

  return Buffer.concat(chunks);
}

async function uploadToCloudinary(
  buffer: Buffer,
  characterId: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: `flipwhizz/characters/${characterId}`,
        resource_type: "image",
      },
      (err, result) => {
        if (err) reject(err);
        else resolve(result!.secure_url);
      }
    );

    Readable.from(buffer).pipe(uploadStream);
  });
}

/* ---------------- Route ---------------- */

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;

  const character = await db.query.characters.findFirst({
    where: (c, { eq }) => eq(c.id, id),
  });

  if (!character) {
    return new Response("Not found", { status: 404 });
  }

  console.log("Character", character)

  /* ---------------- Prompt ---------------- */

  const prompt = `
Children’s storybook illustration.

Transform the provided photo into a simplified,
storybook-style illustration while preserving likeness.

IMPORTANT:
- Preserve the exact facial proportions.
- Do NOT exaggerate eyes.
- Do NOT change eye spacing or face shape.
- Do NOT change eye color.
- - Do NOT change hair color.
- Keep nose, mouth, and jawline close to the reference.
- No Pixar-style or chibi proportions.

Soft, hand-painted children’s book style.
NOT photorealistic.


Name: ${character.name}
Description: ${character.description || "A friendly storybook character"}
`;

  const input: Record<string, any> = {
    prompt,
    aspect_ratio: "1:1",
    output_format: "png",
    guidance_scale: 7,
  };

  if (character.referenceImageUrl) {
    input.image = character.referenceImageUrl;
    input.strength = 0.28;
  }

  /* ---------------- Generate ---------------- */

  let output;
  try {
    output = await replicate.run("black-forest-labs/flux-dev", { input });
    console.log("REPLICATE raw output:", output);
  } catch (err) {
    console.error("REPLICATE ERROR:", err);
    return new Response("Image generation failed", { status: 500 });
  }

  if (!Array.isArray(output) || !(output[0] instanceof ReadableStream)) {
    console.error("Unexpected Replicate output:", output);
    return new Response("Invalid image output", { status: 500 });
  }

  /* ---------------- Upload ---------------- */

  const buffer = await streamToBuffer(output[0]);
  console.log("image buffer", buffer)
  const imageUrl = await uploadToCloudinary(buffer, id);
  console.log("image url", imageUrl)

  /* ---------------- Save ---------------- */

  await db
    .update(characters)
    .set({ referenceImageUrl: imageUrl })
    .where(eq(characters.id, id));

  return Response.json({ imageUrl });
}
