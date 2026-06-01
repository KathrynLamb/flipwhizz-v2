// ═══════════════════════════════════════════════════════════════
// FILE 1: src/app/api/stories/[id]/cover-references/route.ts
// ═══════════════════════════════════════════════════════════════
//
// Returns exactly what Gemini will receive for cover generation:
// characters (with portrait URLs), location, style ref, and cover plan.

import { NextResponse } from "next/server";
import { db } from "@/db";
import {
  stories, characters, locations,
  storyCharacters, storyLocations,
  storyStyleGuide, storyPages,
} from "@/db/schema";
import { eq, inArray, asc, sql } from "drizzle-orm";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: storyId } = await params;

    const story = await db.query.stories.findFirst({
      where: eq(stories.id, storyId),
    });

    if (!story) return NextResponse.json({ error: "Story not found" }, { status: 404 });

    const coverPlan = story.coverPlan as any;
    const planCharIds: string[] = Array.isArray(coverPlan?.coverCharacterIds)
      ? coverPlan.coverCharacterIds
      : Array.isArray(coverPlan?.generationStrategy?.characterIds)
      ? coverPlan.generationStrategy.characterIds
      : [];

    const planLocIds: string[] = Array.isArray(coverPlan?.coverLocationIds)
      ? coverPlan.coverLocationIds
      : Array.isArray(coverPlan?.generationStrategy?.locationIds)
      ? coverPlan.generationStrategy.locationIds
      : [];

    // Characters
    const charRows = planCharIds.length > 0
      ? await db.select({
          id: characters.id,
          name: characters.name,
          portraitUrl: characters.portraitImageUrl,
          referenceUrl: characters.referenceImageUrl,
          appearance: characters.appearance,
          species: characters.species,
          breed: characters.breed,
        }).from(characters).where(inArray(characters.id, planCharIds))
      : await db.select({
          id: characters.id,
          name: characters.name,
          portraitUrl: characters.portraitImageUrl,
          referenceUrl: characters.referenceImageUrl,
          appearance: characters.appearance,
          species: characters.species,
          breed: characters.breed,
        }).from(storyCharacters)
        .innerJoin(characters, eq(storyCharacters.characterId, characters.id))
        .where(eq(storyCharacters.storyId, storyId));

    // Location
    const locRow = planLocIds.length > 0
      ? await db.select({
          id: locations.id,
          name: locations.name,
          portraitUrl: locations.portraitImageUrl,
          referenceUrl: locations.referenceImageUrl,
        }).from(locations).where(inArray(locations.id, planLocIds)).limit(1).then(r => r[0] ?? null)
      : await db.select({
          id: locations.id,
          name: locations.name,
          portraitUrl: locations.portraitImageUrl,
          referenceUrl: locations.referenceImageUrl,
        }).from(storyLocations)
        .innerJoin(locations, eq(storyLocations.locationId, locations.id))
        .where(eq(storyLocations.storyId, storyId))
        .limit(1).then(r => r[0] ?? null);

    // Style guide
    const style = await db.query.storyStyleGuide.findFirst({
      where: eq(storyStyleGuide.storyId, storyId),
    });

    let styleRefUrl: string | null = style?.sampleIllustrationUrl ?? null;
    if (!styleRefUrl || styleRefUrl.startsWith("data:image")) {
      const spreadPage = await db
        .select({ imageUrl: storyPages.imageUrl })
        .from(storyPages)
        .where(eq(storyPages.storyId, storyId))
        .orderBy(asc(storyPages.pageNumber))
        .limit(10)
        .then(pp => pp.find(p => p.imageUrl && !p.imageUrl.startsWith("data:image")));
      styleRefUrl = spreadPage?.imageUrl ?? null;
    }

    // Determine generation approach
    const hasGenerationStrategy = !!coverPlan?.generationStrategy;
    const approach = coverPlan?.generationStrategy?.approach ?? "two-pass";

    return NextResponse.json({
      characters: charRows.map(c => ({
        id: c.id,
        name: c.name,
        portraitUrl: c.portraitUrl,
        referenceUrl: c.referenceUrl,
        appearance: c.appearance,
        species: c.species,
        breed: c.breed,
        hasPortrait: !!c.portraitUrl && !c.portraitUrl.startsWith("data:image"),
        isAnimal: !!(c.species && c.species !== "human"),
      })),
      location: locRow ? {
        id: locRow.id,
        name: locRow.name,
        imageUrl: locRow.portraitUrl ?? locRow.referenceUrl ?? null,
      } : null,
      styleRef: {
        url: styleRefUrl,
        isUploadedStyle: !!style?.sampleIllustrationUrl && !style.sampleIllustrationUrl.startsWith("data:image"),
        artStyle: style?.artStyle ?? null,
        summary: style?.userNotes ?? null,
      },
      coverPlan: {
        approach,
        hasGenerationStrategy,
        front: coverPlan?.front ?? null,
        back: coverPlan?.back ?? null,
        spine: coverPlan?.spine ?? null,
        pass1Prompt: coverPlan?.generationStrategy?.pass1Prompt ?? null,
        pass2Prompt: coverPlan?.generationStrategy?.pass2Prompt ?? null,
      },
    });
  } catch (err) {
    console.error("[cover-references]", err);
    return NextResponse.json({ error: "Failed to load cover references" }, { status: 500 });
  }
}