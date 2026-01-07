// src/app/stories/[id]/layout.tsx
// ❌ DO NOT add "use client"

import { ReactNode } from "react";
import { redirect } from "next/navigation";

import { getUserFromSession } from "@/lib/auth";
import { db } from "@/db";
import { stories, projects } from "@/db/schema";
import { eq, and } from "drizzle-orm";

import StoryJourneyShell from "./StoryShell";
import { stepNumbersToKeys, stepNumberToKey } from "@/lib/storySteps";

/* ------------------------------------------------------------------ */
/* TYPES                                                               */
/* ------------------------------------------------------------------ */

type LayoutProps = {
  children: ReactNode;
  params: Promise<{ id: string }>;
};

/* ------------------------------------------------------------------ */
/* LAYOUT                                                              */
/* ------------------------------------------------------------------ */

export default async function StoryLayout({ children, params }: LayoutProps) {
  // ✅ IMPORTANT: params is a Promise in Next 14+
  const { id: storyId } = await params;

  const user = await getUserFromSession();
  if (!user) redirect("/sign-in");

  // ✅ Fetch story and verify ownership
  const story = await db
    .select({
      id: stories.id,
      title: stories.title,
      status: stories.status,
      currentStep: stories.currentStep,
      completedSteps: stories.completedSteps,
    })
    .from(stories)
    .innerJoin(projects, eq(stories.projectId, projects.id))
    .where(
      and(
        eq(stories.id, storyId),
        eq(projects.userId, user.id)
      )
    )
    .then(rows => rows[0]);

  if (!story) {
    redirect("/projects");
  }

  return (
    <StoryJourneyShell
      storyId={story.id}
      title={story.title}
      status={story.status ?? "planning"}
      currentStep={stepNumberToKey(story.currentStep ?? undefined)}
      completedSteps={stepNumbersToKeys(
        Array.isArray(story.completedSteps)
          ? (story.completedSteps as number[])
          : []
      )}
      
    >
      {children}
    </StoryJourneyShell>
  );
}
