// app/stories/[id]/reader/page.tsx

import { db } from "@/db";
import { stories, storySpreads, storyPages } from "@/db/schema";
import { eq, asc, inArray } from "drizzle-orm";
import { notFound } from "next/navigation";
import StoryReader from "./StoryReader";

export default async function ReaderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // 1. Fetch story
  const story = await db.query.stories.findFirst({
    where: eq(stories.id, id),
  });

  if (!story) return notFound();

  // 2. Fetch spreads in order
  const spreads = await db
    .select({
      id: storySpreads.id,
      spreadIndex: storySpreads.spreadIndex,
      sceneSummary: storySpreads.sceneSummary,
      leftPageId: storySpreads.leftPageId,
      rightPageId: storySpreads.rightPageId,
    })
    .from(storySpreads)
    .where(eq(storySpreads.storyId, id))
    .orderBy(asc(storySpreads.spreadIndex));

  // 3. Collect all page IDs
  const pageIds = spreads
    .flatMap((s) => [s.leftPageId, s.rightPageId])
    .filter(Boolean) as string[];

  // 4. Fetch all pages
  const pages =
    pageIds.length > 0
      ? await db
          .select({
            id: storyPages.id,
            pageNumber: storyPages.pageNumber,
            text: storyPages.text,
            imageUrl: storyPages.imageUrl,
          })
          .from(storyPages)
          .where(inArray(storyPages.id, pageIds))
      : [];

  const pageMap = Object.fromEntries(pages.map((p) => [p.id, p]));

  // 5. Build reader pages: cover + spreads
  const readerPages: {
    type: "cover" | "spread";
    imageUrl: string | null;
    leftText: string | null;
    rightText: string | null;
    spreadIndex: number;
  }[] = [];

  // Cover page
  if (story.coverSpreadUrl) {
    readerPages.push({
      type: "cover",
      imageUrl: story.coverSpreadUrl,
      leftText: null,
      rightText: null,
      spreadIndex: 0,
    });
  }

  // Story spreads
  for (const spread of spreads) {
    const left = spread.leftPageId ? pageMap[spread.leftPageId] : null;
    const right = spread.rightPageId ? pageMap[spread.rightPageId] : null;
    const imageUrl = left?.imageUrl || right?.imageUrl || null;

    readerPages.push({
      type: "spread",
      imageUrl,
      leftText: left?.text || null,
      rightText: right?.text || null,
      spreadIndex: spread.spreadIndex,
    });
  }

  return (
    <StoryReader
      story={{
        id: story.id,
        title: story.title,
        coverSpreadUrl: story.coverSpreadUrl,
      }}
      pages={readerPages}
    />
  );
}