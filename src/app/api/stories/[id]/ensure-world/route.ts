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

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: storyId } = await params;

  console.log("🔵 ensure-world called:", storyId);

  /* -------------------------------------------------
     1. Load story (authoritative state)
  -------------------------------------------------- */

  const story = await db.query.stories.findFirst({
    where: eq(stories.id, storyId),
    columns: { id: true, status: true },
  });

  if (!story) {
    return NextResponse.json({ error: "Story not found" }, { status: 404 });
  }

  /* -------------------------------------------------
     2. Pages must exist
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

  const pageIds = pages.map((p) => p.id);

  /* -------------------------------------------------
     3. Check existing world (NO side effects)
  -------------------------------------------------- */

  const [
    characterLinks,
    locationLinks,
    pagePresence,
    styleGuide,
  ] = await Promise.all([
    db.query.storyCharacters.findMany({
      where: eq(storyCharacters.storyId, storyId),
      columns: { storyId: true },
    }),

    db.query.storyLocations.findMany({
      where: eq(storyLocations.storyId, storyId),
      columns: { storyId: true },
    }),

    pageIds.length
      ? db.query.storyPageCharacters.findMany({
          where: inArray(storyPageCharacters.pageId, pageIds),
          columns: { id: true },
        })
      : Promise.resolve([]),

    db.query.storyStyleGuide.findFirst({
      where: eq(storyStyleGuide.storyId, storyId),
      columns: { summary: true },
    }),
  ]);

  const hasCharacters = characterLinks.length > 0;
  const hasLocations = locationLinks.length > 0;
  const hasPresence = pagePresence.length > 0;
  const hasStyleText = Boolean(styleGuide?.summary);

  console.log("📊 ensure-world state:", {
    status: story.status,
    hasCharacters,
    hasLocations,
    hasPresence,
    hasStyleText,
  });

  /* -------------------------------------------------
     4. Decide what is missing
  -------------------------------------------------- */

  const needsWorld =
    !hasCharacters || !hasLocations || !hasPresence;

  const needsStyle = !hasStyleText;

  const needsExtraction = needsWorld || needsStyle;

  /* -------------------------------------------------
     5. Nothing missing → fetch only
  -------------------------------------------------- */

  if (!needsExtraction) {
    return NextResponse.json({
      status: "complete",
      mode: "fetching",
      message: "World already complete",
      hasCharacters,
      hasLocations,
      hasPresence,
      hasStyleText,
    });
  }

  /* -------------------------------------------------
     6. Claim extraction (single-writer rule)
  -------------------------------------------------- */

  if (story.status !== "extracting") {
    await db
      .update(stories)
      .set({ status: "extracting", updatedAt: new Date() })
      .where(eq(stories.id, storyId));
  }

  /* -------------------------------------------------
     7. Dispatch ONLY what is missing
  -------------------------------------------------- */

  if (needsWorld) {
    console.log("🚀 Dispatching story/extract-world");
    await inngest.send({
      name: "story/extract-world",
      data: { storyId },
    });
  }

  if (needsStyle) {
    console.log("🚀 Dispatching story/generate.style.text");
    await inngest.send({
      name: "story/generate.style.text",
      data: { storyId },
    });
  }

  /* -------------------------------------------------
     8. Explicit extracting response
  -------------------------------------------------- */

  return NextResponse.json({
    status: "processing",
    mode: "extracting",
    hasCharacters,
    hasLocations,
    hasPresence,
    hasStyleText,
    needsWorld,
    needsStyle,
  });
}
