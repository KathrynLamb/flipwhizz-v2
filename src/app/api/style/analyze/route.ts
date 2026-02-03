import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { db } from "@/db";
import { storyStyleGuide } from "@/db/schema";
import { eq } from "drizzle-orm";

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
    const { imageUrl, storyId } = await req.json();

    if (!imageUrl || typeof imageUrl !== "string") {
      return NextResponse.json(
        { error: `imageUrl must be a string URL, got: ${typeof imageUrl}` },
        { status: 400 }
      );
    }

    console.log("🎨 Analyzing style reference for story:", storyId);

    const img = await fetchImageAsBase64(imageUrl);

    const prompt = `
You are a "style sanitizer" for a children's book illustration generator.

Goal:
- Describe the artistic style of the image in a way that is SAFE to reuse.
- Do NOT name copyrighted franchises, studios, artists, or specific works.
- Do NOT mention any recognizable characters or brand names.
- Focus only on visual properties: palette, linework, rendering, textures, lighting, composition, mood.
- Do NOT infer the artist, origin, culture, or era unless visually explicit.
- Output must be suitable as a prompt to generate NEW original art "inspired by" the style, not copying.

Return JSON with these exact fields:

{
  "safeStylePrompt": "A comprehensive description of the visual style focusing on technique, not content",
  
  "safeNegativePrompt": "Things to avoid when recreating this style",
  
  "artStyle": "The primary artistic technique in 2-4 words (e.g., '3D CGI animation', 'digital watercolor painting', 'hand-drawn cartoon', 'photorealistic render', 'cel-shaded illustration')",
  
  "renderingTechnique": "Detailed description of HOW it's made - rendering method, brush technique, digital effects, lighting approach (e.g., '3D rendered with soft diffused lighting and smooth gradient shading', 'watercolor with visible wet-on-wet bleeding and paper texture', 'vector illustration with flat colors and clean edges')",
  
  "colorPalette": {
    "primary": ["3-5 dominant colors as hex codes"],
    "secondary": ["2-3 supporting colors as hex codes"], 
    "accent": ["1-2 highlight/pop colors as hex codes"],
    "description": "Overall color mood in plain language (e.g., 'warm and saturated', 'cool pastels', 'high contrast primaries', 'muted earth tones')"
  },
  
  "lightingAndAtmosphere": "Description of lighting quality and mood (e.g., 'soft ambient lighting with subtle shadows', 'dramatic side lighting with strong contrast', 'bright even illumination', 'warm golden glow')",
  
  "textureAndDetail": "Material properties and detail level (e.g., 'smooth plastic-like surfaces with soft highlights', 'visible canvas weave with thick paint texture', 'crisp digital lines with no texture', 'soft fuzzy edges with atmospheric blur')",
  
  "visualThemes": "Visual motifs and design patterns (e.g., 'rounded organic shapes', 'geometric precision', 'flowing curves and swirls', 'angular hard edges', 'layered depth')",
  
  "characterDesignStyle": "If characters/creatures are visible, describe their design approach WITHOUT naming them (e.g., 'simplified cartoon proportions with oversized heads', 'realistic anatomy with stylized features', 'chibi-style with large eyes', 'elongated elegant forms')",
  
  "styleTags": {
    "palette": "Brief color description",
    "linework": "Line quality description", 
    "rendering": "Render style",
    "mood": "Emotional tone",
    "composition": "Layout approach"
  },
  
  "riskFlags": ["Array of potential copyright/safety concerns like 'contains_text', 'recognizable_character_possible', 'logo_or_brand_possible', 'photo_or_photorealistic']
}

Be extremely specific about visual technique while avoiding any copyrighted references.
`.trim();

    const response = await client.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: [
        {
          role: "user",
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
    let analysis;
    try {
      analysis = JSON.parse(text);
    } catch {
      console.error("Raw Gemini response:", text);
      throw new Error("Gemini returned invalid JSON");
    }

    console.log("✅ Style analysis complete");
    console.log("📊 Art style:", analysis.artStyle);
    console.log("🎨 Color palette:", analysis.colorPalette.description);
    console.log("⚠️ Risk flags:", analysis.riskFlags);

    // Build user-friendly display summary (1-2 sentences)
    const userFriendlySummary = `${analysis.artStyle} with ${analysis.colorPalette.description.toLowerCase()} colors. ${analysis.lightingAndAtmosphere}`;

    // Build comprehensive technical summary for generation prompts (hidden from user)
    const technicalSummary = `${analysis.renderingTechnique}

ARTISTIC TECHNIQUE: ${analysis.artStyle}

COLOR PALETTE: ${analysis.colorPalette.description}
Primary: ${analysis.colorPalette.primary.join(", ")}
Secondary: ${analysis.colorPalette.secondary.join(", ")}
Accents: ${analysis.colorPalette.accent.join(", ")}

LIGHTING: ${analysis.lightingAndAtmosphere}

TEXTURE & DETAIL: ${analysis.textureAndDetail}

VISUAL THEMES: ${analysis.visualThemes}

${analysis.characterDesignStyle ? `CHARACTER DESIGN: ${analysis.characterDesignStyle}\n` : ""}
SAFE STYLE DESCRIPTION: ${analysis.safeStylePrompt}`;

    // Update database if storyId provided
    if (storyId) {
      await db
        .update(storyStyleGuide)
        .set({
          styleGuideImage: imageUrl,
          artStyle: analysis.artStyle,
          colorPalette: analysis.colorPalette,
          visualThemes: analysis.visualThemes,
          summary: technicalSummary.trim(), // Full technical details for generation
          userNotes: userFriendlySummary, // Short human-readable version
          negativePrompt: analysis.safeNegativePrompt,
          updatedAt: new Date(),
        })
        .where(eq(storyStyleGuide.storyId, storyId));

      console.log("💾 Style guide updated in database");
    }

    return NextResponse.json({
      success: true,
      analysis,
      summary: technicalSummary, // Backend uses this for generation
      userFriendlySummary, // Frontend shows this to user
      safeStylePrompt: analysis.safeStylePrompt,
      safeNegativePrompt: analysis.safeNegativePrompt,
      styleTags: analysis.styleTags,
      riskFlags: analysis.riskFlags,
    });
  } catch (err: any) {
    console.error("❌ Style analysis error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}