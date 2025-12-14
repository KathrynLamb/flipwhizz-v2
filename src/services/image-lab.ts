// src/services/image-lab.ts
import Replicate from "replicate";

const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN! });

function firstUrlFromReplicateOutput(output: unknown): string {
  // Most common: array of urls
  if (Array.isArray(output) && typeof output[0] === "string") return output[0];

  // Sometimes: single url string
  if (typeof output === "string") return output;

  // Sometimes: { output: [...] } or { url: "..." }
  if (output && typeof output === "object") {
    const o = output as Record<string, unknown>;
    if (typeof o.url === "string") return o.url;

    const nested = o.output;
    if (Array.isArray(nested) && typeof nested[0] === "string") return nested[0];
  }

  throw new Error(
    `Unexpected Replicate output shape: ${JSON.stringify(output).slice(0, 500)}`
  );
}

export class ImageLab {
  // 1. Generate Web Preview (Fast, Cheap, 1024x1024)
  static async generateWebImage(prompt: string): Promise<string> {
    console.log("🎨 Generating Web Image for:", prompt);

    const output: unknown = await replicate.run("google/imagen-3", {
      input: { prompt },
    });

    return firstUrlFromReplicateOutput(output);
  }

  // 2. Upscale for Print (Slow, High-Res, 4000x4000)
  static async upscaleForPrint(imageUrl: string): Promise<string> {
    console.log("🔍 Upscaling for Print:", imageUrl);

    const output: unknown = await replicate.run(
      "nightmareai/real-esrgan:42fed1c4974146d4d2414e2be2c5277c7fcf05fcc3a73ab41b2ee43fad28a842",
      {
        input: {
          image: imageUrl,
          scale: 4,
          face_enhance: true,
        },
      }
    );

    return firstUrlFromReplicateOutput(output);
  }
}
