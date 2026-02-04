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
     2. LOAD WORKFLOW PROGRESS (SINGLE SOURCE OF TRUTH)
  -------------------------------------------------- */

  const progress = await db.query.storyWorkflowProgress.findFirst({
    where: eq(storyWorkflowProgress.storyId, storyId),
  });

  /* --------------------------------------------------
     3. BOOTSTRAP WORKFLOW IF NOT STARTED
  -------------------------------------------------- */

  if (!progress) {
    // Check if world data already exists (from previous runs with old system)
    const [charCountRow, locCountRow, styleCount] = await Promise.all([
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

    const hasExistingWorld = 
      charCountRow[0].count > 0 && 
      locCountRow[0].count > 0 && 
      Boolean(styleCount);

    if (hasExistingWorld) {
      // World already exists - create progress record and skip to spreads
      console.log("🔄 [ensure-world] Existing world data found, starting at build-spreads");

      await db.insert(storyWorkflowProgress).values({
        storyId,
        worldExtracted: true,
        worldExtractedAt: new Date(),
        spreadsBuilt: false,
        scenesDecided: false,
        extractingWorld: false,
        buildingSpreads: true, // Set lock
        decidingScenes: false,
      });

      await inngest.send({
        name: "story/build-spreads",
        data: { storyId },
      });

      return NextResponse.json({
        status: "processing",
        mode: "building_spreads",
        progress: {
          worldExtracted: true,
          spreadsBuilt: false,
          scenesDecided: false,
        },
      });
    } else {
      // No world data - start from beginning
      console.log("🚀 [ensure-world] No world data, starting at extract-world");

      await db.insert(storyWorkflowProgress).values({
        storyId,
        worldExtracted: false,
        spreadsBuilt: false,
        scenesDecided: false,
        extractingWorld: true, // Set lock
        buildingSpreads: false,
        decidingScenes: false,
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
  }


/* --------------------------------------------------
   4. RETURN CURRENT PHASE BASED ON COMPLETION FLAGS
-------------------------------------------------- */

// All phases complete!
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
if (progress.worldExtracted && progress.spreadsBuilt && !progress.scenesDecided) {
  // Check if we need to trigger the workflow
  if (!progress.decidingScenes) {
    console.log("🚀 [ensure-world] Starting decide-scenes workflow");
    
    await db
      .update(storyWorkflowProgress)
      .set({ decidingScenes: true })
      .where(eq(storyWorkflowProgress.storyId, storyId));

    await inngest.send({
      name: "story/decide-scenes",
      data: { storyId },
    });
  }

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
if (progress.worldExtracted && !progress.spreadsBuilt) {
  // Check if we need to trigger the workflow
  if (!progress.buildingSpreads) {
    console.log("🚀 [ensure-world] Starting build-spreads workflow");
    
    await db
      .update(storyWorkflowProgress)
      .set({ buildingSpreads: true })
      .where(eq(storyWorkflowProgress.storyId, storyId));

    await inngest.send({
      name: "story/build-spreads",
      data: { storyId },
    });
  }

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
if (!progress.worldExtracted) {
  // Check if we need to trigger the workflow
  if (!progress.extractingWorld) {
    console.log("🚀 [ensure-world] Starting extract-world workflow");
    
    await db
      .update(storyWorkflowProgress)
      .set({ extractingWorld: true })
      .where(eq(storyWorkflowProgress.storyId, storyId));

    await inngest.send({
      name: "story/extract-world",
      data: { storyId },
    });
  }

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
}