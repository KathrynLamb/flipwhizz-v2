// src/app/stories/[id]/hub/page.tsx
import { redirect } from "next/navigation";
import { db } from "@/db";
import { stories } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getNextStepHref } from "@/lib/storySteps";
import { requireStoryOwnerPage, requireAdminPage } from "@/lib/pageGuards";

export default async function HubPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Check access BEFORE loading data: the layout's redirect doesn't stop
  // this page rendering in parallel. See src/lib/pageGuards.ts
  await requireStoryOwnerPage(id);
  
  const story = await db.query.stories.findFirst({
    where: eq(stories.id, id),
  });

  if (!story) redirect("/projects");

  const href = getNextStepHref(id, story);
  redirect(href);
}