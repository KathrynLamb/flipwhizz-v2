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

  console.log("🔵 ensure-world called:", storyId);

  const story = await db.query.stories.findFirst({
    where: eq(stories.id, storyId),
    columns: { id: true, status: true },
  });

  if (!story) {
    return NextResponse.json({ error: "Story not found" }, { status: 404 });
  }

  // Pages must exist
  const pages = await db.query.storyPages.findMany({
    where: eq(storyPages.storyId, storyId),
    orderBy: asc(storyPages.pageNumber),
    columns: { id: true },
  });

  if (pages.length === 0) {
    return NextResponse.json({ error: "Story has no pages" }, { status: 400 });
  }

  // World inputs
  const [charLinks, locLinks, style, spreadCountRow] = await Promise.all([
    db.query.storyCharacters.findMany({
      where: eq(storyCharacters.storyId, storyId),
      columns: { storyId: true },
    }),
    db.query.storyLocations.findMany({
      where: eq(storyLocations.storyId, storyId),
      columns: { storyId: true },
    }),
    db.query.storyStyleGuide.findFirst({
      where: eq(storyStyleGuide.storyId, storyId),
      columns: { summary: true },
    }),
    db
      .select({ count: sql<number>`count(*)` })
      .from(storySpreads)
      .where(eq(storySpreads.storyId, storyId)),
  ]);

  const hasCharacters = charLinks.length > 0;
  const hasLocations = locLinks.length > 0;
  const hasStyleText = Boolean(style?.summary);
  const spreadCount = spreadCountRow?.[0]?.count ?? 0;
  const hasSpreads = spreadCount > 0;

  const needsWorld = !hasCharacters || !hasLocations;
  const needsStyle = !hasStyleText;
  const needsSpreads = !hasSpreads;

  console.log("📊 ensure-world state:", {
    status: story.status,
    hasCharacters,
    hasLocations,
    hasStyleText,
    spreadCount,
    needsWorld,
    needsStyle,
    needsSpreads,
  });

  /**
   * ✅ If everything exists, we are DONE
   * Status does not matter anymore
   */
  if (!needsWorld && !needsStyle && !needsSpreads) {
    // Opportunistically heal bad status
    if (story.status !== "spreads_ready") {
      await db
        .update(stories)
        .set({ status: "spreads_ready", updatedAt: new Date() })
        .where(eq(stories.id, storyId));
    }

    return NextResponse.json({
      status: "complete",
      mode: "fetching",
      hasCharacters,
      hasLocations,
      hasStyleText,
      hasPresence: true,
      hasSpreads: true,
    });
  }

  /**
   * Prevent duplicate extraction
   */
  if (story.status === "extracting" || story.status === "building_spreads") {
    return NextResponse.json({
      status: "processing",
      mode: story.status,
      hasCharacters,
      hasLocations,
      hasStyleText,
      hasPresence: true,
      hasSpreads,
      needsWorld,
      needsStyle,
      needsSpreads,
    });
  }

  /**
   * Claim extraction/build
   */
  await db
    .update(stories)
    .set({ status: "extracting", updatedAt: new Date() })
    .where(eq(stories.id, storyId));

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

  if (needsSpreads) {
    console.log("🚀 Dispatching story/build-spreads");
    await inngest.send({
      name: "story/build-spreads",
      data: { storyId },
    });
  }

  return NextResponse.json({
    status: "processing",
    mode: "extracting",
    hasCharacters,
    hasLocations,
    hasStyleText,
    hasPresence: true,
    hasSpreads,
    needsWorld,
    needsStyle,
    needsSpreads,
  });
}
