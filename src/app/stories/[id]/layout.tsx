// src/app/stories/[id]/layout.tsx
// ❌ DO NOT add "use client"

import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { headers } from "next/headers";

import { getUserFromSession } from "@/lib/auth";
import { isAdminEmail } from "@/lib/authz";
import { db } from "@/db";
import { stories, projects, users } from "@/db/schema";
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
  // Admin can open any customer's book to see exactly what they see.
  const isAdmin = isAdminEmail(user.email);
  let viewingAsCustomer: string | null = null;

  try {
    // ✅ Fetch story and verify ownership
    const result = await db
      .select()
      .from(stories)
      .innerJoin(projects, eq(stories.projectId, projects.id))
      .where(
        isAdmin
          ? eq(stories.id, storyId)
          : and(eq(stories.id, storyId), eq(projects.userId, user.id))
      );

    if (!result || result.length === 0) {
      console.log("❌ Story not found or user doesn't own it");
      redirect("/projects");
    }

    story = result[0].stories;
    if (isAdmin && result[0].projects.userId !== user.id) {
      const owner = await db
        .select({ email: users.email })
        .from(users)
        .where(eq(users.id, result[0].projects.userId as string))
        .then((r) => r[0]);
      viewingAsCustomer = owner?.email ?? "a customer";
    }
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
      pathname.includes("/order") ||
      pathname.includes("/print");

    // Only redirect if we can determine the pathname AND it's not allowed
    // If pathname is empty (header not set), skip the guard to avoid loops
    if (pathname && !isAllowedRoute) {
      redirect(`/stories/${storyId}/book`);
    }
  }

  try {
    return (
      <>
      {viewingAsCustomer && (
        <div
          style={{ position: "sticky", top: 0, zIndex: 9999, background: story.paymentStatus === "paid" ? "#9F1239" : "#B45309", color: "white",
                   fontSize: 13, fontWeight: 600, padding: "8px 16px", textAlign: "center" }}
        >
          👀 Admin: viewing {viewingAsCustomer}&apos;s {story.paymentStatus === "paid" ? "PAID" : "unpaid"} book. Anything you click here changes THEIR book.{" "}
          <a href={`/admin/books/${story.id}`} style={{ color: "white", textDecoration: "underline" }}>Admin controls →</a>
        </div>
      )}
      {isAdmin && !viewingAsCustomer && (
        <div
          style={{ position: "sticky", top: 0, zIndex: 9999, background: "#065F46", color: "white",
                   fontSize: 12, fontWeight: 600, padding: "6px 16px", textAlign: "center" }}
        >
          Test copy (your account).{" "}
          <a href={`/admin/books/${story.id}`} style={{ color: "white", textDecoration: "underline" }}>Admin controls →</a>
        </div>
      )}
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
      </>
    );
  } catch (error) {
    if (error instanceof Error && error.message === "NEXT_REDIRECT") throw error;
    if ((error as any)?.digest?.startsWith("NEXT_REDIRECT")) throw error;

    console.error("❌ Error rendering story layout:", error);
    redirect("/projects");
  }
}