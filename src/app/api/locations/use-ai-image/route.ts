// app/api/locations/use-ai-images/route.ts

import { NextResponse } from "next/server";
import { db } from "@/db";
import {
  locations,
  storyLocations,
  storyStyleGuide,
  stories,
} from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { GoogleGenAI } from "@google/genai";
import { v2 as cloudinary } from "cloudinary";
import { Readable } from "node:stream";
import { v4 as uuid } from "uuid";

export const runtime = "nodejs";
export const maxDuration = 60;

/* ---------------- Gemini ---------------- */

const gemini = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
  apiVersion: "v1alpha",
});

const MODEL = "gemini-3-pro-image-preview";

/* ---------------- Cloudinary ---------------- */

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
  api_key: process.env.CLOUDINARY_API_KEY!,
  api_secret: process.env.CLOUDINARY_API_SECRET!,
});

/* ---------------- Helpers ---------------- */

function extractInlineImage(result: any) {
  const parts = result?.candidates?.[0]?.content?.parts ?? [];
  return parts.find((p: any) => p.inlineData?.data)?.inlineData ?? null;
}

async function uploadToCloudinary(
  base64: string,
  mimeType: string,
  locationId: string
): Promise<string> {
  const buffer = Buffer.from(base64, "base64");

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: `flipwhizz/locations/${locationId}`,
        filename_override: uuid(),
        resource_type: "image",
      },
      (err, res) => {
        if (err) reject(err);
        else resolve(res!.secure_url);
      }
    );

    Readable.from(buffer).pipe(stream);
  });
}

/* ---------------- Route ---------------- */

export async function POST(req: Request) {
  try {
    const { locationId } = await req.json();

    if (!locationId) {
      return NextResponse.json(
        { error: "Location ID is required" },
        { status: 400 }
      );
    }

    /* ---------- 1. Fetch Location ---------- */

    const location = await db.query.locations.findFirst({
      where: eq(locations.id, locationId),
    });

    if (!location) {
      return NextResponse.json(
        { error: "Location not found" },
        { status: 404 }
      );
    }

    /* ---------- 2. Fetch Associated Style ---------- */

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

    /* ---------- 3. Build Prompt ---------- */

    const visualDesc = [
      location.description,
      location.aiSummary,
      location.visualDetails
        ? Object.entries(location.visualDetails as Record<string, string>)
            .map(([k, v]) => `${k}: ${v}`)
            .join(", ")
        : null,
    ]
      .filter(Boolean)
      .join(". ");

    const stylePrompt = linkedStory
      ? `
ART STYLE: ${linkedStory.artStyle || "Storybook illustration"}
STYLE DESCRIPTION: ${linkedStory.styleSummary || "Colorful, painterly, child-friendly"}
NEGATIVE PROMPT: ${linkedStory.negativePrompt || ""}
`
      : `
ART STYLE: Professional children's book illustration
STYLE DESCRIPTION: Painterly, warm, whimsical environment art
`;

    const prompt = `
Generate a location illustration for a children's book.

LOCATION NAME:
${location.name}

VISUAL DESCRIPTION:
${visualDesc}

${stylePrompt}

REQUIREMENTS:
- Wide or medium establishing shot
- Coherent, navigable spatial layout (paths, landmarks, entrances)
- Atmospheric lighting
- Consistent perspective suitable for reuse across scenes
- High quality, storybook illustration style
- NO text
- NO characters (environment only)
`.trim();

    /* ---------- 4. Generate Image ---------- */

    const response = await gemini.models.generateContent({
      model: MODEL,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        responseModalities: ["IMAGE"],
        imageConfig: {
          aspectRatio: "1:1",
          imageSize: "1K",
        },
      },
    });

    const image = extractInlineImage(response);

    if (!image) {
      console.error("Gemini response:", JSON.stringify(response, null, 2));
      throw new Error("Gemini did not return an image");
    }

    /* ---------- 5. Upload to Cloudinary ---------- */

    const imageUrl = await uploadToCloudinary(
      image.data,
      image.mimeType,
      locationId
    );

    /* ---------- 6. Save ---------- */

    await db
      .update(locations)
      .set({
        referenceImageUrl: imageUrl, // ✅ correct semantic field
        updatedAt: new Date(),
      })
      .where(eq(locations.id, locationId));

    return NextResponse.json({ url: imageUrl });
  } catch (error: any) {
    console.error("Generate Location Image Error:", error);
    return NextResponse.json(
      { error: error.message ?? "Internal Server Error" },
      { status: 500 }
    );
  }
}
