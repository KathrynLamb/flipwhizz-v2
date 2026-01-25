import { NextResponse } from "next/server";
import { db } from "@/db";
import {
  stories,
  storyCharacters,
  storyLocations,
  storyPages,
  storyPageCharacters,
  storyPageLocations,
  storyStyleGuide,
} from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { inngest } from "@/inngest/client";

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id: storyId } = await context.params;

  console.log("🔴 Re-extract requested for:", storyId);

  const story = await db.query.stories.findFirst({
    where: eq(stories.id, storyId),
    columns: { id: true, status: true },
  });

  if (!story) {
    return NextResponse.json({ error: "Story not found" }, { status: 404 });
  }

  // 🛑 HARD LOCK — prevents duplicate extraction jobs
  if (story.status === "extracting") {
    console.log("⏭️ Extraction already running, skipping");
    return NextResponse.json({
      ok: true,
      message: "Extraction already in progress",
    });
  }

  await db.transaction(async (tx) => {
    console.log("🧹 Clearing existing world data…");

    const pages = await tx
      .select({ id: storyPages.id })
      .from(storyPages)
      .where(eq(storyPages.storyId, storyId));

    const pageIds = pages.map((p) => p.id);

    if (pageIds.length > 0) {
      await tx
        .delete(storyPageCharacters)
        .where(inArray(storyPageCharacters.pageId, pageIds));

      await tx
        .delete(storyPageLocations)
        .where(inArray(storyPageLocations.pageId, pageIds));
    }

    await tx.delete(storyCharacters).where(eq(storyCharacters.storyId, storyId));
    await tx.delete(storyLocations).where(eq(storyLocations.storyId, storyId));
    await tx.delete(storyStyleGuide).where(eq(storyStyleGuide.storyId, storyId));

    await tx
      .update(stories)
      .set({ status: "extracting", updatedAt: new Date() })
      .where(eq(stories.id, storyId));
  });

  await inngest.send({
    name: "story/extract-world",
    data: { storyId },
  });

  await inngest.send({
    name: "story/generate.style.text",
    data: { storyId },
  });

  console.log("🚀 Fresh extraction dispatched");

  return NextResponse.json({
    ok: true,
    message: "World data cleared and extraction restarted",
  });
}

