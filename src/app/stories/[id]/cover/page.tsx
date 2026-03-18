import { db } from "@/db";
import { coverConversations, stories, bookCovers } from "@/db/schema";
import { eq, asc, and } from "drizzle-orm";
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

  const selectedCover = await db.query.bookCovers.findFirst({
    where: and(
      eq(bookCovers.storyId, storyId),
      eq(bookCovers.isSelected, true)
    ),
    columns: {
      charactersShown: true,
      locationsShown: true,
    },
  });

  const completedSteps = (story.completedSteps as StepKey[]) ?? [];

  return (
    <CoverDesignChat
      storyId={story.id}
      projectId={story.projectId}
      story={story}
      initialMessages={messages}
      currentStep="cover"
      completedSteps={completedSteps}
      paymentStatus={story.paymentStatus}
      coverSpreadUrl={story.coverSpreadUrl}
      initialCharacterIds={selectedCover?.charactersShown ?? []}
      initialLocationIds={selectedCover?.locationsShown ?? []}
    />
  );
}