// src/app/api/stories/[id]/ensure-world/route.ts
import { NextResponse } from "next/server";
import { db } from "@/db";
import {
  stories,
  storyPages,
  storyCharacters,
  storyLocations,
  storyStyleGuide,
  storySpreads,
  storySpreadPresence,
  storySpreadScene,
} from "@/db/schema";
import { eq, asc, sql } from "drizzle-orm";
import { inngest } from "@/inngest/client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: storyId } = await params;

  if (!storyId) {
    return NextResponse.json({ error: "Missing storyId" }, { status: 400 });
  }

  /* --------------------------------------------------
     1. LOAD STORY + PAGES
  -------------------------------------------------- */

  const story = await db.query.stories.findFirst({
    where: eq(stories.id, storyId),
    columns: { id: true, status: true },
  });

  if (!story) {
    return NextResponse.json({ error: "Story not found" }, { status: 404 });
  }

  const pages = await db.query.storyPages.findMany({
    where: eq(storyPages.storyId, storyId),
    orderBy: asc(storyPages.pageNumber),
    columns: { id: true },
  });

  if (pages.length === 0) {
    return NextResponse.json({ error: "Story has no pages" }, { status: 400 });
  }

  /* --------------------------------------------------
     2. COUNT CURRENT STATE (AUTHORITATIVE)
  -------------------------------------------------- */

  const [
    characterCountRow,
    locationCountRow,
    style,
    spreadCountRow,
    presenceCountRow,
    sceneCountRow,
  ] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)` })
      .from(storyCharacters)
      .where(eq(storyCharacters.storyId, storyId)),
    db
      .select({ count: sql<number>`count(*)` })
      .from(storyLocations)
      .where(eq(storyLocations.storyId, storyId)),
    db.query.storyStyleGuide.findFirst({
      where: eq(storyStyleGuide.storyId, storyId),
      columns: { summary: true },
    }),
    db
      .select({ count: sql<number>`count(*)` })
      .from(storySpreads)
      .where(eq(storySpreads.storyId, storyId)),
    db
      .select({ count: sql<number>`count(*)` })
      .from(storySpreadPresence)
      .innerJoin(
        storySpreads,
        eq(storySpreadPresence.spreadId, storySpreads.id)
      )
      .where(eq(storySpreads.storyId, storyId)),
    db
      .select({ count: sql<number>`count(*)` })
      .from(storySpreadScene)
      .innerJoin(
        storySpreads,
        eq(storySpreadScene.spreadId, storySpreads.id)
      )
      .where(eq(storySpreads.storyId, storyId)),
  ]);

  const characterCount = characterCountRow[0].count;
  const locationCount = locationCountRow[0].count;
  const spreadCount = spreadCountRow[0].count;
  const presenceCount = presenceCountRow[0].count;
  const sceneCount = sceneCountRow[0].count;

  const hasWorld =
    characterCount > 0 &&
    locationCount > 0 &&
    Boolean(style?.summary);

  const hasSceneAuthority =
    spreadCount > 0 &&
    presenceCount === spreadCount &&
    sceneCount === spreadCount;

  /* --------------------------------------------------
     3. STRICT PHASE ORCHESTRATION (NO FALLTHROUGH)
  -------------------------------------------------- */

  // PHASE 1 — Extract world
  if (!hasWorld) {
    if (story.status !== "extracting") {
      await db
        .update(stories)
        .set({ status: "extracting", updatedAt: new Date() })
        .where(eq(stories.id, storyId));

      await inngest.send({
        name: "story/extract-world",
        data: { storyId },
      });
    }

    return NextResponse.json({
      status: "processing",
      mode: "extracting",
    });
  }

  // PHASE 2 — Build spreads
  if (spreadCount === 0) {
    if (story.status !== "building_spreads") {
      await db
        .update(stories)
        .set({ status: "building_spreads", updatedAt: new Date() })
        .where(eq(stories.id, storyId));

      await inngest.send({
        name: "story/build-spreads",
        data: { storyId },
      });
    }

    return NextResponse.json({
      status: "processing",
      mode: "building_spreads",
    });
  }

  // 🚫 HARD BLOCK — NEVER advance while spreads are building
  if (story.status === "building_spreads") {
    return NextResponse.json({
      status: "processing",
      mode: "building_spreads",
    });
  }

  // PHASE 3 — Decide scene authority
  if (!hasSceneAuthority) {
    if (story.status !== "deciding_scenes") {
      await db
        .update(stories)
        .set({ status: "deciding_scenes", updatedAt: new Date() })
        .where(eq(stories.id, storyId));

      await inngest.send({
        name: "story/decide-spread-scenes",
        data: { storyId },
      });
    }

    return NextResponse.json({
      status: "processing",
      mode: "deciding_scenes",
    });
  }

  /* --------------------------------------------------
     4. COMPLETE
  -------------------------------------------------- */

  if (story.status !== "scenes_ready") {
    await db
      .update(stories)
      .set({ status: "scenes_ready", updatedAt: new Date() })
      .where(eq(stories.id, storyId));
  }

  return NextResponse.json({
    status: "complete",
    mode: "ready",
  });
}
