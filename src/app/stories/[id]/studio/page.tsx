// app/stories/[id]/studio/page.tsx

import { db } from "@/db";
import { stories, storyPages, storyStyleGuide, storySpreads } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import StudioShell from "./StudioShell";
import { requireStoryOwnerPage, requireAdminPage } from "@/lib/pageGuards";
import { getUnfinishedSetupHref } from "@/lib/storySteps";

export default async function StudioPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ mode?: string }>;
}) {
  const { id } = await params;
  // Check access BEFORE loading data: the layout's redirect doesn't stop
  // this page rendering in parallel. See src/lib/pageGuards.ts
  const user = await requireStoryOwnerPage(id);
  const { mode } = await searchParams;

  const story = await db.query.stories.findFirst({
    where: eq(stories.id, id),
  });

  if (!story) return notFound();

  // Unpaid books must finish set-up (style, characters, places) first.
  // Admins can still open any book's studio.
  if (!user.isAdmin) {
    const setupHref = getUnfinishedSetupHref(id, story);
    if (setupHref) redirect(setupHref);
  }

  const pages = await db.query.storyPages.findMany({
    where: eq(storyPages.storyId, id),
    orderBy: asc(storyPages.pageNumber),
  });

  if (pages.length === 0) {
    redirect(`/stories/${id}/view`);
  }

  const styleGuide = await db.query.storyStyleGuide.findFirst({
    where: eq(storyStyleGuide.storyId, id),
  });

  // Fetch DB spreads so we can map page pairs to spread IDs
  const dbSpreadRows = await db
    .select({
      id: storySpreads.id,
      leftPageId: storySpreads.leftPageId,
      rightPageId: storySpreads.rightPageId,
    })
    .from(storySpreads)
    .where(eq(storySpreads.storyId, id))
    .orderBy(asc(storySpreads.spreadIndex));

  return (
    <main className="min-h-screen bg-[#FAF9F6] text-stone-800">
      <StudioShell
        story={story}
        pages={pages}
        styleGuide={styleGuide}
        mode={mode === "live" ? "live" : "edit"}
        dbSpreads={dbSpreadRows}
      />
    </main>
  );
}