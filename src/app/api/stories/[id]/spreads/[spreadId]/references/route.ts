// src/app/api/stories/[id]/spreads/[spreadId]/references/route.ts

import { db } from "@/db";
import {
  storySpreads,
  storyPages,
  storyPageCharacters,
  storyPageLocations,
  characters,
  locations,
  storyCharacters,
  storyLocations,
  storyStyleGuide,
  characterStoryOutfits,
  spreadCharacterOutfits,
} from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; spreadId: string }> }
) {
  const { id: storyId, spreadId } = await params;

  /* ───────── 1. Spread ───────── */

  const spread = await db.query.storySpreads.findFirst({
    where: and(
      eq(storySpreads.id, spreadId),
      eq(storySpreads.storyId, storyId)
    ),
  });

  if (!spread) {
    return NextResponse.json({ error: "Spread not found" }, { status: 404 });
  }

  /* ───────── 2. Pages for this spread ───────── */

  const spreadPageIds = [spread.leftPageId, spread.rightPageId].filter(
    Boolean
  ) as string[];

  const pages = spreadPageIds.length
    ? await db
        .select()
        .from(storyPages)
        .where(inArray(storyPages.id, spreadPageIds))
    : [];

  /* ───────── 3. Per-page character assignments (like debug-spreads) ───────── */

  const pageCharAssignments = spreadPageIds.length
    ? await db
        .select({
          pageId: storyPageCharacters.pageId,
          characterId: storyPageCharacters.characterId,
        })
        .from(storyPageCharacters)
        .where(inArray(storyPageCharacters.pageId, spreadPageIds))
    : [];

  const assignedCharacterIds = [
    ...new Set(pageCharAssignments.map((a) => a.characterId)),
  ];

  /* ───────── 4. Per-page location assignments (like debug-spreads) ───────── */

  const pageLocAssignments = spreadPageIds.length
    ? await db
        .select({
          pageId: storyPageLocations.pageId,
          locationId: storyPageLocations.locationId,
        })
        .from(storyPageLocations)
        .where(inArray(storyPageLocations.pageId, spreadPageIds))
    : [];

  const assignedLocationIds = [
    ...new Set(pageLocAssignments.map((a) => a.locationId)),
  ];

  /* ───────── 5. All story characters ───────── */

  const storyCharacterRows = await db
    .select({
      characterId: storyCharacters.characterId,
      role: storyCharacters.role,
    })
    .from(storyCharacters)
    .where(eq(storyCharacters.storyId, storyId));

  const allCharacterIds = storyCharacterRows.map((sc) => sc.characterId);

  const allCharacterData = allCharacterIds.length
    ? await db
        .select({
          id: characters.id,
          name: characters.name,
          portraitImageUrl: characters.portraitImageUrl,
          fullBodyImageUrl: characters.fullBodyImageUrl,
          referenceImageUrl: characters.referenceImageUrl,
          description: characters.description,
        })
        .from(characters)
        .where(inArray(characters.id, allCharacterIds))
    : [];

  /* ───────── 6. All story locations ───────── */

  const storyLocationRows = await db
    .select({
      locationId: storyLocations.locationId,
      significance: storyLocations.significance,
    })
    .from(storyLocations)
    .where(eq(storyLocations.storyId, storyId));

  const allLocationIds = storyLocationRows.map((sl) => sl.locationId);

  const allLocationData = allLocationIds.length
    ? await db
        .select({
          id: locations.id,
          name: locations.name,
          portraitImageUrl: locations.portraitImageUrl,
          referenceImageUrl: locations.referenceImageUrl,
          description: locations.description,
        })
        .from(locations)
        .where(inArray(locations.id, allLocationIds))
    : [];

  /* ───────── 7. Outfit data ───────── */

  // Current outfit assignments for this spread
  const outfitAssignments = await db
    .select()
    .from(spreadCharacterOutfits)
    .where(eq(spreadCharacterOutfits.spreadId, spreadId));

  // All available outfits for this story
  const allOutfits = await db
    .select()
    .from(characterStoryOutfits)
    .where(eq(characterStoryOutfits.storyId, storyId));

  const outfitsByCharacter: Record<
    string,
    { outfitKey: string; outfitDescription: string; isDefault: boolean }[]
  > = {};
  for (const o of allOutfits) {
    if (!outfitsByCharacter[o.characterId]) {
      outfitsByCharacter[o.characterId] = [];
    }
    outfitsByCharacter[o.characterId].push({
      outfitKey: o.outfitKey,
      outfitDescription: o.outfitDescription,
      isDefault: o.isDefault,
    });
  }

  /* ───────── 8. Style guide ───────── */

  const styleGuide = await db.query.storyStyleGuide.findFirst({
    where: eq(storyStyleGuide.storyId, storyId),
  });

  /* ───────── 9. Build response ───────── */

  const assignedCharacterIdSet = new Set(assignedCharacterIds);

  const assignedCharacters = assignedCharacterIds.map((cid) => {
    const char = allCharacterData.find((c) => c.id === cid);
    const storyRole =
      storyCharacterRows.find((sc) => sc.characterId === cid)?.role ?? null;
    const outfitAssignment = outfitAssignments.find(
      (oa) => oa.characterId === cid
    );

    return {
      characterId: cid,
      name: char?.name ?? "Unknown",
      portraitImageUrl: char?.portraitImageUrl ?? null,
      fullBodyImageUrl: char?.fullBodyImageUrl ?? null,
      referenceImageUrl: char?.referenceImageUrl ?? null,
      role: storyRole,
      currentOutfitKey: outfitAssignment?.outfitKey ?? null,
      currentOutfitDescription: outfitAssignment?.outfitDescription ?? null,
      availableOutfits: outfitsByCharacter[cid] ?? [],
    };
  });

  const availableCharacters = allCharacterData
    .filter((c) => !assignedCharacterIdSet.has(c.id))
    .map((c) => {
      const storyRole =
        storyCharacterRows.find((sc) => sc.characterId === c.id)?.role ?? null;
      return {
        characterId: c.id,
        name: c.name,
        portraitImageUrl: c.portraitImageUrl,
        fullBodyImageUrl: c.fullBodyImageUrl,
        referenceImageUrl: c.referenceImageUrl,
        role: storyRole,
        availableOutfits: outfitsByCharacter[c.id] ?? [],
      };
    });

  // Primary location = first location found in page assignments
  const primaryLocationId = assignedLocationIds[0] ?? null;
  const primaryLocation = primaryLocationId
    ? allLocationData.find((l) => l.id === primaryLocationId) ?? null
    : null;

  const allLocationsWithSignificance = allLocationData.map((l) => ({
    ...l,
    significance:
      storyLocationRows.find((sl) => sl.locationId === l.id)?.significance ??
      null,
  }));

  return NextResponse.json({
    spread: {
      id: spread.id,
      spreadIndex: spread.spreadIndex,
      sceneSummary: spread.sceneSummary,
    },
    pages: pages.map((p) => ({
      id: p.id,
      pageNumber: p.pageNumber,
      text: p.text,
      imageUrl: p.imageUrl,
    })),
    assignedCharacters,
    availableCharacters,
    assignedLocation: primaryLocation
      ? {
          ...primaryLocation,
          significance:
            storyLocationRows.find(
              (sl) => sl.locationId === primaryLocation.id
            )?.significance ?? null,
        }
      : null,
    availableLocations: allLocationsWithSignificance,
    styleGuide: styleGuide
      ? {
          summary: styleGuide.summary,
          artStyle: styleGuide.artStyle,
          sampleIllustrationUrl: styleGuide.sampleIllustrationUrl,
        }
      : null,
  });
}