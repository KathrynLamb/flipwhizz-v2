import {
  stories,
  characters,
  locations,
  projects,
  storyCharacters as storyCharactersTable,
  storyLocations as storyLocationsTable,
  storyStyleGuide,
} from "@/db/schema";

import { db } from "@/db";
import { eq } from "drizzle-orm";
import CoverDesignPage from "@/app/stories/[id]/cover/CoverDesignPage";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function Page({ params }: Props) {
  const { id } = await params;

  /* -------------------- 1️⃣ Story -------------------- */

  const story = await db.query.stories.findFirst({
    where: eq(stories.id, id),
  });

  if (!story) {
    throw new Error("Story not found");
  }

  /* -------------------- 2️⃣ Characters (JOIN) -------------------- */

  const storyCharacters = await db
    .select({ character: characters })
    .from(storyCharactersTable)
    .innerJoin(
      characters,
      eq(storyCharactersTable.characterId, characters.id)
    )
    .where(eq(storyCharactersTable.storyId, story.id))
    .then((rows) => rows.map((r) => r.character));

  /* -------------------- 3️⃣ Locations (JOIN) -------------------- */

  const storyLocations = await db
    .select({ location: locations })
    .from(storyLocationsTable)
    .innerJoin(
      locations,
      eq(storyLocationsTable.locationId, locations.id)
    )
    .where(eq(storyLocationsTable.storyId, story.id))
    .then((rows) => rows.map((r) => r.location));

  /* -------------------- 4️⃣ Style Guide (story-level) -------------------- */

  const styleGuide = await db.query.storyStyleGuide.findFirst({
    where: eq(storyStyleGuide.storyId, story.id),
  });

  /* -------------------- Render -------------------- */

  return (
    <CoverDesignPage
      story={story}
      characters={storyCharacters}
      locations={storyLocations}
      styleGuide={styleGuide ?? null}
    />

  );
}
