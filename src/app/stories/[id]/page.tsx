// src/app/stories/[id]/page.tsx
// import { getUserFromSession } from "@/lib/auth";
import { getUserFromSession } from "@/lib/auth";

import { db } from "@/db";
import { stories, storyPages, projects } from "@/db/schema";
import { eq, asc, and } from "drizzle-orm";
import { redirect } from "next/navigation";
import StoryViewer from "@/components/StoryViewer";

export default async function StoryViewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: storyId } = await params;

  const user = await getUserFromSession();
  if (!user) redirect("/sign-in");
  const userId = user.id;

  // ✅ Fetch story and ensure it belongs to user's project
  const story = await db
    .select()
    .from(stories)
    .innerJoin(projects, eq(stories.projectId, projects.id))
    .where(
      and(
        eq(stories.id, storyId),
        eq(projects.userId, userId)
      )
    )
    .then(rows => rows[0]?.stories);

  if (!story) {
    redirect("/dashboard");
  }

  const pages = await db.query.storyPages.findMany({
    where: eq(storyPages.storyId, storyId),
    orderBy: asc(storyPages.pageNumber),
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50">
    <StoryViewer
      story={{
        id: story.id,
        title: story.title,
        status: story.status ?? "planning",
        pdfUrl: story.pdfUrl ?? null,
        frontCoverUrl: story.frontCoverUrl ?? null,
        backCoverUrl: story.backCoverUrl ?? null,
        paymentStatus: story.paymentStatus ?? null,
      }}
      pages={pages}
      userId={userId}
    />
    </div>
  );
}
