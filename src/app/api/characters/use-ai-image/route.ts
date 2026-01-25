// api/characters/use-ai-images
import { NextResponse } from "next/server";
import { db } from "@/db";
import { 
  characters, 
  storyCharacters, 
  storyStyleGuide, 
  stories 
} from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { GoogleGenAI } from "@google/genai";

// Initialize Gemini
const gemini = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
});

const MODEL = "gemini-3-pro-image-preview";

// Helper to fetch remote image and convert to Gemini part
async function getImagePart(urlOrBase64: string) {
  try {
    if (!urlOrBase64) return null;

    // 1. If it's already a Data URI (Base64)
    if (urlOrBase64.startsWith("data:image")) {
      const base64Data = urlOrBase64.split(",")[1];
      return {
        inlineData: {
          data: base64Data,
          mimeType: "image/jpeg",
        },
      };
    }

    // 2. If it's a remote URL (Cloudinary/S3)
    const res = await fetch(urlOrBase64);
    if (!res.ok) throw new Error(`Failed to fetch: ${res.statusText}`);
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
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
      return NextResponse.json(
        { error: "Character ID is required" },
        { status: 400 }
      );
    }

    // 1. Fetch Character Details
    const character = await db.query.characters.findFirst({
      where: eq(characters.id, characterId),
    });

    if (!character) {
      return NextResponse.json(
        { error: "Character not found" },
        { status: 404 }
      );
    }

    // 2. Fetch Associated Story Style
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

    // 3. Construct the Text Prompt
    const visualDesc = [
      character.appearance,
      character.description,
      character.visualDetails 
        ? Object.entries(character.visualDetails as Record<string, string>)
            .map(([k, v]) => `${k}: ${v}`)
            .join(", ")
        : null
    ].filter(Boolean).join(". ");

    const traits = character.personalityTraits 
      ? `Personality: ${character.personalityTraits}` 
      : "";

    const stylePrompt = linkedStory 
      ? `
        ART STYLE: ${linkedStory.artStyle || "Storybook illustration"}
        STYLE DESCRIPTION: ${linkedStory.styleSummary || "Colorful and engaging"}
      ` 
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

    // 4. Prepare Gemini Contents (Text + Optional Image)
    const parts: any[] = [{ text: textPrompt }];

    // If a reference image exists (user upload), attach it
    if (character.referenceImageUrl) {
      console.log("Found reference image, attaching to prompt...");
      const imagePart = await getImagePart(character.referenceImageUrl);
      if (imagePart) {
        parts.push(imagePart);
        // Add specific instruction for the image part
        parts.push({ text: "Use this image as a visual reference for the character's appearance." });
      }
    }

    // 5. Generate Image
    const response = await gemini.models.generateContent({
      model: MODEL,
      contents: [{ role: "user", parts }],
      config: {
        responseModalities: ["IMAGE"],
        imageConfig: {
          aspectRatio: "1:1",
          imageSize: "1K", // "1K" is sufficient for avatars/cards
        },
      },
    });

    const imgPart = response.candidates?.[0]?.content?.parts?.find(
      (p) => p.inlineData && p.inlineData.data
    );

    if (!imgPart?.inlineData?.data) {
      throw new Error("Failed to generate image data");
    }

    // 6. "Upload" Image (Base64 for now)
    const imageUrl = `data:image/jpeg;base64,${imgPart.inlineData.data}`;

    // 7. Update Database
    await db
      .update(characters)
      .set({
        portraitImageUrl: imageUrl,
        updatedAt: new Date(),
      })
      .where(eq(characters.id, characterId));

    return NextResponse.json({ url: imageUrl });

  } catch (error) {
    console.error("Generate Character Image Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}