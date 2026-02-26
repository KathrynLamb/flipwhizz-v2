// src/app/stories/[id]/illustration-style/page.tsx

import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { stories, storyStyleGuide } from "@/db/schema";

import IllustrationStyleClient, {
  type StyleGuide,
} from "@/app/stories/[id]/illustration-style/IllustrationStyleClient";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function IllustrationStylePage({ params }: Props) {
  const { id: storyId } = await params;

  /* ── Story ── */
  const story = await db.query.stories.findFirst({
    where: eq(stories.id, storyId),
  });

  if (!story) notFound();

  /* ── Style guide ── */
  const sg = await db.query.storyStyleGuide.findFirst({
    where: eq(storyStyleGuide.storyId, storyId),
  });

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
      currentStep="studio"
      completedSteps={[]}
    />
  );
}