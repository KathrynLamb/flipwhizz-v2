// api/characters/use-ai-image/route.ts
import { NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import { db } from "@/db";
import {
  characters,
  storyCharacters,
  storyStyleGuide,
  stories,
} from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { GoogleGenAI } from "@google/genai";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const gemini = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
const MODEL = "gemini-3-pro-image-preview";

async function getImagePart(urlOrBase64: string) {
  try {
    if (!urlOrBase64) return null;

    if (urlOrBase64.startsWith("data:image")) {
      return {
        inlineData: {
          data: urlOrBase64.split(",")[1],
          mimeType: "image/jpeg",
        },
      };
    }

    const res = await fetch(urlOrBase64);
    if (!res.ok) throw new Error(`Failed to fetch: ${res.statusText}`);
    const buffer = Buffer.from(await res.arrayBuffer());
    return {
      inlineData: {
        data: buffer.toString("base64"),
        mimeType: "image/jpeg",
      },
    };
  } catch (e) {
    console.error("❌ Failed to process reference image", e);
    return null;
  }
}

export async function POST(req: Request) {
  try {
    const { characterId } = await req.json();

    if (!characterId) {
      return NextResponse.json({ error: "Character ID is required" }, { status: 400 });
    }

    // 1. Fetch character
    const character = await db.query.characters.findFirst({
      where: eq(characters.id, characterId),
    });

    if (!character) {
      return NextResponse.json({ error: "Character not found" }, { status: 404 });
    }

    // 2. Fetch associated story style
    const linkedStory = await db
      .select({
        styleSummary: storyStyleGuide.summary,
        artStyle: storyStyleGuide.artStyle,
        negativePrompt: storyStyleGuide.negativePrompt,
      })
      .from(storyCharacters)
      .innerJoin(stories, eq(storyCharacters.storyId, stories.id))
      .innerJoin(storyStyleGuide, eq(stories.id, storyStyleGuide.storyId))
      .where(eq(storyCharacters.characterId, characterId))
      .orderBy(desc(stories.updatedAt))
      .limit(1)
      .then((rows) => rows[0]);

    // 3. Build prompt
    const visualDesc = [
      character.appearance,
      character.description,
      character.visualDetails
        ? Object.entries(character.visualDetails as Record<string, string>)
            .map(([k, v]) => `${k}: ${v}`)
            .join(", ")
        : null,
    ]
      .filter(Boolean)
      .join(". ");

    const traits = character.personalityTraits
      ? `Personality: ${character.personalityTraits}`
      : "";

    const stylePrompt = linkedStory
      ? `ART STYLE: ${linkedStory.artStyle || "Storybook illustration"}
         STYLE DESCRIPTION: ${linkedStory.styleSummary || "Colorful and engaging"}`
      : "ART STYLE: Professional Children's Book Illustration";

    const textPrompt = `
      Generate a character portrait for a children's book.

      CHARACTER NAME: ${character.name}

      VISUAL DESCRIPTION:
      ${visualDesc}

      ${traits}

      ${stylePrompt}

      REQUIREMENTS:
      ${character.referenceImageUrl ? "- Use the attached reference image as the PRIMARY source for facial features, hair, and clothing." : ""}
      - Close-up or medium shot portrait.
      - Neutral background or simple environmental hint.
      - High quality, consistent with the described art style.
      - NO text in the image.
    `.trim();

    // 4. Build parts (text + optional reference image)
    const parts: any[] = [{ text: textPrompt }];

    if (character.referenceImageUrl) {
      console.log("📎 Attaching reference image to prompt...");
      const imagePart = await getImagePart(character.referenceImageUrl);
      if (imagePart) {
        parts.push(imagePart);
        parts.push({ text: "Use this image as a visual reference for the character's appearance." });
      }
    }

    // 5. Generate with Gemini
    const response = await gemini.models.generateContent({
      model: MODEL,
      contents: [{ role: "user", parts }],
      config: {
        responseModalities: ["IMAGE"],
        imageConfig: {
          aspectRatio: "1:1",
          imageSize: "1K",
        },
      },
    });

    const imgPart = response.candidates?.[0]?.content?.parts?.find(
      (p) => p.inlineData?.data
    );

    if (!imgPart?.inlineData?.data) {
      throw new Error("Gemini did not return image data");
    }

    // 6. Upload to Cloudinary
    const imageBuffer = Buffer.from(imgPart.inlineData.data, "base64");

    const uploadResult = await new Promise<any>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: `flipwhizz/characters/${characterId}/portrait`,
          resource_type: "image",
          format: "jpeg",
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      uploadStream.end(imageBuffer);
    });

    const imageUrl = uploadResult.secure_url;
    console.log("✅ Portrait uploaded to Cloudinary:", imageUrl);

    // 7. Save to DB
    await db
      .update(characters)
      .set({
        portraitImageUrl: imageUrl,
        updatedAt: new Date(),
      })
      .where(eq(characters.id, characterId));

    return NextResponse.json({ ok: true, url: imageUrl });
  } catch (error) {
    console.error("Generate Character Image Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}