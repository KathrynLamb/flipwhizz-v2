import { db } from "@/db";
import { coverChatSessions, coverChatMessages, stories } from "@/db/schema";
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

  // Load existing session + messages
  const session = await db.query.coverChatSessions.findFirst({
    where: eq(coverChatSessions.storyId, storyId),
    orderBy: (s, { desc }) => [desc(s.createdAt)],
  });

  let messages: { role: "user" | "assistant"; content: string }[] = [];

  if (session) {
    const dbMessages = await db
      .select({ role: coverChatMessages.role, content: coverChatMessages.content })
      .from(coverChatMessages)
      .where(eq(coverChatMessages.sessionId, session.id))
      .orderBy(asc(coverChatMessages.createdAt));

    messages = dbMessages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));
  }

  // Extract character/location IDs from cover plan if available
  const plan = session?.coverPlan as any;
  const initialCharacterIds = plan?.charactersShown ?? [];
  const initialLocationIds = plan?.locationsShown ?? [];

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
      initialCharacterIds={initialCharacterIds}
      initialLocationIds={initialLocationIds}
    />
  );
}