import { NextResponse } from "next/server";
import { db } from "@/db";
import { 
  locations, 
  storyLocations, 
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

export async function POST(req: Request) {
  try {
    const { locationId } = await req.json();

    if (!locationId) {
      return NextResponse.json(
        { error: "Location ID is required" },
        { status: 400 }
      );
    }

    // 1. Fetch Location Details
    const location = await db.query.locations.findFirst({
      where: eq(locations.id, locationId),
    });

    if (!location) {
      return NextResponse.json(
        { error: "Location not found" },
        { status: 404 }
      );
    }

    // 2. Fetch Associated Story Style
    // Find the most recently updated story this location belongs to
    // so we can match the art style.
    const linkedStory = await db
      .select({
        styleSummary: storyStyleGuide.summary,
        artStyle: storyStyleGuide.artStyle,
        negativePrompt: storyStyleGuide.negativePrompt,
      })
      .from(storyLocations)
      .innerJoin(stories, eq(storyLocations.storyId, stories.id))
      .innerJoin(storyStyleGuide, eq(stories.id, storyStyleGuide.storyId))
      .where(eq(storyLocations.locationId, locationId))
      .orderBy(desc(stories.updatedAt))
      .limit(1)
      .then((rows) => rows[0]);

    // 3. Construct the Prompt
    const visualDesc = [
      location.description,
      location.aiSummary,
      // Parse JSONB visual details if they exist
      location.visualDetails 
        ? Object.entries(location.visualDetails as Record<string, string>)
            .map(([k, v]) => `${k}: ${v}`)
            .join(", ")
        : null
    ].filter(Boolean).join(". ");

    const stylePrompt = linkedStory 
      ? `
        ART STYLE: ${linkedStory.artStyle || "Storybook illustration"}
        STYLE DESCRIPTION: ${linkedStory.styleSummary || "Colorful and engaging, detailed background"}
      ` 
      : "ART STYLE: Professional Children's Book Illustration, environmental concept art";

    const prompt = `
      Generate a location illustration for a children's book.
      
      LOCATION NAME: ${location.name}
      
      VISUAL DESCRIPTION:
      ${visualDesc}
      
      ${stylePrompt}
      
      REQUIREMENTS:
      - Wide or medium shot establishing the setting.
      - Atmospheric lighting.
      - High quality, consistent with the described art style.
      - NO text in the image.
      - NO main characters (focus on the environment).
    `.trim();

    // 4. Generate Image
    const response = await gemini.models.generateContent({
      model: MODEL,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        responseModalities: ["IMAGE"],
        imageConfig: {
          aspectRatio: "1:1", // Square for card thumbnails
          imageSize: "1K",    // Sufficient for preview
        },
      },
    });

    const imgPart = response.candidates?.[0]?.content?.parts?.find(
      (p) => p.inlineData && p.inlineData.data
    );

    if (!imgPart?.inlineData?.data) {
      throw new Error("Failed to generate image data");
    }

    // 5. "Upload" Image
    // Note: In production, upload this buffer to S3/Cloudinary.
    const imageUrl = `data:image/jpeg;base64,${imgPart.inlineData.data}`;

    // 6. Update Database
    await db
      .update(locations)
      .set({
        portraitImageUrl: imageUrl, // Using portrait url for the card thumbnail
        updatedAt: new Date(),
      })
      .where(eq(locations.id, locationId));

    return NextResponse.json({ url: imageUrl });

  } catch (error) {
    console.error("Generate Location Image Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}