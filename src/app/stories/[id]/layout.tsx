// src/app/stories/[id]/layout.tsx
// ❌ DO NOT add "use client"

import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { headers } from "next/headers";

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

  let story: any = null;

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

    if (!result || result.length === 0) {
      console.log("❌ Story not found or user doesn't own it");
      redirect("/projects");
    }

    story = result[0].stories;
  } catch (error) {
    // Re-throw NEXT_REDIRECT so Next.js can handle it
    if (error instanceof Error && error.message === "NEXT_REDIRECT") throw error;
    if ((error as any)?.digest?.startsWith("NEXT_REDIRECT")) throw error;

    console.error("❌ Error fetching story:", error);
    redirect("/projects");
  }

  // ── Book locked guard (outside try/catch so redirect works) ──
  // If book is paid + has PDF, only /book, /review, /reader, /order are accessible.
  if (story.paymentStatus === "paid" && story.pdfUrl) {
    // Use x-pathname header set by Next.js middleware, or fall back to checking
    // if the current page is rendering /book (which means we should NOT redirect)
    const headerList = await headers();
    const pathname = headerList.get("x-pathname") || headerList.get("x-next-url") || "";

    const isAllowedRoute =
      pathname.includes("/book") ||
      pathname.includes("/review") ||
      pathname.includes("/reader") ||
      pathname.includes("/order");

    // Only redirect if we can determine the pathname AND it's not allowed
    // If pathname is empty (header not set), skip the guard to avoid loops
    if (pathname && !isAllowedRoute) {
      redirect(`/stories/${storyId}/book`);
    }
  }

  try {
    return (
      <StoryJourneyShell
        storyConfirmed={story.storyConfirmed}
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
    if (error instanceof Error && error.message === "NEXT_REDIRECT") throw error;
    if ((error as any)?.digest?.startsWith("NEXT_REDIRECT")) throw error;

    console.error("❌ Error rendering story layout:", error);
    redirect("/projects");
  }
}