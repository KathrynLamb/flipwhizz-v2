// src/app/stories/[id]/design/page.tsx
import { db } from "@/db";
import {
  stories,
  storyPages,
  storyCharacters,
  storyLocations,
  characters,
  locations,
  storyStyleGuide,
  storyWorkflowProgress,
} from "@/db/schema";
import { eq, inArray, asc } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import StyleStudio from "./StyleStudio";

export default async function DesignPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: storyId } = await params;

  /* --------------------------------------------------
     1. Check if workflow is complete
  -------------------------------------------------- */
  const progress = await db.query.storyWorkflowProgress.findFirst({
    where: eq(storyWorkflowProgress.storyId, storyId),
  });

  // If workflow not complete, redirect to extract page
  if (!progress || !progress.worldExtracted || !progress.spreadsBuilt || !progress.scenesDecided) {
    redirect(`/stories/${storyId}/extract`);
  }

  /* --------------------------------------------------
     2. Load story
  -------------------------------------------------- */
  const story = await db.query.stories.findFirst({
    where: eq(stories.id, storyId),
  });

  if (!story) return notFound();

  /* --------------------------------------------------
     3. Load pages
  -------------------------------------------------- */
  const pages = await db.query.storyPages.findMany({
    where: eq(storyPages.storyId, storyId),
    orderBy: asc(storyPages.pageNumber),
  });

  /* --------------------------------------------------
     4. Load characters
  -------------------------------------------------- */
  const storyChars = await db.query.storyCharacters.findMany({
    where: eq(storyCharacters.storyId, storyId),
  });

  const chars =
    storyChars.length > 0
      ? await db.query.characters.findMany({
          where: inArray(
            characters.id,
            storyChars.map((sc) => sc.characterId)
          ),
        })
      : [];

  /* --------------------------------------------------
     5. Load locations
  -------------------------------------------------- */
  const storyLocs = await db.query.storyLocations.findMany({
    where: eq(storyLocations.storyId, storyId),
  });

  const locs =
    storyLocs.length > 0
      ? await db.query.locations.findMany({
          where: inArray(
            locations.id,
            storyLocs.map((sl) => sl.locationId)
          ),
        })
      : [];

  /* --------------------------------------------------
     6. Load style guide
  -------------------------------------------------- */
  const style = await db.query.storyStyleGuide.findFirst({
    where: eq(storyStyleGuide.storyId, storyId),
  });

  /* --------------------------------------------------
     7. Render StyleStudio
  -------------------------------------------------- */
  return (
    <StyleStudio
      data={{
        storyId: story.id,
        title: story.title || "Untitled Story",
        pages: pages.map((p) => p.text || ""),
        style: {
          summary: style?.summary || "",
          negativePrompt: style?.negativePrompt || "",
          referenceImages: [],
          sampleUrl: style?.sampleIllustrationUrl || null,
        },
        characters: chars.map((c) => ({
          id: c.id,
          name: c.name,
          description: c.description,
          appearance: c.appearance,
          referenceImageUrl: c.referenceImageUrl,
        })),
        locations: locs.map((l) => ({
          id: l.id,
          name: l.name,
          description: l.description,
          referenceImageUrl: l.referenceImageUrl,
        })),
        presenceReady: true,
      }}
    />
  );
}