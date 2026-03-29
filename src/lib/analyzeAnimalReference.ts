// src/lib/analyzeAnimalReference.ts
//
// When a parent uploads a reference photo for a non-human character,
// this runs Gemini Vision to extract structured animal details
// that produce much better illustration fidelity than text-only descriptions.

import { GoogleGenAI } from "@google/genai";
import { db } from "@/db";
import { characters } from "@/db/schema";
import { eq } from "drizzle-orm";

const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export interface AnimalProfile {
  breed: string;
  coatColour: string;
  coatPattern: string;
  coatTexture: string;
  earType: string;
  tailType: string;
  eyeColour: string;
  size: string;
  distinctiveMarkings: string;
  bodyShape: string;
}

/**
 * Analyze a reference photo of an animal character using Gemini Vision.
 * Extracts structured visual details and saves them to the character record.
 * 
 * Call this after a photo is uploaded for any character with species !== 'human'.
 */
export async function analyzeAnimalReference(params: {
  characterId: string;
  imageUrl: string;
  species: string;
}): Promise<AnimalProfile | null> {
  const { characterId, imageUrl, species } = params;

  console.log(`🐾 Analyzing ${species} reference photo for character ${characterId}`);

  try {
    // Fetch the image
    const imageRes = await fetch(imageUrl);
    if (!imageRes.ok) throw new Error(`Failed to fetch image: ${imageRes.status}`);
    const imageBuffer = Buffer.from(await imageRes.arrayBuffer());
    const base64 = imageBuffer.toString("base64");
    const mimeType = imageUrl.toLowerCase().includes(".png") ? "image/png" : "image/jpeg";

    const prompt = `You are a veterinary artist's reference assistant. Analyze this photo of a ${species} and extract precise visual details for an illustrator who needs to draw this EXACT animal consistently across many illustrations.

Be EXTREMELY specific about colours — don't say "brown", say "warm chocolate brown with reddish undertones". Don't say "white markings", say "cream-white blaze from forehead to muzzle, white chest patch roughly heart-shaped".

Return ONLY valid JSON:
{
  "breed": "Best guess at breed or breed mix — be specific",
  "coatColour": "Primary and secondary coat colours with exact descriptions",
  "coatPattern": "Where each colour appears on the body — be spatially specific",
  "coatTexture": "Short/medium/long, straight/wavy/curly, smooth/rough/wiry, single/double coat",
  "earType": "Erect/semi-erect/floppy/rose, size relative to head, any distinctive features",
  "tailType": "Length, shape, carriage (up/down/curled), fur coverage",
  "eyeColour": "Exact colour including any variations or rings",
  "size": "Relative to humans — e.g. 'knee-height to an adult', 'small enough to carry'",
  "distinctiveMarkings": "Any unique features — scars, spots, patches, mask patterns, eyebrow markings",
  "bodyShape": "Overall build — athletic/stocky/lean/compact, proportions, leg length relative to body"
}`;

    const response = await client.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { data: base64, mimeType } },
            { text: prompt },
          ],
        },
      ],
    });

    const text = response.candidates?.[0]?.content?.parts
      ?.filter((p: any) => p.text)
      .map((p: any) => p.text)
      .join("") ?? "";

    // Parse JSON from response
    let raw = text.trim();
    if (raw.startsWith("```")) {
      raw = raw.replace(/^```json\s*/, "").replace(/^```\s*/, "").replace(/\s*```$/, "");
    }
    const firstBrace = raw.indexOf("{");
    const lastBrace = raw.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      raw = raw.slice(firstBrace, lastBrace + 1);
    }

    const profile: AnimalProfile = JSON.parse(raw);

    // Save to character record
    const existing = await db
      .select({ visualDetails: characters.visualDetails })
      .from(characters)
      .where(eq(characters.id, characterId))
      .limit(1)
      .then((rows) => rows[0]);

    const currentVisualDetails = (existing?.visualDetails as Record<string, any>) ?? {};

    // Build a better appearance string from the profile
    const appearanceFromProfile = [
      profile.breed,
      profile.coatColour,
      profile.coatPattern ? `Markings: ${profile.coatPattern}` : null,
      profile.coatTexture ? `Coat: ${profile.coatTexture}` : null,
      profile.earType ? `Ears: ${profile.earType}` : null,
      profile.size ? `Size: ${profile.size}` : null,
      profile.distinctiveMarkings ? `Distinctive: ${profile.distinctiveMarkings}` : null,
      profile.bodyShape ? `Build: ${profile.bodyShape}` : null,
    ].filter(Boolean).join(". ");

    await db
      .update(characters)
      .set({
        species: params.species,
        breed: profile.breed,
        appearance: appearanceFromProfile,
        visualDetails: {
          ...currentVisualDetails,
          animalProfile: profile,
        },
        updatedAt: new Date(),
      })
      .where(eq(characters.id, characterId));

    console.log(`🐾 Animal profile saved: ${profile.breed}, ${profile.coatColour}`);
    return profile;
  } catch (err) {
    console.error("🐾 Animal reference analysis failed:", err);
    return null;
  }
}