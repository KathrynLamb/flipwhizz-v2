import { redirect } from "next/navigation";
import { getUserFromSession } from "@/lib/auth";
import { db } from "@/db";
import { stories, storyPages, projects } from "@/db/schema";
import { eq, asc } from "drizzle-orm";

import StoryReaderClient from "./StoryReaderClient";

export default async function StoryPagesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // ✅ MUST await params in Next 15
  const { id: storyId } = await params;

  if (!storyId) {
    redirect("/projects");
  }

  const user = await getUserFromSession();
  if (!user) redirect("/sign-in");

  // Fetch story
  const story = await db.query.stories.findFirst({
    where: eq(stories.id, storyId),
  });

  if (!story) redirect("/projects");

  // Ownership check
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, story.projectId),
  });

  if (!project || project.userId !== user.id) {
    redirect("/projects");
  }

  const pages = await db.query.storyPages.findMany({
    where: eq(storyPages.storyId, storyId),
    orderBy: asc(storyPages.pageNumber),
  });

  return (
    <StoryReaderClient
      title={story.title}
      pages={pages.map(p => ({
        id: p.id,
        pageNumber: p.pageNumber,
        text: p.text,
      }))}
    />
  );
}
