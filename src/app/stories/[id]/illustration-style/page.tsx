// src/app/stories/[id]/illustration-style/page.tsx

import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { stories, storyStyleGuide } from "@/db/schema";

import IllustrationStyleClient, {
  type StyleGuide,
} from "@/app/stories/[id]/illustration-style/IllustrationStyleClient";
import { StepKey } from "@/lib/storySteps";

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

    // If style exists but isn't approved yet, auto-approve it
    if (sg && !sg.approved) {
      await db
        .update(storyStyleGuide)
        .set({ approved: true, updatedAt: new Date() })
        .where(eq(storyStyleGuide.id, sg.id));

      // Also mark the design step as complete
      const completedSteps = Array.isArray(story.completedSteps) 
        ? story.completedSteps as string[]
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

    // Skip to characters
    const { redirect } = await import("next/navigation");
    redirect(`/stories/${storyId}/characters`);
  }

  /* ── Style guide ── */
  const sg = await db.query.storyStyleGuide.findFirst({
    where: eq(storyStyleGuide.storyId, storyId),
  });

  console.log("completedSteps from DB:", story.completedSteps);

  const styleGuide: StyleGuide | null = sg
    ? {
        id:                   sg.id,
        storyId:              sg.storyId,
        summary:              sg.summary              ?? null,
        artStyle:             sg.artStyle             ?? null,
        visualThemes:         sg.visualThemes         ?? null,
        colorPalette:         (sg.colorPalette as any) ?? null,
        // 🔑 correct field name — was mapped to referenceImageUrl before
        sampleIllustrationUrl: sg.sampleIllustrationUrl ?? null,
        approved:             sg.approved             ?? false,
        // note: field name matches DB column
        updatedAt:            sg.updatedAt            ?? null,
        // 🔒 promptBase / negativePrompt intentionally excluded —
        //    they live in userNotes/negativePrompt on the DB row
        //    but are never passed to the client
      }
    : null;

  return (
    <IllustrationStyleClient
      storyId={storyId}
      storyTitle="Illustration Style"
      storyConfirmed={story.storyConfirmed ?? false}
      styleGuide={styleGuide}
      currentStep="design"
      completedSteps={(story.completedSteps as StepKey[]) ?? []} 
    />
  );
}