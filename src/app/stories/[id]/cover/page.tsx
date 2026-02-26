// src/app/stories/[id]/cover/page.tsx
import { db } from "@/db";
import { coverConversations, stories, storyWorkflowProgress } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { notFound } from "next/navigation";
import CoverDesignChat from "./CoverDesignChat";
import type { StepKey } from "@/lib/storySteps";

export default async function CoverPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: storyId } = await params;

  const story = await db.query.stories.findFirst({
    where: eq(stories.id, storyId),
  });

  if (!story) return notFound();

  // Load existing conversation messages
  const existingMessages = await db.query.coverConversations.findMany({
    where: eq(coverConversations.storyId, storyId),
    orderBy: asc(coverConversations.createdAt),
  });

  const messages = existingMessages.map((msg) => ({
    role: msg.role as "user" | "assistant",
    content: msg.content,
  }));

  // Build completed steps from workflow progress
  const progress = await db.query.storyWorkflowProgress.findFirst({
    where: eq(storyWorkflowProgress.storyId, storyId),
  });

  const completedSteps: StepKey[] = [];
  if (story.status !== "draft") completedSteps.push("write");
  if (progress?.styleExtracted) completedSteps.push("design");
  if (progress?.charactersExtracted) completedSteps.push("characters");
  if (progress?.locationsExtracted) completedSteps.push("locations");
  if (progress?.worldComplete) completedSteps.push("studio");

  return (
    <CoverDesignChat
      storyId={story.id}
      projectId={story.projectId}
      story={story}
      initialMessages={messages}
      currentStep="studio"
      completedSteps={completedSteps}
    />
  );
}