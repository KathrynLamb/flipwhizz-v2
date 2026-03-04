// app/api/stories/[id]/spreads-preview/route.ts

import { NextRequest, NextResponse } from "next/server";
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
} from "@/db/schema";
import { eq, inArray, asc } from "drizzle-orm";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: storyId } = await params;

  if (!storyId) {
    return NextResponse.json({ error: "storyId required" }, { status: 400 });
  }

  try {
    // 1. Fetch spreads
    const spreads = await db
      .select({
        id: storySpreads.id,
        index: storySpreads.spreadIndex,
        leftPageId: storySpreads.leftPageId,
        rightPageId: storySpreads.rightPageId,
        sceneSummary: storySpreads.sceneSummary,
      })
      .from(storySpreads)
      .where(eq(storySpreads.storyId, storyId))
      .orderBy(asc(storySpreads.spreadIndex));

    if (!spreads.length) return NextResponse.json([]);

    // 2. Collect all page IDs
    const pageIds = [
      ...spreads.map((s) => s.leftPageId).filter((id): id is string => !!id),
      ...spreads.map((s) => s.rightPageId).filter((id): id is string => !!id),
    ];

    // 3. Fetch pages
    const pages =
      pageIds.length > 0
        ? await db
            .select({
              id: storyPages.id,
              text: storyPages.text,
              imageUrl: storyPages.imageUrl,
              pageNumber: storyPages.pageNumber,
            })
            .from(storyPages)
            .where(inArray(storyPages.id, pageIds))
        : [];

    // 4. Fetch per-page character assignments
    const pageCharAssignments =
      pageIds.length > 0
        ? await db
            .select({
              pageId: storyPageCharacters.pageId,
              characterId: storyPageCharacters.characterId,
            })
            .from(storyPageCharacters)
            .where(inArray(storyPageCharacters.pageId, pageIds))
        : [];

    // 5. Fetch per-page location assignments
    const pageLocAssignments =
      pageIds.length > 0
        ? await db
            .select({
              pageId: storyPageLocations.pageId,
              locationId: storyPageLocations.locationId,
            })
            .from(storyPageLocations)
            .where(inArray(storyPageLocations.pageId, pageIds))
        : [];

    // 6. Fetch character & location metadata
    const allChars = await db
      .select({
        id: characters.id,
        name: characters.name,
        portraitImageUrl: characters.portraitImageUrl,
        referenceImageUrl: characters.referenceImageUrl,
      })
      .from(characters)
      .innerJoin(storyCharacters, eq(characters.id, storyCharacters.characterId))
      .where(eq(storyCharacters.storyId, storyId));

    const allLocs = await db
      .select({
        id: locations.id,
        name: locations.name,
        portraitImageUrl: locations.portraitImageUrl,
        referenceImageUrl: locations.referenceImageUrl,
      })
      .from(locations)
      .innerJoin(storyLocations, eq(locations.id, storyLocations.locationId))
      .where(eq(storyLocations.storyId, storyId));

    // 7. Assemble response
    const result = spreads.map((s, i) => {
      const spreadPageIds = [s.leftPageId, s.rightPageId].filter(Boolean) as string[];

      // Resolve characters from per-page assignments
      const charIdsInSpread = [
        ...new Set(
          pageCharAssignments
            .filter((a) => spreadPageIds.includes(a.pageId))
            .map((a) => a.characterId)
        ),
      ];
      const assignedChars = charIdsInSpread
        .map((cid) => {
          const char = allChars.find((c) => c.id === cid);
          return char
            ? {
                id: char.id,
                name: char.name,
                imageUrl: char.portraitImageUrl || char.referenceImageUrl || null,
              }
            : null;
        })
        .filter((c): c is { id: string; name: string; imageUrl: string | null } => !!c);

      // Resolve location from per-page assignments
      const locAssignment = pageLocAssignments.find((a) =>
        spreadPageIds.includes(a.pageId)
      );
      const loc = locAssignment
        ? allLocs.find((l) => l.id === locAssignment.locationId)
        : null;

      // Resolve pages
      const left = pages.find((p) => p.id === s.leftPageId);
      const right = s.rightPageId
        ? pages.find((p) => p.id === s.rightPageId)
        : null;

      const leftNum = left?.pageNumber;
      const rightNum = right?.pageNumber;
      const pageLabel =
        leftNum && rightNum
          ? `Pages ${leftNum}\u2013${rightNum}`
          : leftNum
            ? `Page ${leftNum}`
            : `Spread ${(s.index ?? i) + 1}`;

      return {
        spreadId: s.id,
        spreadIndex: s.index ?? i,
        pageLabel,
        leftPageId: s.leftPageId,
        rightPageId: s.rightPageId ?? null,
        leftText: left?.text ?? "",
        rightText: right?.text ?? null,
        existingImageUrl: left?.imageUrl ?? null,
        scene: s.sceneSummary || "",
        mood: null as string | null,
        characters: assignedChars,
        location: loc
          ? {
              id: loc.id,
              name: loc.name,
              imageUrl: loc.portraitImageUrl || loc.referenceImageUrl || null,
            }
          : null,
      };
    });

    return NextResponse.json(result);
  } catch (err: any) {
    console.error("[spreads-preview]", err);
    return NextResponse.json(
      { error: err?.message ?? "Internal error" },
      { status: 500 }
    );
  }
}