// src/app/stories/[id]/design/page.tsx
import DesignClient from "@/app/stories/[id]/design/StyleStudio";
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


export default async function DesignPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: storyId } = await params;

  const progress = await db.query.storyWorkflowProgress.findFirst({
    where: eq(storyWorkflowProgress.storyId, storyId),
  });

  if (!progress || !progress.worldExtracted || !progress.spreadsBuilt || !progress.scenesDecided) {
    redirect(`/stories/${storyId}/extract`);
  }

  const story = await db.query.stories.findFirst({
    where: eq(stories.id, storyId),
  });

  if (!story) return notFound();

  const pages = await db.query.storyPages.findMany({
    where: eq(storyPages.storyId, storyId),
    orderBy: asc(storyPages.pageNumber),
  });

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

  const style = await db.query.storyStyleGuide.findFirst({
    where: eq(storyStyleGuide.storyId, storyId),
  });

  console.log("📊 Style guide loaded:", {
    exists: !!style,
    styleGuideImage: style?.styleGuideImage,
    sampleIllustrationUrl: style?.sampleIllustrationUrl,
  });

  return (
    <DesignClient
      data={{
        storyId: story.id,
        title: story.title || "Untitled Story",
        pages: pages.map((p) => p.text || ""),
        style: {
          summary: style?.summary || "",
          negativePrompt: style?.negativePrompt || "",
          referenceImages: style?.styleGuideImage ? [style.styleGuideImage] : [], // ✅ Fixed
          sampleIllustrationUrl: style?.sampleIllustrationUrl || null, // ✅ Fixed
        },
        characters: chars.map((c) => ({
          id: c.id,
          name: c.name,
          description: c.description,
          appearance: c.appearance,
          referenceImageUrl: c.referenceImageUrl,
          portraitImageUrl: c.portraitImageUrl, // ✅ Added
        })),
        locations: locs.map((l) => ({
          id: l.id,
          name: l.name,
          description: l.description,
          referenceImageUrl: l.referenceImageUrl,
          portraitImageUrl: l.portraitImageUrl, // ✅ Added
        })),
      }}
    />
  );
}