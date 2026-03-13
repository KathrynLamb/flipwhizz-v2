// import { db } from "@/db";
// import {
//   stories,
//   characters,
//   locations,
//   storyPages,
//   storyCharacters,
//   storyLocations,
//   storyStyleGuide,
//   storySpreads
// } from "@/db/schema";
// import { eq, asc, sql } from "drizzle-orm";
// import { NextResponse } from "next/server";

// export const dynamic = "force-dynamic";
// export const revalidate = 0;

// export async function GET(
//   _req: Request,
//   { params }: { params: Promise<{ id: string }> }
// ) {
//   const { id: storyId } = await params;

//   try {
//     /* -------------------------------------------------
//        1) STORY (SAFE)
//     -------------------------------------------------- */
//     const story = await db
//       .select({
//         id: stories.id,
//         title: stories.title,
//         status: stories.status,
//       })
//       .from(stories)
//       .where(eq(stories.id, storyId))
//       .limit(1)
//       .then(r => r[0]);

//     if (!story) {
//       // ⚠️ polling-safe: still return JSON
//       return NextResponse.json({
//         story: null,
//         characters: [],
//         locations: [],
//         style: null,
//         pages: [],
//       });
//     }

//     /* -------------------------------------------------
//        2) CHARACTERS
//     -------------------------------------------------- */
//     const fetchedCharacters = await db
//       .select({
//         id: characters.id,
//         name: characters.name,
//         description: characters.description,
//         appearance: characters.appearance,
//         personalityTraits: characters.personalityTraits,
//         visualDetails: characters.visualDetails,
//         portraitImageUrl: characters.portraitImageUrl,
//         referenceImageUrl: characters.referenceImageUrl,
//         locked: characters.locked,
//         role: storyCharacters.role,
//         arcSummary: storyCharacters.arcSummary,
//       })
//       .from(storyCharacters)
//       .innerJoin(characters, eq(storyCharacters.characterId, characters.id))
//       .where(eq(storyCharacters.storyId, storyId));

//     /* -------------------------------------------------
//        3) LOCATIONS
//     -------------------------------------------------- */
//     const fetchedLocations = await db
//       .select({
//         id: locations.id,
//         name: locations.name,
//         description: locations.description,
//         visualDetails: locations.visualDetails,
//         portraitImageUrl: locations.portraitImageUrl,
//         referenceImageUrl: locations.referenceImageUrl,
//         locked: locations.locked,
//         significance: storyLocations.significance,
//       })
//       .from(storyLocations)
//       .innerJoin(locations, eq(storyLocations.locationId, locations.id))
//       .where(eq(storyLocations.storyId, storyId));

//     /* -------------------------------------------------
//        4) STYLE GUIDE
//     -------------------------------------------------- */
//     const styleGuide = await db
//       .select({
//         id: storyStyleGuide.id,
//         summary: storyStyleGuide.summary,
//         negativePrompt: storyStyleGuide.negativePrompt,
//         artStyle: storyStyleGuide.artStyle,
//         colorPalette: storyStyleGuide.colorPalette,
//         visualThemes: storyStyleGuide.visualThemes,
//         sampleIllustrationUrl: storyStyleGuide.sampleIllustrationUrl,
//       })
//       .from(storyStyleGuide)
//       .where(eq(storyStyleGuide.storyId, storyId))
//       .limit(1)
//       .then(r => r[0] ?? null);

//     /* -------------------------------------------------
//        5) PAGES
//     -------------------------------------------------- */
//     const pages = await db
//       .select({
//         id: storyPages.id,
//         pageNumber: storyPages.pageNumber,
//       })
//       .from(storyPages)
//       .where(eq(storyPages.storyId, storyId))
//       .orderBy(asc(storyPages.pageNumber));

//     return NextResponse.json({
//       story,
//       characters: fetchedCharacters ?? [],
//       locations: fetchedLocations ?? [],
//       style: styleGuide,
//       pages: pages ?? [],
//     });
//   } catch (err) {
//     console.error("WORLD ROUTE ERROR", err);

//     const [{ count: spreadCount }] = await db
//   .select({ count: sql<number>`count(*)` })
//   .from(storySpreads)
//   .where(eq(storySpreads.storyId, storyId));


//     // 🔑 CRITICAL: never throw during polling
//     return NextResponse.json({
//       story: null,
//       characters: [],
//       locations: [],
//       style: null,
//       pages: [],
//       spreadCount,
//       error: "world_fetch_failed",
//     });
//   }
// }



// src/app/api/stories/[id]/world/route.ts

import { NextResponse } from "next/server";
import { db } from "@/db";
import {
  characters,
  locations,
  storyCharacters,
  storyLocations,
  characterStoryOutfits,
} from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: storyId } = await params;

  if (!storyId) {
    return NextResponse.json(
      { error: "storyId is required" },
      { status: 400 }
    );
  }

  try {
    // Characters linked to this story + their core fields
    const storyChars = await db
      .select({
        id: characters.id,
        name: characters.name,
        description: characters.description,
        appearance: characters.appearance,
        portraitImageUrl: characters.portraitImageUrl,
        referenceImageUrl: characters.referenceImageUrl,
        role: storyCharacters.role,
      })
      .from(storyCharacters)
      .innerJoin(characters, eq(storyCharacters.characterId, characters.id))
      .where(eq(storyCharacters.storyId, storyId));

    // Outfits for all characters in this story
    const outfits = await db
      .select({
        characterId: characterStoryOutfits.characterId,
        outfitKey: characterStoryOutfits.outfitKey,
        outfitDescription: characterStoryOutfits.outfitDescription,
        isDefault: characterStoryOutfits.isDefault,
      })
      .from(characterStoryOutfits)
      .where(eq(characterStoryOutfits.storyId, storyId));

    // Group outfits by character
    const outfitsByCharacter = new Map<
      string,
      typeof outfits
    >();
    for (const o of outfits) {
      const existing = outfitsByCharacter.get(o.characterId) ?? [];
      existing.push(o);
      outfitsByCharacter.set(o.characterId, existing);
    }

    const charactersWithOutfits = storyChars.map((c) => ({
      ...c,
      imageUrl: c.portraitImageUrl ?? c.referenceImageUrl ?? null,
      outfits: outfitsByCharacter.get(c.id) ?? [],
    }));

    // Locations linked to this story
    const storyLocs = await db
      .select({
        id: locations.id,
        name: locations.name,
        description: locations.description,
        portraitImageUrl: locations.portraitImageUrl,
        referenceImageUrl: locations.referenceImageUrl,
        significance: storyLocations.significance,
      })
      .from(storyLocations)
      .innerJoin(locations, eq(storyLocations.locationId, locations.id))
      .where(eq(storyLocations.storyId, storyId));

    const locationsWithImages = storyLocs.map((l) => ({
      ...l,
      imageUrl: l.portraitImageUrl ?? l.referenceImageUrl ?? null,
    }));

    return NextResponse.json({
      characters: charactersWithOutfits,
      locations: locationsWithImages,
    });
  } catch (err) {
    console.error("World API error:", err);
    return NextResponse.json(
      { error: "Failed to load world data" },
      { status: 500 }
    );
  }
}