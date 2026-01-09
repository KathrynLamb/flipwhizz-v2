import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";

import { db } from "@/db";
import {
  stories,
  storyPages,
  storyStyleGuide,
  storyPageCharacters,
  storyPageLocations,
  characters,
  locations,
  styleGuideImages,
} from "@/db/schema";
import { eq, inArray, asc } from "drizzle-orm";

import InitialStyleDesignEditor, {
  ClientStyleGuide,
  Entity,
} from "@/app/stories/[id]/design/components/InitialStyleDesignEditor";

export default async function DesignPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  /* -------------------------------------------------
     PARAMS
  -------------------------------------------------- */

  const { id: storyId } = await params;


  

  /* -------------------------------------------------
     STORY
  -------------------------------------------------- */

  const story = await db.query.stories.findFirst({
    where: eq(stories.id, storyId),
  });
  console.log("story", story)
  if (!story) return notFound();

  /* -------------------------------------------------
     PAGES (FIRST SPREAD ONLY)
  -------------------------------------------------- */

  const pages = await db.query.storyPages.findMany({
    where: eq(storyPages.storyId, storyId),
    orderBy: asc(storyPages.pageNumber),
    limit: 2,
  });





  async function ensurePagePresence(
    storyId: string,
    pageNumbers: number[]
  ) {
    if (!pageNumbers.length) return;
  
    const h = await headers(); // ✅ MUST await
  
    const host =
      h.get("x-forwarded-host") ??
      h.get("host");
  
    if (!host) {
      console.warn("No host header available, skipping page presence");
      return;
    }
  
    const protocol =
      process.env.NODE_ENV === "development"
        ? "http"
        : "https";
  
    const url = `${protocol}://${host}/api/stories/${storyId}/page-presence?pages=${pageNumbers.join(",")}`;
  
    await fetch(url, {
      cache: "no-store",
    });
  }
  
  
  

  // 🔐 GUARANTEE PAGE PRESENCE EXISTS (fallback-safe)
await ensurePagePresence(
  storyId,
  pages.map((p) => p.pageNumber)
);


  if (pages.length === 0) {
    redirect(`/stories/${storyId}/view`);
  }

  const leftText = pages[0]?.text ?? "";
  const rightText = pages[1]?.text ?? "";




  /* -------------------------------------------------
     STYLE GUIDE + REFERENCES
  -------------------------------------------------- */

//   // const guide = await db.query.storyStyleGuide.findFirst({
//   //   where: eq(storyStyleGuide.storyId, storyId),
//   //   with: {
//   //     referenceImages: true,
//   //   },
//   // });

//   const guide = await db.query.storyStyleGuide.findFirst({
//     where: eq(storyStyleGuide.storyId, storyId),
//   });



// const images = guide
// ? await db.query.styleGuideImages.findMany({
//     where: eq(styleGuideImages.styleGuideId, guide.id),
//   })
// : [];


//   console.log("guide", guide)
//   console.log("sampleIll", guide?.sampleIllustrationUrl)

//   const styleImage =
//     guide?.referenceImages?.find((img) => img.type === "style")?.url ?? null;

//   const clientStyle: ClientStyleGuide = {
//     id: guide?.id ?? "new",
//     storyId,
//     summary: guide?.summary ?? "",
//     styleGuideImage: styleImage,
//     negativePrompt: guide?.negativePrompt ?? "",
//     sampleIllustrationUrl: guide?.sampleIllustrationUrl ?? null,
//   };

/* -------------------------------------------------
   STYLE GUIDE + REFERENCES
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
     CHARACTERS (FROM FIRST SPREAD)
  -------------------------------------------------- */

  const pageIds = pages.map((p) => p.id);

  const characterRows = await db
    .select({
      id: characters.id,
      name: characters.name,
      description: characters.description,
      referenceImageUrl: characters.referenceImageUrl,
    })
    .from(storyPageCharacters)
    .innerJoin(
      characters,
      eq(storyPageCharacters.characterId, characters.id)
    )
    .where(inArray(storyPageCharacters.pageId, pageIds))
    .groupBy(characters.id);

  const characterEntities: Entity[] = characterRows.map((c) => ({
    id: c.id,
    name: c.name,
    description: c.description ?? "",
    referenceImageUrl: c.referenceImageUrl ?? null,
  }));

  /* -------------------------------------------------
     LOCATIONS (FROM FIRST SPREAD)
  -------------------------------------------------- */

  const locationRows = await db
    .select({
      id: locations.id,
      name: locations.name,
      description: locations.description,
      referenceImageUrl: locations.referenceImageUrl,
    })
    .from(storyPageLocations)
    .innerJoin(
      locations,
      eq(storyPageLocations.locationId, locations.id)
    )
    .where(inArray(storyPageLocations.pageId, pageIds))
    .groupBy(locations.id);

  const locationEntities: Entity[] = locationRows.map((l) => ({
    id: l.id,
    name: l.name,
    description: l.description ?? "",
    referenceImageUrl: l.referenceImageUrl ?? null,
  }));

  const hadPresence =
  characterEntities.length > 0 || locationEntities.length > 0;

  /* -------------------------------------------------
     RENDER
  -------------------------------------------------- */



  return (
    <main>
      <InitialStyleDesignEditor
        style={clientStyle}
        leftText={leftText}
        rightText={rightText}
        characters={characterEntities}
        locations={locationEntities}
        storyStatus={story.status as any}
        sampleImage={guide?.sampleIllustrationUrl}
        presenceReady={hadPresence}
      />
    </main>
  );
}
