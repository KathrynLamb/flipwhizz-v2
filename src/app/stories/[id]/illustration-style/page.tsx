// src/app/stories/[id]/illustration-style/page.tsx

import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { stories, storyStyleGuide } from "@/db/schema";

import IllustrationStyleClient from "@/app/stories/[id]/illustration-style/IllustrationStyleClient";
import { StepKey } from "@/lib/storySteps";
import { ConsoleMessage } from "puppeteer-core";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function IllustrationStylePage({ params }: Props) {
  const { id: storyId } = await params;

  const story = await db.query.stories.findFirst({
    where: eq(stories.id, storyId),
  });

  if (!story) notFound();

  // For Book 2+ in a world, the style guide is inherited.
  // Auto-lock it and skip straight to characters.
  if (story.worldId && story.bookNumber && story.bookNumber > 1) {
    const sg = await db.query.storyStyleGuide.findFirst({
      where: eq(storyStyleGuide.storyId, storyId),
    });

    if (sg && !sg.approved) {
      await db
        .update(storyStyleGuide)
        .set({ approved: true, updatedAt: new Date() })
        .where(eq(storyStyleGuide.id, sg.id));

      const completedSteps = Array.isArray(story.completedSteps)
        ? (story.completedSteps as string[])
        : [];
      if (!completedSteps.includes("design")) {
        await db
          .update(stories)
          .set({
            completedSteps: [...completedSteps, "design"],
            updatedAt: new Date(),
          })
          .where(eq(stories.id, storyId));
      }
    }

    const { redirect } = await import("next/navigation");
    redirect(`/stories/${storyId}/characters`);
  }

  /* ── Already completed? Skip forward ── */
const completedSteps = Array.isArray(story.completedSteps)
? (story.completedSteps as string[])
: [];

if (completedSteps.includes("design")) {
const { getNextStepHref } = await import("@/lib/storySteps");
const { redirect } = await import("next/navigation");
redirect(getNextStepHref(storyId, story));
}

  /* ── Style guide ── */
  const sg = await db.query.storyStyleGuide.findFirst({
    where: eq(storyStyleGuide.storyId, storyId),
  });

  // Map DB fields to the shape the new client component expects:
  //   DB: summary, userNotes, artStyle, visualThemes, colorPalette, negativePrompt, typography, sampleIllustrationUrl
  //   Client: userNotes, artStyle, colorPalette, negativePrompt, typography, sampleIllustrationUrl
  //
  // The DB has both `summary` (user-facing description) and `userNotes` (internal prompt base).
  // The new client uses `userNotes` as the primary style description shown to the user.
  // We prefer `summary` if it exists (it's the richer, user-facing text), falling back to `userNotes`.
  const initialStyleGuide = sg
    ? {
        id: sg.id,
        userNotes: sg.summary ?? sg.userNotes ?? null,
        artStyle: sg.artStyle ?? null,
        colorPalette: (sg.colorPalette as any) ?? null,
        negativePrompt: sg.negativePrompt ?? null,
        typography: (sg as any).typography ?? null,
        sampleIllustrationUrl: sg.sampleIllustrationUrl ?? null,
      }
    : null;


  return (
    <IllustrationStyleClient
      storyId={storyId}
      title={story.title ?? "Illustration Style"}
      currentStep="design"
      completedSteps={(story.completedSteps as StepKey[]) ?? []}
      initialStyleGuide={initialStyleGuide}
      storyConfirmed={story.storyConfirmed}

    />
  );
}