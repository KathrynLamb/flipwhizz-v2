// src/inngest/generateCharacterOutfits.ts
import { inngest } from "./client";
import { GoogleGenAI } from "@google/genai";
import { db } from "@/db";
import { characterOutfits } from "@/db/schema";
import { eq } from "drizzle-orm";
import { v2 as cloudinary } from "cloudinary";
import { Readable } from "node:stream";
import { v4 as uuid } from "uuid";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
  api_key: process.env.CLOUDINARY_API_KEY!,
  api_secret: process.env.CLOUDINARY_API_SECRET!,
});

const gemini = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
  apiVersion: "v1alpha",
});

const IMAGE_MODEL = "gemini-3-pro-image-preview";

const OUTFIT_DESCRIPTIONS: Record<string, { name: string; description: string }> = {
  casual: {
    name: "Casual Everyday",
    description: "comfortable everyday clothes - t-shirt, jeans, sneakers",
  },
  winter: {
    name: "Winter Gear",
    description: "warm winter clothing - jacket, snow pants, boots, hat, gloves",
  },
  swimwear: {
    name: "Swimwear",
    description: "appropriate swimwear - swimsuit, swim trunks, or wetsuit",
  },
  formal: {
    name: "Formal Wear",
    description: "formal outfit - dress, suit, or fancy clothes",
  },
  sleepwear: {
    name: "Pajamas",
    description: "pajamas, nightgown, or comfortable sleepwear",
  },
  summer: {
    name: "Summer Clothes",
    description: "light summer clothes - shorts, tank top, sandals, sun hat",
  },
  athletic: {
    name: "Athletic Wear",
    description: "athletic wear - sports clothes, workout gear, running shoes",
  },
};

async function uploadToCloudinary(base64: string, characterId: string, outfit: string) {
  const buffer = Buffer.from(base64, "base64");

  return new Promise<string>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: `flipwhizz/characters/${characterId}/outfits`,
        filename_override: `${outfit}-${uuid()}`,
        resource_type: "image",
      },
      (err, res) => (err ? reject(err) : resolve(res!.secure_url))
    );

    Readable.from(buffer).pipe(stream);
  });
}

export const generateCharacterOutfits = inngest.createFunction(
  {
    id: "generate-character-outfits",
    retries: 1,
    concurrency: 3, triggers: [{ event: "character/generate-outfits" }] },
  async ({ event, step }) => {
    const { characterId, characterName, appearance, outfitsNeeded } = event.data;

    console.log(`👗 Generating ${outfitsNeeded.length} outfits for ${characterName}`);

    const generatedOutfits: string[] = [];

    for (const outfitType of outfitsNeeded) {
      await step.run(`generate-${outfitType}`, async () => {
        console.log(`  → Generating ${outfitType} outfit...`);

        const outfitInfo = OUTFIT_DESCRIPTIONS[outfitType] || {
          name: outfitType,
          description: outfitType,
        };

        const response = await gemini.models.generateContent({
          model: IMAGE_MODEL,
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: `Create a character portrait for: ${characterName}

PHYSICAL APPEARANCE (KEEP EXACTLY):
${appearance}

OUTFIT TO WEAR:
${outfitInfo.description}

STYLE REQUIREMENTS:
- Clean character portrait showing full body
- White or neutral background
- Children's book illustration style - warm, friendly, approachable
- Clear details for reference consistency
- Focus on character's face, body type, and the specific outfit

CRITICAL: Keep the character's physical features (face, hair, body type, age) EXACTLY as described. Only change the outfit.

Generate a high-quality portrait of ${characterName} wearing their ${outfitInfo.name}.`,
                },
              ],
            },
          ],
          config: {
            responseModalities: ["IMAGE"],
            imageConfig: {
              aspectRatio: "3:4",
              imageSize: "2K",
            },
          },
        });

        const image = response?.candidates?.[0]?.content?.parts?.find(
          (p: any) => p.inlineData?.data
        )?.inlineData;

        if (!image?.data) {
          throw new Error(`No image generated for ${outfitType}`);
        }

        const url = await uploadToCloudinary(image.data, characterId, outfitType);

        // Save to database
        await db.insert(characterOutfits).values({
          id: uuid(),
          characterId,
          outfitType,
          name: outfitInfo.name,
          description: outfitInfo.description,
          imageUrl: url,
          isDefault: outfitType === "casual", // Mark casual as default
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        generatedOutfits.push(outfitType);
        console.log(`    ✓ ${outfitInfo.name} saved`);
      });
    }

    console.log(`✅ Generated ${generatedOutfits.length} outfits for ${characterName}`);

    return { characterId, outfitsGenerated: generatedOutfits };
  }
);