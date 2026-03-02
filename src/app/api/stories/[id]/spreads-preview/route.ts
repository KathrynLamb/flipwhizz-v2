// app/api/stories/[id]/spreads-preview/route.ts

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  storySpreads,
  storySpreadScene,
  storySpreadPresence,
  storyPages,
  characters,
  locations,
  storyCharacters,
  storyLocations,
} from "@/db/schema";
import { eq, inArray, asc } from "drizzle-orm";

type SpreadChar = {
  characterId: string;
  role: string;
  reason: string;
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: storyId } = await params;

  if (!storyId) {
    return NextResponse.json({ error: "storyId required" }, { status: 400 });
  }

  try {
    const spreads = await db
      .select({
        id: storySpreads.id,
        index: storySpreads.spreadIndex,
        leftPageId: storySpreads.leftPageId,
        rightPageId: storySpreads.rightPageId,
        sceneSummary: storySpreadScene.sceneSummary,
        illustrationPrompt: storySpreadScene.illustrationPrompt,
        mood: storySpreadScene.mood,
        primaryLocationId: storySpreadPresence.primaryLocationId,
        charactersJson: storySpreadPresence.characters,
      })
      .from(storySpreads)
      .leftJoin(storySpreadScene, eq(storySpreads.id, storySpreadScene.spreadId))
      .leftJoin(storySpreadPresence, eq(storySpreads.id, storySpreadPresence.spreadId))
      .where(eq(storySpreads.storyId, storyId))
      .orderBy(asc(storySpreads.spreadIndex));

    if (!spreads.length) return NextResponse.json([]);

    const pageIds = [
      ...spreads.map((s) => s.leftPageId).filter((id): id is string => !!id),
      ...spreads.map((s) => s.rightPageId).filter((id): id is string => !!id),
    ];

    const pages = pageIds.length > 0
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

    const result = spreads.map((s, i) => {
      const loc = allLocs.find((l) => l.id === s.primaryLocationId);

      const assignedChars = ((s.charactersJson as SpreadChar[]) || [])
        .map((entry) => {
          const char = allChars.find((c) => c.id === entry.characterId);
          return char
            ? {
                id: char.id,
                name: char.name,
                imageUrl: char.portraitImageUrl || char.referenceImageUrl || null,
              }
            : null;
        })
        .filter((c): c is { id: string; name: string; imageUrl: string | null } => !!c);

      const left = pages.find((p) => p.id === s.leftPageId);
      const right = s.rightPageId ? pages.find((p) => p.id === s.rightPageId) : null;

      const leftNum = left?.pageNumber;
      const rightNum = right?.pageNumber;
      const pageLabel =
        leftNum && rightNum
          ? `Pages ${leftNum}–${rightNum}`
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
        scene: s.sceneSummary || s.illustrationPrompt || "",
        mood: s.mood ?? null,
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
    return NextResponse.json({ error: err?.message ?? "Internal error" }, { status: 500 });
  }
}