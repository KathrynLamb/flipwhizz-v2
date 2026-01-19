import { db } from "@/db";
import {
  stories,
  characters,
  locations,
  storyPages,
  storyCharacters,
  storyLocations,
  storyStyleGuide,
  storySpreads
} from "@/db/schema";
import { eq, asc, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: storyId } = await params;

  try {
    /* -------------------------------------------------
       1) STORY (SAFE)
    -------------------------------------------------- */
    const story = await db
      .select({
        id: stories.id,
        title: stories.title,
        status: stories.status,
      })
      .from(stories)
      .where(eq(stories.id, storyId))
      .limit(1)
      .then(r => r[0]);

    if (!story) {
      // ⚠️ polling-safe: still return JSON
      return NextResponse.json({
        story: null,
        characters: [],
        locations: [],
        style: null,
        pages: [],
      });
    }

    /* -------------------------------------------------
       2) CHARACTERS
    -------------------------------------------------- */
    const fetchedCharacters = await db
      .select({
        id: characters.id,
        name: characters.name,
        description: characters.description,
        appearance: characters.appearance,
        personalityTraits: characters.personalityTraits,
        visualDetails: characters.visualDetails,
        portraitImageUrl: characters.portraitImageUrl,
        referenceImageUrl: characters.referenceImageUrl,
        locked: characters.locked,
        role: storyCharacters.role,
        arcSummary: storyCharacters.arcSummary,
      })
      .from(storyCharacters)
      .innerJoin(characters, eq(storyCharacters.characterId, characters.id))
      .where(eq(storyCharacters.storyId, storyId));

    /* -------------------------------------------------
       3) LOCATIONS
    -------------------------------------------------- */
    const fetchedLocations = await db
      .select({
        id: locations.id,
        name: locations.name,
        description: locations.description,
        visualDetails: locations.visualDetails,
        portraitImageUrl: locations.portraitImageUrl,
        referenceImageUrl: locations.referenceImageUrl,
        locked: locations.locked,
        significance: storyLocations.significance,
      })
      .from(storyLocations)
      .innerJoin(locations, eq(storyLocations.locationId, locations.id))
      .where(eq(storyLocations.storyId, storyId));

    /* -------------------------------------------------
       4) STYLE GUIDE
    -------------------------------------------------- */
    const styleGuide = await db
      .select({
        id: storyStyleGuide.id,
        summary: storyStyleGuide.summary,
        negativePrompt: storyStyleGuide.negativePrompt,
        artStyle: storyStyleGuide.artStyle,
        colorPalette: storyStyleGuide.colorPalette,
        visualThemes: storyStyleGuide.visualThemes,
        sampleIllustrationUrl: storyStyleGuide.sampleIllustrationUrl,
      })
      .from(storyStyleGuide)
      .where(eq(storyStyleGuide.storyId, storyId))
      .limit(1)
      .then(r => r[0] ?? null);

    /* -------------------------------------------------
       5) PAGES
    -------------------------------------------------- */
    const pages = await db
      .select({
        id: storyPages.id,
        pageNumber: storyPages.pageNumber,
      })
      .from(storyPages)
      .where(eq(storyPages.storyId, storyId))
      .orderBy(asc(storyPages.pageNumber));

    return NextResponse.json({
      story,
      characters: fetchedCharacters ?? [],
      locations: fetchedLocations ?? [],
      style: styleGuide,
      pages: pages ?? [],
    });
  } catch (err) {
    console.error("WORLD ROUTE ERROR", err);

    const [{ count: spreadCount }] = await db
  .select({ count: sql<number>`count(*)` })
  .from(storySpreads)
  .where(eq(storySpreads.storyId, storyId));


    // 🔑 CRITICAL: never throw during polling
    return NextResponse.json({
      story: null,
      characters: [],
      locations: [],
      style: null,
      pages: [],
      spreadCount,
      error: "world_fetch_failed",
    });
  }
}
