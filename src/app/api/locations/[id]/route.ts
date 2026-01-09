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
 * This route is a SAFE, IDEMPOTENT trigger.
 * It will only dispatch extraction when the story
 * is explicitly in `extracting` state.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: storyId } = await params;

  console.log("🔵 ensure-world called for story:", storyId);

  /* --------------------------------------------------
     1️⃣ Load story
  -------------------------------------------------- */

  const story = await db.query.stories.findFirst({
    where: eq(stories.id, storyId),
  });

  if (!story) {
    return NextResponse.json({ error: "Story not found" }, { status: 404 });
  }

  /**
   * CRITICAL GATE
   * We only dispatch extraction when the story
   * is explicitly marked as `extracting`.
   *
   * Any other state means:
   * - job already running
   * - job already finished
   * - user moved on
   */
  if (story.status !== "extracting") {
    console.log("⏭️ Extraction not requested. Current status:", story.status);
    return NextResponse.json({
      status: "skipped",
      message: "World extraction not required",
      storyStatus: story.status,
    });
  }

  /* --------------------------------------------------
     2️⃣ Load pages (hard requirement)
  -------------------------------------------------- */

  const pages = await db.query.storyPages.findMany({
    where: eq(storyPages.storyId, storyId),
    orderBy: asc(storyPages.pageNumber),
    columns: { id: true, pageNumber: true },
  });

  if (pages.length === 0) {
    return NextResponse.json(
      { error: "Story has no pages" },
      { status: 400 }
    );
  }

  /* --------------------------------------------------
     3️⃣ Inspect existing world state
  -------------------------------------------------- */

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

  const hasCharacters = characters.length > 0;
  const hasLocations = locations.length > 0;
  const hasPresence = presence.length > 0;
  const hasStyleText = Boolean(styleGuide?.summary);

  console.log("📊 ensure-world state check:", {
    hasCharacters,
    hasLocations,
    hasPresence,
    hasStyleText,
  });

  /* --------------------------------------------------
     4️⃣ Dispatch missing jobs
  -------------------------------------------------- */

  let dispatched = false;

  if (!hasCharacters || !hasLocations || !hasPresence) {
    console.log("🚀 Dispatching story/extract-world");
    await inngest.send({
      name: "story/extract-world",
      data: { storyId },
    });
    dispatched = true;
  }

  if (!hasStyleText) {
    console.log("🚀 Dispatching story/generate.style.text");
    await inngest.send({
      name: "story/generate.style.text",
      data: { storyId },
    });
    dispatched = true;
  }

  /* --------------------------------------------------
     5️⃣ Return immediately (never wait)
  -------------------------------------------------- */

  if (dispatched) {
    return NextResponse.json({
      status: "processing",
      message: "World jobs dispatched",
    });
  }

  return NextResponse.json({
    status: "complete",
    message: "World already exists",
  });
}
