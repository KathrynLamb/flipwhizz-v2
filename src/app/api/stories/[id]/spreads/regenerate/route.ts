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

const MAX_FEATURED_CHARACTERS = 5;

function uniqueIds(values: string[] | undefined | null) {
  return [...new Set((values ?? []).filter(Boolean))];
}

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
    primaryLocationId,
    includedLocationIds,
    freshStart,
    // ── NEW: Strategist plan fields ──
    strategistPlan,
  } = body as {
    pageIds: string[];
    spreadId: string | null;
    feedback: string;
    includedCharacterIds: string[];
    outfitOverrides: Record<string, string>;
    locationId?: string | null;
    primaryLocationId?: string | null;
    includedLocationIds?: string[];
    freshStart?: boolean;
    strategistPlan?: {
      featuredCharacterIds: string[];
      backgroundCharacterIds: string[];
      hiddenCharacterIds: string[];
      recommendedPrompt: string;
      outfitOverrides?: Record<string, string>;
      notesToUser?: string;
    } | null;
  };

  if (!pageIds?.length) {
    return NextResponse.json(
      { error: "pageIds are required" },
      { status: 400 }
    );
  }

  // ── When a strategist plan is provided, derive character lists from it ──
  // Otherwise fall back to the flat includedCharacterIds (legacy path)
  const hasPlan = !!strategistPlan;

  const planFeaturedIds = uniqueIds(strategistPlan?.featuredCharacterIds);
  const planBackgroundIds = uniqueIds(strategistPlan?.backgroundCharacterIds);
  const planHiddenIds = uniqueIds(strategistPlan?.hiddenCharacterIds);

  // For DB persistence and the max-characters guard, "included" = featured + background
  // Hidden characters are intentionally excluded from the generation entirely
  const normalizedCharacterIds = hasPlan
    ? uniqueIds([...planFeaturedIds, ...planBackgroundIds])
    : uniqueIds(includedCharacterIds);

  const mergedOutfitOverrides = {
    ...(outfitOverrides ?? {}),
    ...(strategistPlan?.outfitOverrides ?? {}),
  };

  const normalizedIncludedLocationIds = uniqueIds(includedLocationIds);
  const resolvedPrimaryLocationId =
    primaryLocationId ?? locationId ?? normalizedIncludedLocationIds[0] ?? null;

  if (planFeaturedIds.length > MAX_FEATURED_CHARACTERS) {
    return NextResponse.json(
      {
        error: `You can choose up to ${MAX_FEATURED_CHARACTERS} featured characters for one spread.`,
      },
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
  if (normalizedCharacterIds.length > 0) {
    const existingAssignments = await db
      .select({
        pageId: storyPageCharacters.pageId,
        characterId: storyPageCharacters.characterId,
      })
      .from(storyPageCharacters)
      .where(inArray(storyPageCharacters.pageId, pageIds));

    const existingCharIds = new Set(
      existingAssignments.map((a) => a.characterId)
    );
    const wantedCharIds = new Set(normalizedCharacterIds);

    const toAdd = normalizedCharacterIds.filter((cid) => !existingCharIds.has(cid));
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

  // ── Persist location overrides ──
  const finalLocationIds = uniqueIds([
    ...(resolvedPrimaryLocationId ? [resolvedPrimaryLocationId] : []),
    ...normalizedIncludedLocationIds,
  ]);

  if (finalLocationIds.length > 0) {
    const existingLocAssignments = await db
      .select({
        pageId: storyPageLocations.pageId,
        locationId: storyPageLocations.locationId,
      })
      .from(storyPageLocations)
      .where(inArray(storyPageLocations.pageId, pageIds));

    const existingLocationIds = new Set(
      existingLocAssignments.map((a) => a.locationId)
    );
    const wantedLocationIds = new Set(finalLocationIds);

    const locationSetsMatch =
      existingLocationIds.size === wantedLocationIds.size &&
      [...existingLocationIds].every((id) => wantedLocationIds.has(id));

    if (!locationSetsMatch) {
      if (existingLocAssignments.length > 0) {
        await db
          .delete(storyPageLocations)
          .where(inArray(storyPageLocations.pageId, pageIds));
      }

      await db.insert(storyPageLocations).values(
        finalLocationIds.flatMap((locId) =>
          pageIds.map((pageId) => ({
            storyId,
            pageId,
            locationId: locId,
            canonical: true,
            source: "user" as const,
          }))
        )
      );
    }
  }

  // Capture the existing spread image BEFORE clearing
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
              includedCharacterIds: normalizedCharacterIds,
              outfitOverrides: mergedOutfitOverrides,
              locationId: resolvedPrimaryLocationId,
              primaryLocationId: resolvedPrimaryLocationId,
              includedLocationIds: finalLocationIds,
            },
            // ── NEW: Pass strategist plan to the worker ──
            ...(hasPlan
              ? {
                  strategistPlan: {
                    featuredCharacterIds: planFeaturedIds,
                    backgroundCharacterIds: planBackgroundIds,
                    hiddenCharacterIds: planHiddenIds,
                    recommendedPrompt: strategistPlan!.recommendedPrompt,
                    outfitOverrides: strategistPlan!.outfitOverrides ?? {},
                  },
                }
              : {}),
          }),
    },
  });

  return NextResponse.json({
    jobId: `${leftPageId}__${storyId}`,
    status: "started",
  });
}