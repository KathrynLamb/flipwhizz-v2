import { notFound, redirect } from "next/navigation";
import { db } from "@/db";
import {
  stories,
  storySpreads,
  storyPages,
  storySpreadPresence,
  characters,
  locations,
  storyStyleGuide,
  styleGuideImages,
} from "@/db/schema";
import { eq, inArray } from "drizzle-orm";

import StylePreviewStage, {
  ClientStyleGuide,
  EntityUI,
  SpreadUI,
} from "@/app/stories/[id]/design/components/StylePreviewStage";

export default async function DesignPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ spread?: string }>;
}) {
  const { id: storyId } = await params;
  const { spread } = (await searchParams) ?? {};

  /* ── STORY ── */
  const story = await db.query.stories.findFirst({
    where: eq(stories.id, storyId),
  });
  if (!story) return notFound();

  /* ── SPREADS ── */
  const spreadsRaw = await db
    .select()
    .from(storySpreads)
    .where(eq(storySpreads.storyId, storyId))
    .orderBy(storySpreads.spreadIndex);

  if (spreadsRaw.length === 0) {
    redirect(`/stories/${storyId}/extract`);
  }

  const spreadIndex =
    spread && !Number.isNaN(Number(spread))
      ? Math.max(0, Math.min(spreadsRaw.length - 1, Number(spread)))
      : Math.floor(spreadsRaw.length / 2);

  /* ── PAGES ── */
  const allPageIds = spreadsRaw.flatMap((s) =>
    [s.leftPageId, s.rightPageId].filter(Boolean)
  ) as string[];

  const pages = await db.query.storyPages.findMany({
    where: inArray(storyPages.id, allPageIds),
  });

  const pageById = Object.fromEntries(pages.map((p) => [p.id, p]));

  /* ── SPREAD PRESENCE ── */
  const presences = await db
    .select()
    .from(storySpreadPresence)
    .where(
      inArray(
        storySpreadPresence.spreadId,
        spreadsRaw.map((s) => s.id)
      )
    );

  const presenceBySpreadId = new Map(presences.map((p) => [p.spreadId, p]));

  /* ── LOAD ALL CHARACTERS & LOCATIONS ── */
  const allCharacterIds = Array.from(
    new Set(
      presences.flatMap((p) =>
        (p.characters as any)?.map((c: any) => c.characterId) ?? []
      )
    )
  );

  const allLocationIds = Array.from(
    new Set(
      presences
        .map((p) => p.primaryLocationId)
        .filter(Boolean) as string[]
    )
  );

  const allCharacters =
    allCharacterIds.length > 0
      ? await db.query.characters.findMany({
          where: inArray(characters.id, allCharacterIds),
        })
      : [];

  const allLocations =
    allLocationIds.length > 0
      ? await db.query.locations.findMany({
          where: inArray(locations.id, allLocationIds),
        })
      : [];

  const charactersById = Object.fromEntries(
    allCharacters.map((c) => [c.id, c])
  );

  const locationsById = Object.fromEntries(
    allLocations.map((l) => [l.id, l])
  );

  /* ── BUILD SpreadUI[] ── */
  const spreadsUI: SpreadUI[] = spreadsRaw.map((spread, idx) => {
    const presence = presenceBySpreadId.get(spread.id);

    const leftPage = spread.leftPageId ? pageById[spread.leftPageId] : null;
    const rightPage = spread.rightPageId ? pageById[spread.rightPageId] : null;

    // Build character entities
    const characterEntities: EntityUI[] =
      (presence?.characters as any)?.map((meta: any) => {
        const c = charactersById[meta.characterId];
        if (!c) return null;

        return {
          id: c.id,
          kind: "character" as const,
          name: c.name,
          description: c.description ?? null,
          referenceImageUrl: c.referenceImageUrl ?? null,
          imageUrl: c.portraitImageUrl ?? c.referenceImageUrl ?? null,
        };
      }).filter(Boolean) ?? [];

    // Build location entities
    const locationEntities: EntityUI[] =
      presence?.primaryLocationId && locationsById[presence.primaryLocationId]
        ? [
            {
              id: locationsById[presence.primaryLocationId].id,
              kind: "location" as const,
              name: locationsById[presence.primaryLocationId].name,
              description:
                locationsById[presence.primaryLocationId].description ?? null,
              referenceImageUrl:
                locationsById[presence.primaryLocationId].referenceImageUrl ??
                null,
              imageUrl:
                locationsById[presence.primaryLocationId].portraitImageUrl ??
                locationsById[presence.primaryLocationId].referenceImageUrl ??
                null,
            },
          ]
        : [];

    // Merge into single entities array
    const entities = [...characterEntities, ...locationEntities];

    return {
      spreadIndex: idx + 1,
      sceneSummary: spread.sceneSummary ?? null,
      leftPage: leftPage
        ? {
            id: leftPage.id,
            pageNumber: leftPage.pageNumber,
            text: leftPage.text,
          }
        : null,
      rightPage: rightPage
        ? {
            id: rightPage.id,
            pageNumber: rightPage.pageNumber,
            text: rightPage.text,
          }
        : null,
      entities,
    };
  });

  /* ── STYLE GUIDE ── */
  const guide = await db.query.storyStyleGuide.findFirst({
    where: eq(storyStyleGuide.storyId, storyId),
  });

  const images = guide
    ? await db.query.styleGuideImages.findMany({
        where: eq(styleGuideImages.styleGuideId, guide.id),
      })
    : [];

  const styleRefUrl =
    images.find((img) => img.type === "style")?.url ?? guide?.styleGuideImage ?? null;

  const clientStyle: ClientStyleGuide = {
    id: guide?.id ?? "new",
    storyId,
    summary: guide?.summary ?? "",
    negativePrompt: guide?.negativePrompt ?? "",
    artStyle: guide?.artStyle ?? "",
    visualThemes: guide?.visualThemes ?? "",
    colorPalette: guide?.colorPalette ?? null,
    styleReferenceUrl: styleRefUrl,
    sampleIllustrationUrl: guide?.sampleIllustrationUrl ?? null,
  };

  console.log("STYLE,", clientStyle)
  return (
    <main>
      <StylePreviewStage
        storyId={storyId}
        storyTitle={story.title}
        spreads={spreadsUI}
        initialSpreadIndex={spreadIndex}
        style={clientStyle}
      />
    </main>
  );
}