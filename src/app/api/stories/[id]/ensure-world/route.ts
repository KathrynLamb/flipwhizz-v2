import { NextResponse } from "next/server";
import { db } from "@/db";
import {
  stories,
  storyPages,
  storyWorkflowProgress,
} from "@/db/schema";
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
     1. Validate story + pages
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
    return NextResponse.json(
      { error: "Story has no pages" },
      { status: 400 }
    );
  }

  /* --------------------------------------------------
     2. Load workflow progress (canonical state)
  -------------------------------------------------- */

  let progress = await db.query.storyWorkflowProgress.findFirst({
    where: eq(storyWorkflowProgress.storyId, storyId),
  });

  /* --------------------------------------------------
     3. Bootstrap if missing
  -------------------------------------------------- */

  if (!progress) {
    await db.insert(storyWorkflowProgress).values({
      storyId,
      worldExtracted: false,
      spreadsBuilt: false,
      scenesDecided: false,
      extractingWorld: true,
      buildingSpreads: false,
      decidingScenes: false,
      worldExtractedAt: null,
      spreadsBuiltAt: null,
      scenesDecidedAt: null,
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
     4. COMPLETE
  -------------------------------------------------- */

  if (
    progress.worldExtracted &&
    progress.spreadsBuilt &&
    progress.scenesDecided
  ) {
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

  /* --------------------------------------------------
     5. DECIDING SCENES
  -------------------------------------------------- */

  if (progress.worldExtracted && progress.spreadsBuilt) {
    if (!progress.decidingScenes) {
      await db
        .update(storyWorkflowProgress)
        .set({ decidingScenes: true })
        .where(eq(storyWorkflowProgress.storyId, storyId));

      await inngest.send({
        name: "story/decide-spread-scenes",
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

  /* --------------------------------------------------
     6. BUILDING SPREADS
  -------------------------------------------------- */

  if (progress.worldExtracted && !progress.spreadsBuilt) {
    if (!progress.buildingSpreads) {
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

  /* --------------------------------------------------
     7. EXTRACTING WORLD
  -------------------------------------------------- */

  if (!progress.worldExtracted) {
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

  return NextResponse.json({ error: "Invalid workflow state" }, { status: 500 });
}
