// src/app/api/stories/[id]/ensure-world/route.ts

import { NextResponse } from "next/server";
import { db } from "@/db";
import {
  stories,
  storyPages,
  storyCharacters,
  storyLocations,
  storyStyleGuide,
  storyWorkflowProgress,
} from "@/db/schema";
import { eq, asc, sql } from "drizzle-orm";
import { inngest } from "@/inngest/client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Phase = "extracting" | "building_spreads" | "deciding_scenes" | "ready";

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
    columns: { id: true },
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
     2. LOAD OR CREATE WORKFLOW PROGRESS
  -------------------------------------------------- */

  let progress = await db.query.storyWorkflowProgress.findFirst({
    where: eq(storyWorkflowProgress.storyId, storyId),
  });

  if (!progress) {
    // Check legacy data
    const [charCount, locCount, styleGuide] = await Promise.all([
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
        columns: { id: true },
      }),
    ]);

    const hasWorld =
      charCount[0].count > 0 &&
      locCount[0].count > 0 &&
      Boolean(styleGuide);

    await db.insert(storyWorkflowProgress).values({
      storyId,
      worldExtracted: hasWorld,
      spreadsBuilt: false,
      scenesDecided: false,
    });

    progress = {
      storyId,
    
      worldExtracted: hasWorld,
      spreadsBuilt: false,
      scenesDecided: false,
    
      worldExtractedAt: hasWorld ? new Date() : null,
      spreadsBuiltAt: null,
      scenesDecidedAt: null,
    
      extractingWorld: false,
      buildingSpreads: false,
      decidingScenes: false,
    
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
  }

  /* --------------------------------------------------
     3. DETERMINE CURRENT PHASE
  -------------------------------------------------- */

  let mode: Phase = "extracting";

  if (progress.worldExtracted && progress.spreadsBuilt && progress.scenesDecided) {
    mode = "ready";
  } else if (progress.worldExtracted && progress.spreadsBuilt) {
    mode = "deciding_scenes";
  } else if (progress.worldExtracted) {
    mode = "building_spreads";
  }

  /* --------------------------------------------------
     4. ENSURE CORRECT WORKFLOW IS RUNNING
  -------------------------------------------------- */

  if (mode === "extracting") {
    await inngest.send({
      name: "story/extract-world",
      data: { storyId },
    });
  }

  if (mode === "building_spreads") {
    await inngest.send({
      name: "story/build-spreads",
      data: { storyId },
    });
  }

  if (mode === "deciding_scenes") {
    await inngest.send({
      name: "story/decide-spread-scenes", // ✅ FIXED NAME
      data: { storyId },
    });
  }

  /* --------------------------------------------------
     5. RETURN UI CONTRACT
  -------------------------------------------------- */

  if (mode === "ready") {
    return NextResponse.json({
      status: "complete",
      mode: "ready",
      progress: {
        worldExtracted: true,
        spreadsBuilt: true,
        scenesDecided: true,
      },
    });
  }

  return NextResponse.json({
    status: "processing",
    mode,
    progress: {
      worldExtracted: progress.worldExtracted,
      spreadsBuilt: progress.spreadsBuilt,
      scenesDecided: progress.scenesDecided,
    },
  });
}
