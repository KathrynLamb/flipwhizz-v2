// src/app/api/public/stories/[storyId]/spreads/route.ts

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { stories, storySpreads, storyPages } from "@/db/schema";
import { and, asc, eq } from "drizzle-orm";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ storyId: string }> }
) {
  const { storyId } = await params;

  // Verify the story is public
  const [story] = await db
    .select({ id: stories.id, title: stories.title })
    .from(stories)
    .where(and(eq(stories.id, storyId), eq(stories.public, true)))
    .limit(1);

  if (!story) {
    return NextResponse.json({ error: "Story not found" }, { status: 404 });
  }

  // Fetch spreads ordered by spreadIndex
  const rawSpreads = await db
    .select({
      spreadId: storySpreads.id,
      spreadIndex: storySpreads.spreadIndex,
      sceneSummary: storySpreads.sceneSummary,
      leftPageId: storySpreads.leftPageId,
      rightPageId: storySpreads.rightPageId,
    })
    .from(storySpreads)
    .where(eq(storySpreads.storyId, storyId))
    .orderBy(asc(storySpreads.spreadIndex));

  // Deduplicate by spreadIndex (data has duplicate rows)
  const seen = new Set<number>();
  const spreads = rawSpreads.filter((s) => {
    if (seen.has(s.spreadIndex)) return false;
    seen.add(s.spreadIndex);
    return true;
  });

  // Fetch all pages for this story
  const pages = await db
    .select({
      id: storyPages.id,
      imageUrl: storyPages.imageUrl,
      text: storyPages.text,
      pageNumber: storyPages.pageNumber,
    })
    .from(storyPages)
    .where(eq(storyPages.storyId, storyId));

  const pageMap = new Map(pages.map((p) => [p.id, p]));

  // One viewer slide per spread — use left page image (full spread illustration)
  // Fall back to right page if left has no image
  const result: { id: string; imageUrl: string; text: string | null }[] = [];

  for (const spread of spreads) {
    const leftPage = spread.leftPageId
      ? pageMap.get(spread.leftPageId)
      : null;
    const rightPage = spread.rightPageId
      ? pageMap.get(spread.rightPageId)
      : null;

    // Pick the best image: left page first, then right page
    const page = leftPage?.imageUrl ? leftPage : rightPage?.imageUrl ? rightPage : null;

    if (page?.imageUrl) {
      // Combine text from both pages for the narrative
      const leftText = leftPage?.text ?? null;
      const rightText = rightPage?.text ?? null;
      const combinedText =
        leftText && rightText
          ? `${leftText}\n\n${rightText}`
          : leftText ?? rightText ?? spread.sceneSummary ?? null;

      result.push({
        id: spread.spreadId,
        imageUrl: page.imageUrl,
        text: combinedText,
      });
    }
  }

  return NextResponse.json({
    storyId: story.id,
    title: story.title,
    pages: result,
  });
}