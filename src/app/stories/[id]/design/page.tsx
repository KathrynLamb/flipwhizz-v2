import { notFound, redirect } from "next/navigation";
import { db } from "@/db";
import {
  stories,
  storySpreads,
  storyPages,
  storyStyleGuide,
  storyPageCharacters,
  storyPageLocations,
  characters,
  locations,
  styleGuideImages,
} from "@/db/schema";
import { eq, inArray } from "drizzle-orm";

import InitialStyleDesignEditor, {
  ClientStyleGuide,
  Entity,
} from "@/app/stories/[id]/design/components/InitialStyleDesignEditor";

export default async function DesignPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ spread?: string }>;
}) {
  /* -------------------------------------------------
     PARAMS
  -------------------------------------------------- */

  const { id: storyId } = await params;
  const { spread } = (await searchParams) ?? {};

  /* -------------------------------------------------
     STORY
  -------------------------------------------------- */

  const story = await db.query.stories.findFirst({
    where: eq(stories.id, storyId),
  });

  if (!story) return notFound();

  /* -------------------------------------------------
     SPREADS
  -------------------------------------------------- */

  const rawSpreads = await db
    .select()
    .from(storySpreads)
    .where(eq(storySpreads.storyId, storyId))
    .orderBy(storySpreads.spreadIndex);

  if (rawSpreads.length === 0) {
    redirect(`/stories/${storyId}/extract`);
  }

  const spreadIndex =
    spread && !Number.isNaN(Number(spread))
      ? Math.max(0, Math.min(rawSpreads.length - 1, Number(spread)))
      : Math.floor(rawSpreads.length / 2);

  /* -------------------------------------------------
     PAGES (ALL)
  -------------------------------------------------- */

  const allPageIds = rawSpreads.flatMap((s) =>
    [s.leftPageId, s.rightPageId].filter(Boolean)
  ) as string[];

  const pages = await db.query.storyPages.findMany({
    where: inArray(storyPages.id, allPageIds),
  });

  const pageById = Object.fromEntries(pages.map((p) => [p.id, p]));

  /* -------------------------------------------------
     PAGE → CHARACTERS
  -------------------------------------------------- */

  const pageCharacters = await db
    .select({
      pageId: storyPageCharacters.pageId,
      id: characters.id,
      name: characters.name,
      description: characters.description,
      referenceImageUrl: characters.referenceImageUrl,
    })
    .from(storyPageCharacters)
    .innerJoin(
      characters,
      eq(storyPageCharacters.characterId, characters.id)
    );

  const charactersByPage = new Map<string, Entity[]>();
  for (const row of pageCharacters) {
    const arr = charactersByPage.get(row.pageId) ?? [];
    arr.push({
      id: row.id,
      name: row.name,
      description: row.description ?? "",
      referenceImageUrl: row.referenceImageUrl ?? null,
    });
    charactersByPage.set(row.pageId, arr);
  }

  /* -------------------------------------------------
     PAGE → LOCATIONS
  -------------------------------------------------- */

  const pageLocations = await db
    .select({
      pageId: storyPageLocations.pageId,
      id: locations.id,
      name: locations.name,
      description: locations.description,
      referenceImageUrl: locations.referenceImageUrl,
    })
    .from(storyPageLocations)
    .innerJoin(
      locations,
      eq(storyPageLocations.locationId, locations.id)
    );

  const locationsByPage = new Map<string, Entity[]>();
  for (const row of pageLocations) {
    const arr = locationsByPage.get(row.pageId) ?? [];
    arr.push({
      id: row.id,
      name: row.name,
      description: row.description ?? "",
      referenceImageUrl: row.referenceImageUrl ?? null,
    });
    locationsByPage.set(row.pageId, arr);
  }

  /* -------------------------------------------------
     BUILD SpreadUI[]
  -------------------------------------------------- */

  const spreads = rawSpreads.map((s) => {
    const pageIds = [s.leftPageId, s.rightPageId].filter(Boolean) as string[];

    const characters = Array.from(
      new Map(
        pageIds
          .flatMap((id) => charactersByPage.get(id) ?? [])
          .map((c) => [c.id, c])
      ).values()
    );

    const locations = Array.from(
      new Map(
        pageIds
          .flatMap((id) => locationsByPage.get(id) ?? [])
          .map((l) => [l.id, l])
      ).values()
    );

    return {
      leftText: pageById[s.leftPageId!]?.text ?? "",
      rightText: pageById[s.rightPageId!]?.text ?? "",
      sceneSummary: s.sceneSummary ?? null,
      characters,
      locations,
    };
  });

  /* -------------------------------------------------
     STYLE GUIDE
  -------------------------------------------------- */

  const guide = await db.query.storyStyleGuide.findFirst({
    where: eq(storyStyleGuide.storyId, storyId),
  });

  const images = guide
    ? await db.query.styleGuideImages.findMany({
        where: eq(styleGuideImages.styleGuideId, guide.id),
      })
    : [];

  const styleImage =
    images.find((img) => img.type === "style")?.url ?? null;

  const clientStyle: ClientStyleGuide = {
    id: guide?.id ?? "new",
    storyId,
    summary: guide?.summary ?? "",
    styleGuideImage: styleImage,
    negativePrompt: guide?.negativePrompt ?? "",
    sampleIllustrationUrl: guide?.sampleIllustrationUrl ?? null,
  };

  /* -------------------------------------------------
     RENDER
  -------------------------------------------------- */

  return (
    <main>
      <InitialStyleDesignEditor
        style={clientStyle}
        spreads={spreads}
        initialSpreadIndex={spreadIndex}
        storyStatus={story.status as any}
        sampleImage={guide?.sampleIllustrationUrl}
      />
    </main>
  );
}
