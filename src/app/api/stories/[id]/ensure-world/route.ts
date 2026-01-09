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
    columns: { id: true, pageNumber: true },
  });

  if (pages.length === 0) {
    return NextResponse.json({ error: "Story has no pages" }, { status: 400 });
  }

  // If already running, don’t trigger again.
  // if (story.status === "extracting_running") {
  //   return NextResponse.json({
  //     status: "processing",
  //     message: "Extraction already running",
  //   });
  // }

  const pageIds = pages.map((p) => p.id);

  const [charJoins, locJoins, presence, styleGuide] = await Promise.all([
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

  const hasCharacters = charJoins.length > 0;
  const hasLocations = locJoins.length > 0;
  const hasPresence = presence.length > 0;
  const hasStyleText = !!styleGuide?.summary;

  const missingWorld = !hasCharacters || !hasLocations || !hasPresence;

  console.log("📊 ensure-world state:", {
    status: story.status,
    hasCharacters,
    hasLocations,
    hasPresence,
    hasStyleText,
  });

  if (missingWorld || !hasStyleText) {
    // IMPORTANT: set status to extracting so the Inngest job can CLAIM
    await db
      .update(stories)
      .set({ status: "extracting", updatedAt: new Date() })
      .where(eq(stories.id, storyId));

    if (missingWorld) {
      console.log("🚀 Dispatching story/extract-world");
      await inngest.send({ name: "story/extract-world", data: { storyId } });
    }

    if (!hasStyleText) {
      console.log("🚀 Dispatching story/generate.style.text");
      await inngest.send({ name: "story/generate.style.text", data: { storyId } });
    }

    return NextResponse.json({
      status: "processing",
      message: "Jobs dispatched",
      hasCharacters,
      hasLocations,
      hasPresence,
      hasStyleText,
    });
  }

  return NextResponse.json({
    status: "complete",
    message: "World already complete",
    hasCharacters,
    hasLocations,
    hasPresence,
    hasStyleText,
  });
}
