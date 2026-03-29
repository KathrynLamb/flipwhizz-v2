// src/app/api/stories/[id]/debug-cover-payload/route.ts
//
// Returns exactly what would be sent to Gemini for cover generation
// WITHOUT actually calling Gemini. Use this to inspect the prompt.
// DELETE THIS FILE before going to production.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  stories,
  storyStyleGuide,
  characters,
  storyCharacters,
  locations,
  storyLocations,
} from "@/db/schema";
import { eq, sql, inArray } from "drizzle-orm";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: storyId } = await params;

  const story = await db.query.stories.findFirst({
    where: eq(stories.id, storyId),
  });
  if (!story) return NextResponse.json({ error: "Story not found" }, { status: 404 });

  const coverPlan = story.coverPlan as any;

  const planCharIds = Array.isArray(coverPlan?.coverCharacterIds) ? coverPlan.coverCharacterIds : [];
  const planLocIds = Array.isArray(coverPlan?.coverLocationIds) ? coverPlan.coverLocationIds : [];

  // Load style guide
  const style = await db.query.storyStyleGuide.findFirst({
    where: eq(storyStyleGuide.storyId, storyId),
  });

  // Load characters — same logic as cover generation
  let chars: any[];
  if (planCharIds.length > 0) {
    chars = await db
      .select({
        id: characters.id,
        name: characters.name,
        species: characters.species,
        breed: characters.breed,
        imageUrl: sql<string>`COALESCE(${characters.portraitImageUrl}, ${characters.referenceImageUrl})`,
        appearance: characters.appearance,
        visualDetails: characters.visualDetails,
        portraitImageUrl: characters.portraitImageUrl,
        referenceImageUrl: characters.referenceImageUrl,
        fullBodyImageUrl: characters.fullBodyImageUrl,
      })
      .from(characters)
      .where(inArray(characters.id, planCharIds));
  } else {
    chars = await db
      .select({
        id: characters.id,
        name: characters.name,
        species: characters.species,
        breed: characters.breed,
        imageUrl: sql<string>`COALESCE(${characters.portraitImageUrl}, ${characters.referenceImageUrl})`,
        appearance: characters.appearance,
        visualDetails: characters.visualDetails,
        portraitImageUrl: characters.portraitImageUrl,
        referenceImageUrl: characters.referenceImageUrl,
        fullBodyImageUrl: characters.fullBodyImageUrl,
      })
      .from(storyCharacters)
      .innerJoin(characters, eq(storyCharacters.characterId, characters.id))
      .where(eq(storyCharacters.storyId, storyId));
  }

  // Load location
  let locationRef: any = null;
  if (planLocIds.length > 0) {
    locationRef = await db
      .select({
        id: locations.id,
        name: locations.name,
        imageUrl: sql<string>`COALESCE(${locations.portraitImageUrl}, ${locations.referenceImageUrl})`,
        description: locations.description,
      })
      .from(locations)
      .where(inArray(locations.id, planLocIds))
      .limit(1)
      .then((r) => r[0]);
  }

  return NextResponse.json({
    coverPlan,
    planCharIds,
    planLocIds,
    styleGuide: style ? {
      artStyle: style.artStyle,
      userNotes: style.userNotes,
      negativePrompt: style.negativePrompt,
      hasSampleImage: !!style.sampleIllustrationUrl,
      sampleImageUrl: style.sampleIllustrationUrl,
    } : null,
    characters: chars.map((c) => ({
      id: c.id,
      name: c.name,
      species: c.species,
      breed: c.breed,
      appearance: c.appearance?.substring(0, 200),
      hasAnimalProfile: !!(c.visualDetails as any)?.animalProfile,
      animalProfile: (c.visualDetails as any)?.animalProfile ?? null,
      portraitImageUrl: c.portraitImageUrl,
      referenceImageUrl: c.referenceImageUrl,
      fullBodyImageUrl: c.fullBodyImageUrl,
      resolvedImageUrl: c.imageUrl,
      isDataUrl: c.imageUrl?.startsWith("data:image") ?? false,
    })),
    location: locationRef ? {
      id: locationRef.id,
      name: locationRef.name,
      imageUrl: locationRef.imageUrl,
      description: locationRef.description?.substring(0, 200),
      isDataUrl: locationRef.imageUrl?.startsWith("data:image") ?? false,
    } : null,
  });
}