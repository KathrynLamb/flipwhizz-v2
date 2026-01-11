import { NextResponse } from "next/server";
import { db } from "@/db";
import {
  stories,
  storyPages,
  storyCharacters,
  storyLocations,
  storyPageCharacters,
  storyStyleGuide,
} from "@/db/schema";
import { eq, inArray, asc } from "drizzle-orm";
import { inngest } from "@/inngest/client";

/**
 * ensure-world
 *
 * POST  → idempotent dispatcher
 * DELETE → hard reset world state (characters, locations, presence, style)
 */

/* ============================================================
   POST — ENSURE / DISPATCH
============================================================ */

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: storyId } = await params;

  console.log("🔵 ensure-world called for story:", storyId);

  const story = await db.query.stories.findFirst({
    where: eq(stories.id, storyId),
  });

  if (!story) {
    return NextResponse.json({ error: "Story not found" }, { status: 404 });
  }

  if (story.status !== "extracting") {
    return NextResponse.json({
      status: "skipped",
      message: "World extraction not required",
      storyStatus: story.status,
    });
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

  const [characters, locations, presence, styleGuide] = await Promise.all([
    db.query.storyCharacters.findMany({
      where: eq(storyCharacters.storyId, storyId),
    }),
    db.query.storyLocations.findMany({
      where: eq(storyLocations.storyId, storyId),
    }),
    db.query.storyPageCharacters.findMany({
      where: inArray(
        storyPageCharacters.pageId,
        pages.map((p) => p.id)
      ),
    }),
    db.query.storyStyleGuide.findFirst({
      where: eq(storyStyleGuide.storyId, storyId),
    }),
  ]);

  let dispatched = false;

  if (!characters.length || !locations.length || !presence.length) {
    await inngest.send({
      name: "story/extract-world",
      data: { storyId },
    });
    dispatched = true;
  }

  if (!styleGuide?.summary) {
    await inngest.send({
      name: "story/generate.style.text",
      data: { storyId },
    });
    dispatched = true;
  }

  return NextResponse.json({
    status: dispatched ? "processing" : "complete",
  });
}

/* ============================================================
   DELETE — HARD RESET WORLD
============================================================ */

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: storyId } = await params;

  console.log("🧨 RESETTING world for story:", storyId);

  const pages = await db.query.storyPages.findMany({
    where: eq(storyPages.storyId, storyId),
    columns: { id: true },
  });

  await db.transaction(async (tx) => {
    // Presence (page-level)
    if (pages.length) {
      await tx.delete(storyPageCharacters).where(
        inArray(
          storyPageCharacters.pageId,
          pages.map((p) => p.id)
        )
      );
    }

    // Globals
    await tx.delete(storyCharacters).where(eq(storyCharacters.storyId, storyId));
    await tx.delete(storyLocations).where(eq(storyLocations.storyId, storyId));
    await tx.delete(storyStyleGuide).where(eq(storyStyleGuide.storyId, storyId));

    // Reset story flags
    await tx
      .update(stories)
      .set({
        status: "draft",
        storyConfirmed: false,
        updatedAt: new Date(),
      })
      .where(eq(stories.id, storyId));
  });

  return NextResponse.json({
    status: "reset",
    message: "World data deleted successfully",
  });
}
