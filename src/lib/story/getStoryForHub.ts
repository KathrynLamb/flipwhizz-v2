// src/lib/story/getStoryForHub.ts
import { db } from "@/db";
import {
  stories,
  storyPages,
  storyCharacters,
  storyLocations,
  storyStyleGuide,
  storyProducts,
  characters,
  locations,
} from "@/db/schema";
import { eq, asc } from "drizzle-orm";

export async function getStoryForHub(storyId: string) {
  /* -------------------------------------------------------------- */
  /* STORY                                                          */
  /* -------------------------------------------------------------- */

  const story = await db.query.stories.findFirst({
    where: eq(stories.id, storyId),
  });

  if (!story) return null;

  /* -------------------------------------------------------------- */
  /* PAGES                                                          */
  /* -------------------------------------------------------------- */

  const pages = await db.query.storyPages.findMany({
    where: eq(storyPages.storyId, storyId),
    orderBy: asc(storyPages.pageNumber),
  });

  /* -------------------------------------------------------------- */
  /* CHARACTERS (REAL ENTITIES + STORY METADATA)                    */
  /* -------------------------------------------------------------- */

  const storyCharactersWithDetails = await db
    .select({
      // canonical character fields
      id: characters.id,
      name: characters.name,
      description: characters.description,
      appearance: characters.appearance,
      visualDetails: characters.visualDetails,
      personalityTraits: characters.personalityTraits,
      portraitImageUrl: characters.portraitImageUrl,
      referenceImageUrl: characters.referenceImageUrl,

      // story-specific fields
      role: storyCharacters.role,
      arcSummary: storyCharacters.arcSummary,
    })
    .from(storyCharacters)
    .innerJoin(
      characters,
      eq(storyCharacters.characterId, characters.id)
    )
    .where(eq(storyCharacters.storyId, storyId));

  /* -------------------------------------------------------------- */
  /* LOCATIONS (REAL ENTITIES + STORY METADATA)                     */
  /* -------------------------------------------------------------- */

  const storyLocationsWithDetails = await db
    .select({
      id: locations.id,
      name: locations.name,
      description: locations.description,
      visualDetails: locations.visualDetails,
      portraitImageUrl: locations.portraitImageUrl,
      referenceImageUrl: locations.referenceImageUrl,

      // story-specific
      significance: storyLocations.significance,
    })
    .from(storyLocations)
    .innerJoin(
      locations,
      eq(storyLocations.locationId, locations.id)
    )
    .where(eq(storyLocations.storyId, storyId));

  /* -------------------------------------------------------------- */
  /* STYLE GUIDE                                                    */
  /* -------------------------------------------------------------- */

  const styleGuide = await db.query.storyStyleGuide.findFirst({
    where: eq(storyStyleGuide.storyId, storyId),
  });

  /* -------------------------------------------------------------- */
  /* PRODUCT / PAYMENT INTENT                                       */
  /* -------------------------------------------------------------- */

  const product = await db.query.storyProducts.findFirst({
    where: eq(storyProducts.storyId, storyId),
  });

  /* -------------------------------------------------------------- */
  /* RETURN SHAPE                                                   */
  /* -------------------------------------------------------------- */

  return {
    story,
    pages,

    // these are now SAFE for UI use
    characters: storyCharactersWithDetails,
    locations: storyLocationsWithDetails,

    styleGuide,
    product,
  };
}
