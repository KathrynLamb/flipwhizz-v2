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
  if (!user) redirect("/auth/signin");

  try {
    // ✅ Fetch story and verify ownership
    const result = await db
      .select()
      .from(stories)
      .innerJoin(projects, eq(stories.projectId, projects.id))
      .where(
        and(
          eq(stories.id, storyId),
          eq(projects.userId, user.id)
        )
      );

    // console.log("📊 Story query result:", JSON.stringify(result, null, 2));

    if (!result || result.length === 0) {
      console.log("❌ Story not found or user doesn't own it");
      redirect("/projects");
    }

    const story = result[0].stories;
    const project = result[0].projects;

    console.log("✅ Found story:", {
      id: story.id,
      title: story.title,
      status: story.status,
      currentStep: story.currentStep,
      completedSteps: story.completedSteps,
    });

    return (
      <StoryJourneyShell
        storyId={story.id}
        title={story.title || "Untitled Story"}
        currentStep={stepNumberToKey(story.currentStep ?? undefined)}
        completedSteps={stepNumbersToKeys(
          Array.isArray(story.completedSteps)
            ? story.completedSteps
            : []
        )}
      >
        {children}
      </StoryJourneyShell>
    );
  } catch (error) {
    console.error("❌ Error fetching story:", error);
    console.error("Error details:", {
      storyId,
      userId: user.id,
      error: error instanceof Error ? error.message : String(error),
    });
    redirect("/projects");
  }
}