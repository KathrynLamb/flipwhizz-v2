// src/lib/locations/generateLocationPortrait.ts
//
// Generates and saves an AI portrait for a location from its text description.
// Mirrors the pattern in src/lib/characters/generatePortrait.ts.
//
// Used by:
// - /api/locations/lock (auto-generate if portrait_image_url missing on lock)
// - /api/locations/use-ai-image (explicit generation flow)

import { v2 as cloudinary } from "cloudinary";
import { db } from "@/db";
import {
  locations,
  storyLocations,
  storyStyleGuide,
  stories,
} from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import {
  buildStyleBlock,
  getImagePart,
  runGeminiImageGeneration,
} from "@/lib/characters/generatePortrait";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/* -------------------------------------------------------------------------- */
/*                               HELPERS                                      */
/* -------------------------------------------------------------------------- */

async function getLinkedStoryForLocation(locationId: string) {
  return db
    .select({
      storyId: stories.id,
      userNotes: storyStyleGuide.userNotes,
      negativePrompt: storyStyleGuide.negativePrompt,
      artStyle: storyStyleGuide.artStyle,
      colorPalette: storyStyleGuide.colorPalette,
      sampleIllustrationUrl: storyStyleGuide.sampleIllustrationUrl,
    })
    .from(storyLocations)
    .innerJoin(stories, eq(storyLocations.storyId, stories.id))
    .leftJoin(storyStyleGuide, eq(stories.id, storyStyleGuide.storyId))
    .where(eq(storyLocations.locationId, locationId))
    .orderBy(desc(stories.updatedAt))
    .limit(1)
    .then((rows) => rows[0] ?? null);
}

function buildLocationPrompt(args: {
  locationName: string;
  description: string | null;
  visualDetails: unknown;
  styleBlock: string;
  avoidBlock: string;
}): string {
  const visual = args.visualDetails
    ? typeof args.visualDetails === "string"
      ? args.visualDetails
      : JSON.stringify(args.visualDetails)
    : null;

  return `Generate a LOCATION ESTABLISHING SHOT for a children's book illustration.

LOCATION NAME:
${args.locationName}

DESCRIPTION:
${args.description || `A colourful, inviting location named ${args.locationName}`}

${visual ? `VISUAL DETAILS:\n${visual}\n` : ""}STYLE:
${args.styleBlock}

AVOID:
${args.avoidBlock}

REQUIREMENTS:
- Wide or medium establishing shot showing the full location
- Coherent, inviting spatial layout — paths, landmarks, key features clearly visible
- Atmospheric, warm lighting appropriate for a children's book
- Consistent perspective suitable for reuse as background across multiple spreads
- Plain, uncluttered composition — no text, labels, or logos
- NO characters or people in this image — environment only
- High quality storybook illustration style`.trim();
}

async function uploadLocationPortraitToCloudinary(
  imageBuffer: Buffer,
  locationId: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: `flipwhizz/locations/${locationId}/portrait`,
        resource_type: "image",
        format: "jpeg",
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result!.secure_url);
      }
    );
    stream.end(imageBuffer);
  });
}

/* -------------------------------------------------------------------------- */
/*                               MAIN EXPORT                                  */
/* -------------------------------------------------------------------------- */

export async function generateLocationPortraitFromDescription(
  locationId: string
): Promise<string> {
  const location = await db.query.locations.findFirst({
    where: eq(locations.id, locationId),
  });

  if (!location) throw new Error(`Location ${locationId} not found`);

  const linkedStory = await getLinkedStoryForLocation(locationId);
  const { styleBlock, avoidBlock } = buildStyleBlock(linkedStory ?? {});

  const parts: any[] = [];

  // Style reference image first if available
  if (
    linkedStory?.sampleIllustrationUrl &&
    !linkedStory.sampleIllustrationUrl.startsWith("data:image")
  ) {
    const stylePart = await getImagePart(linkedStory.sampleIllustrationUrl);
    if (stylePart) {
      parts.push(stylePart);
      parts.push({
        text: "↑ STYLE REFERENCE IMAGE ↑\nMatch its brushwork, line quality, colour handling, texture, and overall storybook finish as closely as possible.",
      });
    }
  }

  const prompt = buildLocationPrompt({
    locationName: location.name,
    description: location.description,
    visualDetails: location.visualDetails,
    styleBlock,
    avoidBlock,
  });

  parts.push({ text: prompt });

  console.log(
    `🏞️ Generating location portrait for "${location.name}" (description-only)`
  );

  const image = await runGeminiImageGeneration(parts);
  if (!image)
    throw new Error(
      `Gemini failed to generate portrait for location "${location.name}"`
    );

  const imageBuffer = Buffer.from(image.data, "base64");
  const imageUrl = await uploadLocationPortraitToCloudinary(
    imageBuffer,
    locationId
  );

  await db
    .update(locations)
    .set({ portraitImageUrl: imageUrl, updatedAt: new Date() })
    .where(eq(locations.id, locationId));

  console.log(`✅ Location portrait saved for "${location.name}": ${imageUrl}`);
  return imageUrl;
}