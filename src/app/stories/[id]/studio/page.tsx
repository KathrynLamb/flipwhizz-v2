import { db } from "@/db";
import { stories, storyPages, storyStyleGuide } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import StudioEditor from "./StudioEditor";

export default async function StudioPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ mode?: string }>;
}) {
  const { id } = await params;
  const { mode } = await searchParams; // 'live' or 'edit'

  // 1. Fetch Story & Style
  const story = await db.query.stories.findFirst({
    where: eq(stories.id, id),
  });

  if (!story) return notFound();

  // 2. Fetch Pages
  const pages = await db.query.storyPages.findMany({
    where: eq(storyPages.storyId, id),
    orderBy: asc(storyPages.pageNumber),
  });

  if (pages.length === 0) {
    redirect(`/stories/${id}/view`);
  }

  // 3. Fetch Style Guide (Needed for regenerations)
  const styleGuide = await db.query.storyStyleGuide.findFirst({
    where: eq(storyStyleGuide.storyId, id),
  });

  return (
    <main className="min-h-screen bg-[#FAF9F6] text-stone-800">
      <StudioEditor 
        story={story} 
        initialPages={pages} 
        // styleGuide={styleGuide}
        initialMode={mode === 'live' ? 'live' : 'edit'}
      />
    </main>
  );
}