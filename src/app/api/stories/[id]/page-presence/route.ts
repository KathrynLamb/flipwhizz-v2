// src/app/api/stories/[id]/page-presence/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  storyPages,
  storyPageCharacters,
  storyPageLocations,
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
    return NextResponse.json({ error: "Missing pages param" }, { status: 400 });
  }

  const pageNumbers = pagesParam
    .split(",")
    .map((n) => Number(n.trim()))
    .filter((n) => Number.isFinite(n));

  if (!pageNumbers.length) {
    return NextResponse.json({ characterIds: [], locationIds: [] });
  }

  // Resolve page IDs (single where with AND)
  const pages = await db
    .select({ id: storyPages.id })
    .from(storyPages)
    .where(and(eq(storyPages.storyId, storyId), inArray(storyPages.pageNumber, pageNumbers)));

  const pageIds = pages.map((p) => p.id);

  if (!pageIds.length) {
    return NextResponse.json({ characterIds: [], locationIds: [] });
  }

  const chars = await db
    .select({ characterId: storyPageCharacters.characterId })
    .from(storyPageCharacters)
    .where(inArray(storyPageCharacters.pageId, pageIds));

  const locs = await db
    .select({ locationId: storyPageLocations.locationId })
    .from(storyPageLocations)
    .where(inArray(storyPageLocations.pageId, pageIds));

  return NextResponse.json({
    characterIds: Array.from(new Set(chars.map((c) => c.characterId))),
    locationIds: Array.from(new Set(locs.map((l) => l.locationId))),
  });
}
