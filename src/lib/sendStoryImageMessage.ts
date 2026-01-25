import { GoogleGenAI } from "@google/genai";

const client = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
  apiVersion: "v1alpha",
});

const MODEL = "gemini-3-pro-image-preview";

/**
 * Stateless Gemini image call.
 * You MUST pass all visual context every time.
 */
export async function sendStoryImageMessage({
  parts,
  config,
}: {
  parts: any[];
  config?: {
    responseModalities?: Array<"TEXT" | "IMAGE">;
    imageConfig?: {
      aspectRatio?: "1:1" | "16:9" | "9:16";
      imageSize?: "1K" | "2K";
    };
    safetySettings?: any[];
  };
}) {
  if (!Array.isArray(parts) || parts.length === 0) {
    throw new Error("sendStoryImageMessage: parts required");
  }

  return client.models.generateContent({
    model: MODEL,
    contents: [
      {
        parts, // ✅ NO role, NO contents nesting
      },
    ],
    config: {
      responseModalities: config?.responseModalities ?? ["IMAGE"],
      imageConfig: config?.imageConfig,
      safetySettings: config?.safetySettings,
    },
  });
}
