// src/app/api/stories/[id]/spreads/regenerate/route.ts

import { NextRequest, NextResponse } from "next/server";
import { inngest } from "@/inngest/client";
import { db } from "@/db";
import {
  storyPages,
  storySpreads,
  storyPageCharacters,
  storyPageLocations,
} from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: storyId } = await params;
  const body = await req.json();

  const {
    pageIds,
    spreadId,
    feedback,
    includedCharacterIds,
    outfitOverrides,
    locationId,
    freshStart,
  } = body as {
    pageIds: string[];
    spreadId: string | null;
    feedback: string;
    includedCharacterIds: string[];
    outfitOverrides: Record<string, string>;
    locationId: string | null;
    freshStart?: boolean;
  };

  if (!pageIds?.length) {
    return NextResponse.json(
      { error: "pageIds are required" },
      { status: 400 }
    );
  }

  // Resolve the spread to get leftPageId / rightPageId / pageLabel
  let leftPageId = pageIds[0];
  let rightPageId = pageIds[1] ?? null;
  let pageLabel = "Spread";

  if (spreadId) {
    const spread = await db.query.storySpreads.findFirst({
      where: and(
        eq(storySpreads.id, spreadId),
        eq(storySpreads.storyId, storyId)
      ),
    });

    if (spread) {
      leftPageId = spread.leftPageId ?? pageIds[0];
      rightPageId = spread.rightPageId ?? pageIds[1] ?? null;
      pageLabel = `Spread ${spread.spreadIndex}`;
    }
  }

  // ── Persist character overrides so they stick for future redraws ──
  if (includedCharacterIds?.length) {
    // Get current assignments for these pages
    const existingAssignments = await db
      .select({ pageId: storyPageCharacters.pageId, characterId: storyPageCharacters.characterId })
      .from(storyPageCharacters)
      .where(inArray(storyPageCharacters.pageId, pageIds));

    const existingCharIds = new Set(existingAssignments.map((a) => a.characterId));
    const wantedCharIds = new Set(includedCharacterIds);

    // Add new characters that weren't assigned before
    const toAdd = includedCharacterIds.filter((cid) => !existingCharIds.has(cid));
    if (toAdd.length > 0) {
      await db.insert(storyPageCharacters).values(
        toAdd.flatMap((characterId) =>
          pageIds.map((pageId) => ({
            storyId,
            pageId,
            characterId,
            canonical: true,
            source: "user" as const,
          }))
        )
      );
    }

    // Remove characters that were unselected
    const toRemove = [...existingCharIds].filter((cid) => !wantedCharIds.has(cid));
    if (toRemove.length > 0) {
      for (const characterId of toRemove) {
        await db
          .delete(storyPageCharacters)
          .where(
            and(
              inArray(storyPageCharacters.pageId, pageIds),
              eq(storyPageCharacters.characterId, characterId)
            )
          );
      }
    }
  }

  // ── Persist location override ──
  if (locationId) {
    // Get current location assignments for these pages
    const existingLocAssignments = await db
      .select({ pageId: storyPageLocations.pageId, locationId: storyPageLocations.locationId })
      .from(storyPageLocations)
      .where(inArray(storyPageLocations.pageId, pageIds));

    const currentLocId = existingLocAssignments[0]?.locationId;

    if (currentLocId !== locationId) {
      // Remove old location assignments
      if (existingLocAssignments.length > 0) {
        await db
          .delete(storyPageLocations)
          .where(inArray(storyPageLocations.pageId, pageIds));
      }

      // Add new location assignment
      await db.insert(storyPageLocations).values(
        pageIds.map((pageId) => ({
          storyId,
          pageId,
          locationId,
          canonical: true,
          source: "user" as const,
        }))
      );
    }
  }

  // Capture the existing spread image BEFORE clearing
  // so Gemini can see what the user's feedback refers to
  const existingPages = await db
    .select({ id: storyPages.id, imageUrl: storyPages.imageUrl })
    .from(storyPages)
    .where(inArray(storyPages.id, pageIds));

  const existingSpreadImageUrl =
    existingPages.find((p) => p.imageUrl)?.imageUrl ?? null;

  // Clear existing images so polling shows "generating"
  await db
    .update(storyPages)
    .set({ imageUrl: null })
    .where(inArray(storyPages.id, pageIds));

  // Fire Inngest with the same event as generate-spread
  // Fresh start = clean generation with no feedback, no previous image, no overrides
  await inngest.send({
    name: "story/generate.single.spread",
    data: {
      storyId,
      leftPageId,
      rightPageId,
      pageLabel,
      ...(freshStart
        ? {}
        : {
            feedback: feedback || undefined,
            existingSpreadImageUrl,
            referenceOverrides: {
              includedCharacterIds,
              outfitOverrides,
              locationId,
            },
          }),
    },
  });

  return NextResponse.json({
    jobId: `${leftPageId}__${storyId}`,
    status: "started",
  });
}