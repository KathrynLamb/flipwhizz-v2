import { db } from "@/db";
import { 
  stories, 
  characters, 
  locations, 
  storyPages, 
  storyCharacters, 
  storyLocations,
  storyPageCharacters 
} from "@/db/schema";
import { eq, asc, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // 1. Fetch Story
  const story = await db.query.stories.findFirst({
    where: eq(stories.id, id),
  });

  if (!story) {
    return NextResponse.json({ error: "Story not found" }, { status: 404 });
  }

  // 2. Fetch Characters (Using Explicit Join)
  // JOIN storyCharacters -> characters
  const fetchedCharacters = await db
    .select({
      id: characters.id,
      name: characters.name,
      description: characters.description,
      appearance: characters.appearance,
      referenceImageUrl: characters.referenceImageUrl,
    })
    .from(storyCharacters)
    .innerJoin(characters, eq(storyCharacters.characterId, characters.id))
    .where(eq(storyCharacters.storyId, id));

  // 3. Fetch Locations (Using Explicit Join)
  // JOIN storyLocations -> locations
  const fetchedLocations = await db
    .select({
      id: locations.id,
      name: locations.name,
      description: locations.description,
      // Add referenceImageUrl if your schema has it for locations
      referenceImageUrl: locations.referenceImageUrl,
    })
    .from(storyLocations)
    .innerJoin(locations, eq(storyLocations.locationId, locations.id))
    .where(eq(storyLocations.storyId, id));

  // 4. Fetch Pages
  const pages = await db.query.storyPages.findMany({
    where: eq(storyPages.storyId, id),
    orderBy: asc(storyPages.pageNumber),
    columns: { id: true, pageNumber: true }
  });

  // 5. Fetch Page Presence
  // We want all character presence entries for the pages we just fetched
  const pageIds = pages.map(p => p.id);
  
  let presenceData: any[] = [];
  
  if (pageIds.length > 0) {
    presenceData = await db
      .select()
      .from(storyPageCharacters)
      .where(inArray(storyPageCharacters.pageId, pageIds));
  }

  return NextResponse.json({
    story,
    characters: fetchedCharacters,
    locations: fetchedLocations,
    pages,
    presence: presenceData // List of { pageId, characterId }
  });
}