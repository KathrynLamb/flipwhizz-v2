import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

export const maxDuration = 60;
const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

async function fetchImageAsBase64(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch image");
  const ab = await res.arrayBuffer();
  return {
    data: Buffer.from(ab).toString("base64"),
    mimeType: res.headers.get("content-type") || "image/jpeg",
  };
}

export async function POST(req: Request) {
  try {
    const { imageUrl } = await req.json();

    if (!imageUrl || typeof imageUrl !== "string") {
      return NextResponse.json(
        { error: `imageUrl must be a string URL, got: ${typeof imageUrl}` },
        { status: 400 }
      );
    }
    


    const img = await fetchImageAsBase64(imageUrl);

    const prompt = `
You are a "style sanitizer" for a children's book illustration generator.

Goal:
- Describe the artistic style of the image in a way that is SAFE to reuse.
- Do NOT name copyrighted franchises, studios, artists, or specific works.
- Do NOT mention any recognizable characters or brand names.
- Focus only on visual properties: palette, linework, rendering, textures, lighting, composition, mood.
- Output must be suitable as a prompt to generate NEW original art "inspired by" the style, not copying.

Return JSON with:
{
  "safeStylePrompt": "...",
  "safeNegativePrompt": "...",
  "styleTags": { "palette": "...", "linework": "...", "rendering": "...", "mood": "...", "composition": "..." },
  "riskFlags": ["..."]
}

riskFlags examples:
- "contains_text"
- "looks_like_manga_panel"
- "recognizable_character_possible"
- "logo_or_brand_possible"
- "photo_or_photorealistic"
`.trim();

    const response = await client.models.generateContent({
      model: "gemini-3-pro-preview", // text/vision model (NOT image model)
      contents: [
        {
          parts: [
            { text: prompt },
            { inlineData: img },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
      },
    });

    

    const text = response.text ?? "";
    const json = JSON.parse(text);

    return NextResponse.json({ success: true, ...json });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
