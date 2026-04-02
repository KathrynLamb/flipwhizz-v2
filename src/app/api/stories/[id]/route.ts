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

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id: storyId } = await context.params;

  try {
    const body = await req.json();
    const allowedFields: Record<string, any> = {};

    if (body.title !== undefined) allowedFields.title = body.title;
    if (body.status !== undefined) allowedFields.status = body.status;
    if (body.coverPlan !== undefined) allowedFields.coverPlan = body.coverPlan;

    if (Object.keys(allowedFields).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    await db.update(stories).set(allowedFields).where(eq(stories.id, storyId));

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("PATCH /api/stories/[id] error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
