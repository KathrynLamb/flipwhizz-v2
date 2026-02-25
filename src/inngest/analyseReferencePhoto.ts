// src/inngest/functions/analyseReferencePhoto.ts
import { inngest } from "@/inngest/client";
import { db } from "@/db";
import { characters } from "@/db/schema";
import { eq } from "drizzle-orm";
import { GoogleGenAI } from "@google/genai";

const gemini = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
const MODEL = "gemini-2.5-flash";

export const analyseReferencePhoto = inngest.createFunction(
  {
    id: "analyse-reference-photo",
    retries: 2,
  },
  { event: "character/reference-photo.uploaded" },
  async ({ event, step }) => {
    const { characterId, storyId, imageUrl } = event.data;

    // 1. Fetch current character data (small payload — no images)
    const character = await step.run("fetch-character", async () => {
      const c = await db.query.characters.findFirst({
        where: eq(characters.id, characterId),
      });
      if (!c) throw new Error(`Character ${characterId} not found`);
      return {
        id: c.id,
        name: c.name,
        description: c.description,
        appearance: c.appearance,
        visualDetails: c.visualDetails,
      };
    });

    // 2. Fetch image + analyse with Gemini in ONE step
    //    (keeps the large base64 inside the step, never returned as output)
    const analysis = await step.run("analyse-with-gemini", async () => {
      const res = await fetch(imageUrl);
      if (!res.ok) throw new Error(`Failed to fetch image: ${res.statusText}`);
      const buffer = Buffer.from(await res.arrayBuffer());
      const imageBase64 = buffer.toString("base64");

      const prompt = `
You are analysing a reference photo of a character for a children's book illustration pipeline.
The character's name is "${character.name}".

Current stored description: "${character.description || "None yet"}"
Current stored appearance: "${character.appearance || "None yet"}"

Analyse this photo carefully and return a JSON object with these fields:

{
  "appearance": "Detailed physical appearance description. Include: approximate age, hair (colour, style, length), eye colour, skin tone, body build, any distinguishing features like freckles, glasses, scars. Be very specific — this will be used to generate consistent AI illustrations.",
  
  "appearanceConfidence": "high" | "medium" | "low",
  
  "outfit": "Detailed description of exactly what the person is wearing in this photo. Include: each garment, colours, patterns, accessories, shoes. Be specific enough for an AI to recreate it.",
  
  "outfitStyle": "A short label for this outfit, e.g. 'casual summer', 'school uniform', 'winter outdoor', 'pyjamas', 'party dress'",
  
  "enrichedDescription": "If the current description is sparse, suggest an enriched version that incorporates what you can infer from the photo (approximate age, general demeanour, energy). If the current description is already good, return null.",
  
  "notes": "Any observations that might be useful — e.g. 'photo is slightly blurry', 'face partially obscured', 'multiple people in frame — assumed subject is the child on the left'"
}

Return ONLY valid JSON, no markdown backticks, no preamble.
      `.trim();

      const response = await gemini.models.generateContent({
        model: MODEL,
        contents: [
          {
            role: "user",
            parts: [
              { text: prompt },
              {
                inlineData: {
                  data: imageBase64,
                  mimeType: "image/jpeg",
                },
              },
            ],
          },
        ],
      });

      const text =
        response.candidates?.[0]?.content?.parts?.[0]?.text || "";

      const cleaned = text
        .replace(/```json\s*/g, "")
        .replace(/```\s*/g, "")
        .trim();

      try {
        return JSON.parse(cleaned);
      } catch (e) {
        console.error("Failed to parse Gemini response:", cleaned);
        throw new Error("Gemini returned invalid JSON");
      }
    });

    // 3. Save suggestions to DB (small payload — just the text analysis)
    await step.run("save-suggestions", async () => {
      const existingVisualDetails =
        (character.visualDetails as Record<string, any>) || {};

      await db
        .update(characters)
        .set({
          visualDetails: {
            ...existingVisualDetails,
            photoAnalysis: {
              status: "ready",
              analysedAt: new Date().toISOString(),
              imageUrl,
              suggestions: {
                appearance: analysis.appearance,
                appearanceConfidence: analysis.appearanceConfidence,
                outfit: analysis.outfit,
                outfitStyle: analysis.outfitStyle,
                enrichedDescription: analysis.enrichedDescription,
                notes: analysis.notes,
              },
            },
          },
          updatedAt: new Date(),
        })
        .where(eq(characters.id, characterId));
    });

    return {
      characterId,
      status: "analysed",
      confidence: analysis.appearanceConfidence,
    };
  }
);