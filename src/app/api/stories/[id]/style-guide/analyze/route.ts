// src/app/api/stories/[id]/style-guide/analyze/route.ts

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

/* -------------------------------------------------------------------------- */
/*                              RESPONSE SHAPE                                */
/* -------------------------------------------------------------------------- */

export type StyleGuideAnalysis = {
  // 👤 USER-FACING — warm, inspiring, parent-friendly. Safe to show in UI.
  summary: string;       // 2-3 evocative sentences about how the book will feel
  artStyle: string;      // Short label: "Watercolour & ink", "Bold graphic illustration"
  visualThemes: string;  // Mood keywords: "Nature, wonder, cosy adventure"
  colorPalette: {
    primary: string;     // e.g. "warm amber"
    secondary: string;   // e.g. "sage green"
    accent: string;      // e.g. "dusty rose"
    mood: string;        // e.g. "warm and golden"
    hex: string[];       // Best-effort approximate hex values
  };

  // 🤖 INTERNAL — Gemini prompt engineering. IP-protected. Never expose to client.
  promptBase: string;    // Core positive keywords for Gemini image generation
  negativePrompt: string; // Technical exclusions for Gemini
};

/* -------------------------------------------------------------------------- */
/*                               SYSTEM PROMPT                                */
/* -------------------------------------------------------------------------- */

const SYSTEM_PROMPT = `You are a dual-role expert:

1. A children's book art director who communicates with parents using warm, magical language
2. A technical AI image generation specialist who writes precise prompt keywords for Gemini image models

Your task: analyse an illustration style reference image and produce TWO types of output simultaneously.

USER-FACING fields (summary, artStyle, visualThemes, colorPalette):
- Write with warmth and imagination, as if describing a magical world to an excited parent
- Evocative, inspiring language that makes them feel the book coming to life
- Zero technical AI or prompt engineering jargon
- Focus on emotion, atmosphere, and how their child will experience it

INTERNAL fields (promptBase, negativePrompt):
- These are Gemini image generation prompts — write precise, comma-separated technical descriptors
- Include: art medium, rendering style, lighting type, texture descriptors, quality tags, palette terms
- Must be specific enough to reproduce this exact style consistently across 20+ generated images
- Think about what keywords reliably control consistency in diffusion/generation models

Respond ONLY with a valid JSON object. No markdown, no code fences, no preamble. Raw JSON only.`;

/* -------------------------------------------------------------------------- */
/*                              ANALYSIS PROMPT                               */
/* -------------------------------------------------------------------------- */

const ANALYSIS_PROMPT = `Analyse this illustration reference image with expert precision.

Return ONLY a JSON object with EXACTLY this structure — no other text:

{
  "summary": "2-3 sentences in warm parent-friendly language. How will their child's book look and feel? Capture the magic, atmosphere, and emotional world. Start with something like 'Every page of your book will...' or 'Your story will glow with...'",

  "artStyle": "A short, beautiful 2-5 word label. E.g. 'Watercolour & soft ink', 'Bold graphic illustration', 'Gentle pencil wash'. No jargon — something a parent would love.",

  "visualThemes": "3-6 mood/theme words separated by commas. E.g. 'Nature, wonder, golden hour, cosy adventure'. Evocative and parent-friendly.",

  "colorPalette": {
    "primary": "Dominant colour in simple language, e.g. 'warm amber'",
    "secondary": "Main supporting colour, e.g. 'sage green'",
    "accent": "Highlight or pop colour, e.g. 'dusty rose'",
    "mood": "How the palette feels in 2-4 words, e.g. 'warm and golden' or 'cool and dreamy'",
    "hex": ["#closest1", "#closest2", "#closest3"]
  },

  "promptBase": "Comma-separated Gemini image generation keywords (10-15 terms). Must include: art medium (e.g. 'watercolour wash'), technique (e.g. 'loose ink linework'), lighting (e.g. 'soft diffused natural light'), texture (e.g. 'visible paper grain'), quality tags (e.g. 'children's book illustration, storybook quality'), palette (e.g. 'warm amber and sage palette'), and mood/rendering terms. Be highly specific — generic terms produce inconsistent results.",

  "negativePrompt": "Comma-separated Gemini exclusion terms (8-12 terms). Include: photorealism, CGI render, 3D rendering, and any techniques/aesthetics that would corrupt THIS specific style. Think about: palette clashes, wrong art movements, technical failures, genre mismatches."
}

Analyse ONLY the artistic style — not the subject matter of the image. Study: brushwork quality, linework character, colour relationships, texture presence, lighting approach, rendering technique, and the overall aesthetic spirit.`;

/* -------------------------------------------------------------------------- */
/*                                   ROUTE                                    */
/* -------------------------------------------------------------------------- */

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: storyId } = await params;
    const { imageUrl } = await req.json();

    if (!imageUrl || typeof imageUrl !== "string") {
      return NextResponse.json({ error: "imageUrl is required" }, { status: 400 });
    }

    /* ── Fetch & encode image ── */
    const imageRes = await fetch(imageUrl);
    if (!imageRes.ok) {
      throw new Error(`Could not fetch image: ${imageRes.status}`);
    }

    const imageBuffer = await imageRes.arrayBuffer();
    const base64 = Buffer.from(imageBuffer).toString("base64");
    const rawMime = imageRes.headers.get("content-type") ?? "image/jpeg";

    const VALID_MIMES = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
    type ValidMime = (typeof VALID_MIMES)[number];
    const mediaType: ValidMime = VALID_MIMES.includes(rawMime as ValidMime)
      ? (rawMime as ValidMime)
      : "image/jpeg";

    /* ── Call Claude vision ── */
    const message = await anthropic.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mediaType, data: base64 },
            },
            { type: "text", text: ANALYSIS_PROMPT },
          ],
        },
      ],
    });

    /* ── Extract & parse response ── */
    const textBlock = message.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("No text response from Claude");
    }

    const cleaned = textBlock.text
      .replace(/^```json\s*/m, "")
      .replace(/^```\s*/m, "")
      .replace(/```\s*$/m, "")
      .trim();

    let parsed: StyleGuideAnalysis;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      console.error("[analyze] Raw Claude response:", textBlock.text.slice(0, 500));
      throw new Error("Claude returned invalid JSON — check server logs");
    }

    /* ── Validate required fields ── */
    const required: (keyof StyleGuideAnalysis)[] = [
      "summary",
      "artStyle",
      "visualThemes",
      "colorPalette",
      "promptBase",
      "negativePrompt",
    ];
    for (const field of required) {
      if (!parsed[field]) {
        throw new Error(`Missing field in analysis: ${field}`);
      }
    }

    /* ── Sanitised log (never log internal prompt fields) ── */
    console.log(`[analyze] ✅ Complete for story ${storyId}:`, {
      artStyle: parsed.artStyle,
      visualThemes: parsed.visualThemes,
      colorPalette: parsed.colorPalette,
    });

    return NextResponse.json(parsed);
  } catch (err: any) {
    console.error("[style-guide/analyze] ❌", err);
    return NextResponse.json(
      { error: err?.message ?? "Analysis failed" },
      { status: 500 }
    );
  }
}