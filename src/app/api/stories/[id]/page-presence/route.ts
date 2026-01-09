// src/app/api/stories/[id]/page-presence/route.ts

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  storyPages,
  storyPageCharacters,
  storyPageLocations,
  storyCharacters,
  storyLocations,
} from "@/db/schema";
import { and, eq, inArray } from "drizzle-orm";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: storyId } = await context.params;

  const pagesParam = request.nextUrl.searchParams.get("pages");
  if (!pagesParam) {
    return NextResponse.json(
      { error: "Missing pages param" },
      { status: 400 }
    );
  }

  const pageNumbers = pagesParam
    .split(",")
    .map((n) => Number(n.trim()))
    .filter((n) => Number.isFinite(n));

  if (!pageNumbers.length) {
    return NextResponse.json({
      characterIds: [],
      locationIds: [],
    });
  }

  /* --------------------------------------------------
     1️⃣ Resolve page IDs
  -------------------------------------------------- */

  const pages = await db
    .select({ id: storyPages.id })
    .from(storyPages)
    .where(
      and(
        eq(storyPages.storyId, storyId),
        inArray(storyPages.pageNumber, pageNumbers)
      )
    );

  const pageIds = pages.map((p) => p.id);

  if (!pageIds.length) {
    return NextResponse.json({
      characterIds: [],
      locationIds: [],
    });
  }

  /* --------------------------------------------------
     2️⃣ Fetch existing page presence
  -------------------------------------------------- */

  const chars = await db
    .select({ characterId: storyPageCharacters.characterId })
    .from(storyPageCharacters)
    .where(inArray(storyPageCharacters.pageId, pageIds));

  const locs = await db
    .select({ locationId: storyPageLocations.locationId })
    .from(storyPageLocations)
    .where(inArray(storyPageLocations.pageId, pageIds));

  const hasPresence = chars.length > 0 || locs.length > 0;

  /* --------------------------------------------------
     3️⃣ SELF-HEAL if presence is missing
        (fallback assignment)
  -------------------------------------------------- */

  if (!hasPresence && pageIds.length > 0) {
    const firstPageId = pageIds[0];

    // Fetch all story characters & locations
    const [storyChars, storyLocs] = await Promise.all([
      db
        .select({ characterId: storyCharacters.characterId })
        .from(storyCharacters)
        .where(eq(storyCharacters.storyId, storyId)),

      db
        .select({ locationId: storyLocations.locationId })
        .from(storyLocations)
        .where(eq(storyLocations.storyId, storyId)),
    ]);

    // Insert fallback presence (idempotent)
    await db.transaction(async (tx) => {
      for (const c of storyChars) {
        await tx
          .insert(storyPageCharacters)
          .values({
            pageId: firstPageId,
            characterId: c.characterId,
            source: "fallback",
          })
          .onConflictDoNothing();
      }

      for (const l of storyLocs) {
        await tx
          .insert(storyPageLocations)
          .values({
            pageId: firstPageId,
            locationId: l.locationId,
            source: "fallback",
          })
          .onConflictDoNothing();
      }
    });

    // Re-fetch after repair
    const repairedChars = await db
      .select({ characterId: storyPageCharacters.characterId })
      .from(storyPageCharacters)
      .where(inArray(storyPageCharacters.pageId, pageIds));

    const repairedLocs = await db
      .select({ locationId: storyPageLocations.locationId })
      .from(storyPageLocations)
      .where(inArray(storyPageLocations.pageId, pageIds));

    return NextResponse.json({
      characterIds: Array.from(
        new Set(repairedChars.map((c) => c.characterId))
      ),
      locationIds: Array.from(
        new Set(repairedLocs.map((l) => l.locationId))
      ),
      repaired: true,
    });
  }

  /* --------------------------------------------------
     4️⃣ Normal return (presence already existed)
  -------------------------------------------------- */

  return NextResponse.json({
    characterIds: Array.from(new Set(chars.map((c) => c.characterId))),
    locationIds: Array.from(new Set(locs.map((l) => l.locationId))),
    repaired: false,
  });
}
