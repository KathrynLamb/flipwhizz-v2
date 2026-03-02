// app/stories/[id]/preview/page.tsx

import { db } from "@/db";
import { stories } from "@/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import PreviewPageClient from "./PreviewPageClient";
import type { StepKey } from "@/lib/storySteps";

export default async function PreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: storyId } = await params;

  const rows = await db
    .select({
      id: stories.id,
      title: stories.title,
      storyConfirmed: stories.storyConfirmed,
      completedSteps: stories.completedSteps,
    })
    .from(stories)
    .where(eq(stories.id, storyId))
    .limit(1);

  const story = rows[0];
  if (!story) notFound();

  const completedSteps = (story.completedSteps ?? []) as StepKey[];

  return (
    <PreviewPageClient
      storyId={storyId}
      storyTitle={story.title ?? "Your Story"}
      storyConfirmed={story.storyConfirmed ?? false}
      currentStep="preview"
      completedSteps={completedSteps}
    />
  );
}