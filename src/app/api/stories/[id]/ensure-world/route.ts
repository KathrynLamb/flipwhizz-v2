// src/app/api/stories/[id]/ensure-world/route.ts
import { NextResponse } from "next/server";
import { db } from "@/db";
import { stories, storyPages, storyWorkflowProgress } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
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
     1. Validate story exists and has pages
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
     2. Load or create workflow progress
  -------------------------------------------------- */
  let progress = await db.query.storyWorkflowProgress.findFirst({
    where: eq(storyWorkflowProgress.storyId, storyId),
  });

  // Bootstrap workflow if not started
  if (!progress) {
    await db.insert(storyWorkflowProgress).values({
      storyId,
      worldExtracted: false,
      spreadsBuilt: false,
      scenesDecided: false,
    });

    await inngest.send({
      name: "story/extract-world",
      data: { storyId },
    });

    return NextResponse.json({
      status: "processing",
      mode: "extracting",
      progress: {
        worldExtracted: false,
        spreadsBuilt: false,
        scenesDecided: false,
      },
    });
  }

  /* --------------------------------------------------
     3. Return current progress state
  -------------------------------------------------- */
  
  // All complete
  if (progress.worldExtracted && progress.spreadsBuilt && progress.scenesDecided) {
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

  // Deciding scenes
  if (progress.worldExtracted && progress.spreadsBuilt) {
    return NextResponse.json({
      status: "processing",
      mode: "deciding_scenes",
      progress: {
        worldExtracted: true,
        spreadsBuilt: true,
        scenesDecided: false,
      },
    });
  }

  // Building spreads
  if (progress.worldExtracted) {
    return NextResponse.json({
      status: "processing",
      mode: "building_spreads",
      progress: {
        worldExtracted: true,
        spreadsBuilt: false,
        scenesDecided: false,
      },
    });
  }

  // Extracting world
  return NextResponse.json({
    status: "processing",
    mode: "extracting",
    progress: {
      worldExtracted: false,
      spreadsBuilt: false,
      scenesDecided: false,
    },
  });
}