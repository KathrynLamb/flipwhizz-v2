import { NextResponse } from "next/server";
import { db } from "@/db";
import {
  stories,
  storyPages,
  storyCharacters,
  storyLocations,
  characters,
  locations,
  storyStyleGuide,
} from "@/db/schema";
import { eq, asc } from "drizzle-orm";

export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  // 🔥 unwrap async params (Next 14)
  const { id: storyId } = await context.params;

  if (!storyId) {
    return NextResponse.json(
      { error: "Missing storyId" },
      { status: 400 }
    );
  }

  /* ======================================================
     STORY + STYLE GUIDE
  ====================================================== */

  const row = await db
    .select({
      story: stories,
      sampleIllustrationUrl: storyStyleGuide.sampleIllustrationUrl,
    })
    .from(stories)
    .leftJoin(
      storyStyleGuide,
      eq(storyStyleGuide.storyId, stories.id)
    )
    .where(eq(stories.id, storyId))
    .then((rows) => rows[0]);

  if (!row) {
    return NextResponse.json(
      { error: "Story not found" },
      { status: 404 }
    );
  }

  const { story, sampleIllustrationUrl } = row;

  /* ======================================================
     PAGES
  ====================================================== */

  const pages = await db
    .select()
    .from(storyPages)
    .where(eq(storyPages.storyId, storyId))
    .orderBy(asc(storyPages.pageNumber));

  /* ======================================================
     CHARACTERS
  ====================================================== */

  const characterRows = await db
    .select({
      id: characters.id,
      name: characters.name,
      description: characters.description,
      portraitImageUrl: characters.portraitImageUrl,
      referenceImageUrl: characters.referenceImageUrl,
    })
    .from(storyCharacters)
    .innerJoin(
      characters,
      eq(storyCharacters.characterId, characters.id)
    )
    .where(eq(storyCharacters.storyId, storyId));

  /* ======================================================
     LOCATIONS
  ====================================================== */

  const locationRows = await db
    .select({
      id: locations.id,
      name: locations.name,
      description: locations.description,
      portraitImageUrl: locations.portraitImageUrl,
      referenceImageUrl: locations.referenceImageUrl,
    })
    .from(storyLocations)
    .innerJoin(
      locations,
      eq(storyLocations.locationId, locations.id)
    )
    .where(eq(storyLocations.storyId, storyId));

  /* ======================================================
     RESPONSE
  ====================================================== */

  return NextResponse.json({
    story: {
      ...story,
      sampleIllustrationUrl, // ✅ THIS IS THE FIX
    },
    pages,
    characters: characterRows,
    locations: locationRows,
  });
}
