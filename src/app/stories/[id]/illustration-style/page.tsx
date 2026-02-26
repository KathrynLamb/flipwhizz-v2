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

  /* ------------------ STORY ------------------ */

  const story = await db.query.stories.findFirst({
    where: eq(stories.id, storyId),
  });

  if (!story) notFound();

  /* ------------------ STYLE GUIDE ------------------ */

  const sg = await db.query.storyStyleGuide.findFirst({
    where: eq(storyStyleGuide.storyId, storyId),
  });

  let styleGuide: StyleGuide | null = null;

  if (sg) {
    styleGuide = {
      id: sg.id,
      storyId: sg.storyId,
      summary: sg.summary ?? null,
      artStyle: sg.artStyle ?? null,

      // 🔁 map DB → client naming
      referenceImageUrl: sg.sampleIllustrationUrl ?? null,

      // optional fields (only if exist in schema)
      promptBase: (sg as any).promptBase ?? null,
      negativePrompt: sg.negativePrompt ?? null,
      locked: (sg as any).locked ?? false,

      updatedAt: sg.updatedAt ?? null,
    };
  }

  return (
    <IllustrationStyleClient
      storyId={storyId}
      storyTitle="Illustration Style"
      storyConfirmed={story.confirmed ?? false}
      styleGuide={styleGuide}
      currentStep="studio"
      completedSteps={[]}
    />
  );
}
