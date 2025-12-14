import { NextResponse } from "next/server";
import { db } from "@/db";

import { eq, and, inArray } from "drizzle-orm";
import {
  stories,
  storyPages,
  storyCharacters,
  characters,
  storyLocations,
  locations,
  storyStyleGuide,
} from "@/db/schema";


export const runtime = "nodejs";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await ctx.params;

    if (!projectId) {
      return NextResponse.json({ error: "Missing project id" }, { status: 400 });
    }

    // 1️⃣ Load the story belonging to this project
    const story = await db
      .select()
      .from(stories)
      .where(eq(stories.projectId, projectId))
      .then((rows) => rows[0] ?? null);

    if (!story) {
      return NextResponse.json({
        story: null,
        pages: [],
        characters: [],
        locations: [],
        style: {},
      });
    }

    const storyId = story.id;

    // 2️⃣ Load pages
    const pagesList = await db
      .select()
      .from(storyPages)
      .where(eq(storyPages.storyId, storyId))
      .orderBy(storyPages.pageNumber);

    // 3️⃣ Characters
    const charLinks = await db
      .select()
      .from(storyCharacters)
      .where(eq(storyCharacters.storyId, storyId));

    const characterList =
      charLinks.length > 0
        ? await db
            .select()
            .from(characters)
            .where(
              inArray(
                characters.id,
                charLinks.map((c) => c.characterId)
              )
            )
        : [];

    // 4️⃣ Locations
    const locLinks = await db
      .select()
      .from(storyLocations)
      .where(eq(storyLocations.storyId, storyId));

    const locationList =
      locLinks.length > 0
        ? await db
            .select()
            .from(locations)
            .where(
              inArray(
                locations.id,
                locLinks.map((l) => l.locationId)
              )
            )
        : [];

    // 5️⃣ Style (stored directly on story.style JSON)
// 6️⃣ Load style guide (optional)
const styleGuide = await db
  .select()
  .from(storyStyleGuide)
  .where(eq(storyStyleGuide.storyId, storyId))
  .then((rows) => rows[0] ?? null);


    return NextResponse.json({
      story,
      pages: pagesList,
      characters: characterList,
      locations: locationList,
      styleGuide,
    });
  } catch (err) {
    console.error("[project story GET] error:", err);
    return NextResponse.json(
      { error: "Failed to load story bundle", details: String(err) },
      { status: 500 }
    );
  }
}
