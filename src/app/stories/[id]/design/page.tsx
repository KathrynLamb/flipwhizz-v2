import { notFound, redirect } from "next/navigation";
import { db } from "@/db";
import { 
  stories, 
  storyPages, 
  storyStyleGuide, 
  storyPageCharacters, 
  storyPageLocations, 
  characters, 
  locations 
} from "@/db/schema";
import { eq, inArray, asc } from "drizzle-orm";
// 1. Correctly import the types from the Client Component
import InitialStyleDesignEditor, { 
  ClientStyleGuide, 
  Entity 
} from "@/app/stories/[id]/design/components/InitialStyleDesignEditor";

export default async function DesignPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // 1. Await params (Next.js 15 requirement)
  const { id } = await params;

  // 2. Fetch Story (Verify existence)
  const story = await db.query.stories.findFirst({
    where: eq(stories.id, id),
  });

  if (!story) return notFound();

  // 3. Fetch Pages (Get first 2 pages for context)
  const storyPageData = await db.query.storyPages.findMany({
    where: eq(storyPages.storyId, id),
    orderBy: asc(storyPages.pageNumber),
    limit: 2,
  });

  if (storyPageData.length === 0) {
    redirect(`/stories/${id}/view`);
  }

  // 4. Fetch Style Guide & Reference Images using Drizzle Relations
  const guide = await db.query.storyStyleGuide.findFirst({
    where: eq(storyStyleGuide.storyId, id),
    with: {
      referenceImages: true, 
    },
  });

  // 5. Fetch Characters (Only those appearing on Page 1 & 2)
  const pageIds = storyPageData.map((p) => p.id);
  
  const characterData = await db
    .select({
      id: characters.id,
      name: characters.name,
      description: characters.description,
      referenceImageUrl: characters.referenceImageUrl,
    })
    .from(storyPageCharacters)
    .innerJoin(characters, eq(storyPageCharacters.characterId, characters.id))
    .where(inArray(storyPageCharacters.pageId, pageIds))
    .groupBy(characters.id);

  // 6. Fetch Locations (Only those appearing on Page 1 & 2)
  const locationData = await db
    .select({
      id: locations.id,
      name: locations.name,
      description: locations.description,
      referenceImageUrl: locations.referenceImageUrl, 
    })
    .from(storyPageLocations)
    .innerJoin(locations, eq(storyPageLocations.locationId, locations.id))
    .where(inArray(storyPageLocations.pageId, pageIds))
    .groupBy(locations.id);

  // 7. Prepare Clean Props for Client Component
  const leftText = storyPageData[0]?.text || "";
  const rightText = storyPageData[1]?.text || "";

  // 8. Find the specific "style" reference image from the joined relation
  const mainStyleImage = guide?.referenceImages?.find(img => img.type === 'style')?.url ?? null;

  const clientStyle: ClientStyleGuide = {
    id: guide?.id ?? "new",
    storyId: id,
    summary: guide?.summary ?? "",
    styleGuideImage: mainStyleImage, 
    negativePrompt: guide?.negativePrompt ?? "",
    sampleIllustrationUrl: guide?.sampleIllustrationUrl ?? null,
  };

  const characterEntities: Entity[] = characterData.map((c) => ({
    id: c.id,
    name: c.name,
    description: c.description ?? "",
    referenceImageUrl: c.referenceImageUrl ?? null,
  }));

  const locationEntities: Entity[] = locationData.map((l) => ({
    id: l.id,
    name: l.name,
    description: l.description ?? "",
    referenceImageUrl: l.referenceImageUrl ?? null,
  }));

  return (
    <main className="min-h-screen bg-[#FAF9F6] text-stone-800 p-6 lg:p-12">
      <div className="max-w-5xl mx-auto">
        <header className="mb-10">
          <h1 className="text-3xl font-serif text-indigo-900 mb-2">{story.title}</h1>
          <p className="text-indigo-900">
            Let's design the visual style for your book using the first two pages.
          </p>
        </header>

        <InitialStyleDesignEditor
          style={clientStyle}
          leftText={leftText}
          rightText={rightText}
          characters={characterEntities}
          locations={locationEntities}
        />
      </div>
    </main>
  );
}