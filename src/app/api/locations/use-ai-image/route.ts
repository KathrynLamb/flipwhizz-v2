export const runtime = "nodejs";
export const maxDuration = 60;

import { NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import { Readable } from "node:stream";
import { v4 as uuid } from "uuid";
import { db } from "@/db";
import { locations, storyLocations, storyStyleGuide, stories } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { GoogleGenAI } from "@google/genai";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
  api_key: process.env.CLOUDINARY_API_KEY!,
  api_secret: process.env.CLOUDINARY_API_SECRET!,
});

const gemini = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
  apiVersion: "v1alpha",
});

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

async function uploadToCloudinary(base64: string, locationId: string): Promise<string> {
  const buffer = Buffer.from(base64, "base64");

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: `flipwhizz/locations/${locationId}/portrait`,
        filename_override: uuid(),
        resource_type: "image",
        format: "jpeg",
      },
      (err, res) => {
        if (err) reject(err);
        else resolve(res!.secure_url);
      }
    );
    Readable.from(buffer).pipe(stream);
  });
}

export async function POST(req: Request) {
  try {
    const { locationId } = await req.json();

    if (!locationId) {
      return NextResponse.json({ error: "Location ID is required" }, { status: 400 });
    }

    const location = await db.query.locations.findFirst({
      where: eq(locations.id, locationId),
    });

    if (!location) {
      return NextResponse.json({ error: "Location not found" }, { status: 404 });
    }

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
      ? `ART STYLE: ${linkedStory.artStyle || "Storybook illustration"}
STYLE DESCRIPTION: ${linkedStory.styleSummary || "Colorful, painterly, child-friendly"}
NEGATIVE PROMPT: ${linkedStory.negativePrompt || ""}`
      : `ART STYLE: Professional children's book illustration
STYLE DESCRIPTION: Painterly, warm, whimsical environment art`;

    const prompt = `
Generate a location illustration for a children's book.

LOCATION NAME:
${location.name}

VISUAL DESCRIPTION:
${visualDesc}

${stylePrompt}

REQUIREMENTS:
${location.referenceImageUrl ? "- Use the attached reference image as the PRIMARY visual reference for architecture, colors, and style." : ""}
- Wide or medium establishing shot
- Coherent, navigable spatial layout (paths, landmarks, entrances)
- Atmospheric lighting
- Consistent perspective suitable for reuse across scenes
- High quality, storybook illustration style
- NO text
- NO characters (environment only)
    `.trim();

    const parts: any[] = [{ text: prompt }];

    if (location.referenceImageUrl) {
      console.log("📷 Attaching reference image to prompt...");
      const imagePart = await getImagePart(location.referenceImageUrl);
      if (imagePart) {
        parts.push(imagePart);
        parts.push({ text: "Use this image as a visual reference for the location's architecture, colors, and overall aesthetic." });
      }
    }

    const response = await gemini.models.generateContent({
      model: MODEL,
      contents: [{ role: "user", parts }],
      config: {
        responseModalities: ["IMAGE"],
        imageConfig: { aspectRatio: "1:1", imageSize: "1K" },
      },
    });

    const imgPart = response.candidates?.[0]?.content?.parts?.find(
      (p: any) => p.inlineData?.data
    );

    if (!imgPart?.inlineData?.data) {
      console.error("Gemini response:", JSON.stringify(response, null, 2));
      throw new Error("Gemini did not return an image");
    }

    const imageUrl = await uploadToCloudinary(imgPart.inlineData.data, locationId);
    console.log("✅ Location portrait uploaded to Cloudinary:", imageUrl);

    await db
      .update(locations)
      .set({
        portraitImageUrl: imageUrl,
        updatedAt: new Date(),
      })
      .where(eq(locations.id, locationId));

    return NextResponse.json({ ok: true, url: imageUrl });
  } catch (error: any) {
    console.error("Generate Location Image Error:", error);
    return NextResponse.json({ error: error.message ?? "Internal Server Error" }, { status: 500 });
  }
}