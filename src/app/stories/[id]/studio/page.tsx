// app/stories/[id]/studio/page.tsx

import { db } from "@/db";
import { stories, storyPages, storyStyleGuide } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import StudioShell from "./StudioShell";

export default async function StudioPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ mode?: string }>;
}) {
  const { id } = await params;
  const { mode } = await searchParams;

  const story = await db.query.stories.findFirst({
    where: eq(stories.id, id),
  });

  if (!story) return notFound();

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

  return (
    <main className="min-h-screen bg-[#FAF9F6] text-stone-800">
      <StudioShell
        story={story}
        pages={pages}
        styleGuide={styleGuide}
        mode={mode === "live" ? "live" : "edit"}
      />
    </main>
  );
}
