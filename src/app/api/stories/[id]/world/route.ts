import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  stories,
  storyCharacters,
  characters,
  storyLocations,
  locations,
  storyStyleGuide,
} from "@/db/schema";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: storyId } = await context.params;

    if (!storyId) {
      return NextResponse.json({ error: "Missing story id" }, { status: 400 });
    }

    // -------------------------------
    // Story
    // -------------------------------
    const story = await db
      .select()
      .from(stories)
      .where(eq(stories.id, storyId))
      .then((r) => r[0]);

    if (!story) {
      return NextResponse.json({ error: "Story not found" }, { status: 404 });
    }

    // -------------------------------
    // Characters (join -> single query)
    // -------------------------------
    const charRows = await db
      .select()
      .from(storyCharacters)
      .innerJoin(characters, eq(storyCharacters.characterId, characters.id))
      .where(eq(storyCharacters.storyId, storyId));

    const charactersList = charRows.map((r: any) => r.characters);

    // -------------------------------
    // Locations (join -> single query)
    // -------------------------------
    const locRows = await db
      .select()
      .from(storyLocations)
      .innerJoin(locations, eq(storyLocations.locationId, locations.id))
      .where(eq(storyLocations.storyId, storyId));

    const locationsList = locRows.map((r: any) => r.locations);

    // -------------------------------
    // Style guide (this is your "style")
    // -------------------------------
    const guide = await db
      .select()
      .from(storyStyleGuide)
      .where(eq(storyStyleGuide.storyId, storyId))
      .then((r) => r[0] ?? null);

    return NextResponse.json({
      story: {
        id: story.id,
        title: story.title,
        projectId: story.projectId,
        length: story.length,
      },
      characters: charactersList,
      locations: locationsList,
      style: guide
        ? {
            summary: guide.summary ?? null,
            negativePrompt: guide.negativePrompt ?? null,
            userNotes: guide.userNotes ?? null,
            sampleIllustrationUrl: guide.sampleIllustrationUrl ?? null,
          }
        : null,
    });
  } catch (err) {
    console.error("[world GET] error:", err);
    return NextResponse.json(
      { error: "Failed to load story world", details: String(err) },
      { status: 500 }
    );
  }
}
