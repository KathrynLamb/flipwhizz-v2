import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { db } from "@/db";
import { storyStyleGuide } from "@/db/schema";
import { eq } from "drizzle-orm";

export const maxDuration = 60;
const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

/* ------------------------------------------------------------
   Helpers
------------------------------------------------------------ */

async function fetchImageAsBase64(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch image");
  const ab = await res.arrayBuffer();
  return {
    data: Buffer.from(ab).toString("base64"),
    mimeType: res.headers.get("content-type") || "image/jpeg",
  };
}

function assertValidOutput(data: any) {
  const required = [
    "generationPrompt",
    "negativePrompt",
    "parentSummary",
    "artStyle",
    "colorMood",
    "visualThemes",
  ];

  for (const key of required) {
    if (!data || typeof data[key] !== "string" || !data[key].trim()) {
      throw new Error(`Invalid or missing field: ${key}`);
    }
  }
}

/* ------------------------------------------------------------
   POST
------------------------------------------------------------ */

export async function POST(req: Request) {
  try {
    const { imageUrl, storyId } = await req.json();

    if (!imageUrl || typeof imageUrl !== "string") {
      return NextResponse.json(
        { error: "imageUrl must be a string" },
        { status: 400 }
      );
    }

    const img = await fetchImageAsBase64(imageUrl);

    const prompt = `
You are analyzing the VISUAL STYLE of a children's storybook illustration.

Rules:
- Return ONLY valid JSON. No markdown. No commentary.
- Do NOT mention artists, studios, brands, franchises, or copyrighted works.
- Do NOT describe story content or characters.
- Focus only on how the illustration LOOKS.

Return JSON with EXACTLY these fields:

{
  "generationPrompt": "A clear, reusable visual style prompt suitable for generating new original illustrations. Focus on line work, color usage, rendering approach, texture, lighting, and overall feel.",
  "negativePrompt": "A short comma-separated list of visual traits to avoid.",
  "parentSummary": "A friendly 1–2 sentence explanation written for a parent, with no technical jargon.",
  "artStyle": "2–4 words describing the main illustration technique (e.g. hand-drawn ink, digital watercolor, flat cartoon).",
  "colorMood": "Plain-language description of the overall color feeling (e.g. bright and cheerful, soft and muted).",
  "visualThemes": "Key visual motifs or design patterns (e.g. rounded shapes, playful proportions, simple backgrounds)."
}
`.trim();

    const response = await client.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }, { inlineData: img }],
        },
      ],
      config: {
        responseMimeType: "application/json",
      },
    });

    const raw = response.text ?? "";

    let analysis: any;
    try {
      analysis = JSON.parse(raw);
      assertValidOutput(analysis);
    } catch (err) {
      console.error("❌ Gemini raw output:", raw);
      throw new Error("Gemini returned invalid JSON");
    }

    /* --------------------------------------------------------
       Persist to DB
    -------------------------------------------------------- */

    if (storyId) {
      await db
        .update(storyStyleGuide)
        .set({
          styleGuideImage: imageUrl,

          // Core outputs
          summary: analysis.generationPrompt,
          negativePrompt: analysis.negativePrompt,
          userNotes: analysis.parentSummary,

          // Helpful metadata (optional, but useful)
          artStyle: analysis.artStyle,
          visualThemes: analysis.visualThemes,
          colorPalette: { mood: analysis.colorMood },

          updatedAt: new Date(),
        })
        .where(eq(storyStyleGuide.storyId, storyId));
    }

    return NextResponse.json({
      success: true,
      generationPrompt: analysis.generationPrompt,
      negativePrompt: analysis.negativePrompt,
      parentSummary: analysis.parentSummary,
      artStyle: analysis.artStyle,
      colorMood: analysis.colorMood,
      visualThemes: analysis.visualThemes,
    });
  } catch (err: any) {
    console.error("❌ Style analysis error:", err);
    return NextResponse.json(
      { error: err.message ?? "Style analysis failed" },
      { status: 500 }
    );
  }
}
