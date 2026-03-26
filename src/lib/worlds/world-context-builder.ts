// world-context-builder.ts
// Drop into: src/lib/worlds/world-context-builder.ts
//
// This is the critical function that assembles everything a story generation
// prompt needs to know about the world, the reader, and the series history.
// Called by the Inngest pipeline when generating a new book in a world.

import { db } from "@/db";
import {
  worlds,
  worldReaders,
  worldCharacters,
  worldLocations,
  worldNarrativeMemory,
  readers,
  readerInsights,
} from "@/db/schema/worlds";
import { eq, and, asc, desc } from "drizzle-orm";
import type { WorldContext, ReaderContext } from "@/types/worlds";

/**
 * Build the complete context for generating a new story in a world.
 * This gets injected into the Claude API system prompt.
 */
export async function buildWorldContext(
  worldId: string
): Promise<WorldContext | null> {
  // 1. Get the world
  const world = await db.query.worlds.findFirst({
    where: eq(worlds.id, worldId),
  });

  if (!world) return null;

  // 2. Get the primary reader with active insights
  const worldReaderLinks = await db
    .select({
      role: worldReaders.role,
      readerId: worldReaders.readerId,
    })
    .from(worldReaders)
    .where(eq(worldReaders.worldId, worldId));

  if (worldReaderLinks.length === 0) return null;

  // Get the first reader (primary) — expand for multi-reader later
  const primaryReaderLink = worldReaderLinks[0];
  const reader = await db.query.readers.findFirst({
    where: eq(readers.id, primaryReaderLink.readerId),
  });

  if (!reader) return null;

  // Get active insights for this reader
  const insights = await db
    .select({
      insightType: readerInsights.insightType,
      content: readerInsights.content,
    })
    .from(readerInsights)
    .where(
      and(
        eq(readerInsights.readerId, reader.id),
        eq(readerInsights.isActive, true)
      )
    )
    .orderBy(desc(readerInsights.createdAt))
    .limit(20); // cap at 20 most recent active insights

  const readerContext: ReaderContext = {
    name: reader.name,
    age: reader.age,
    pronouns: reader.pronouns,
    personalityNotes: reader.personalityNotes,
    interests: (reader.interests as string[]) ?? [],
    fears: (reader.fears as string[]) ?? [],
    readingLevel: reader.readingLevel,
    activeInsights: insights.map((i) => ({
      type: i.insightType as any,
      content: i.content,
    })),
  };

  // 3. Get recurring characters with their details
  // NOTE: You'll need to adjust the join to match your actual characters table
  const characters = await db
    .select({
      characterId: worldCharacters.characterId,
      isRecurring: worldCharacters.isRecurring,
      characterArc: worldCharacters.characterArc,
      // Add joins to your characters table here:
      // name: characters.name,
      // description: characters.description,
      // imageUrl: characters.imageUrl,
    })
    .from(worldCharacters)
    .where(
      and(
        eq(worldCharacters.worldId, worldId),
        eq(worldCharacters.isRecurring, true)
      )
    )
    .orderBy(asc(worldCharacters.sortOrder));

  // TODO: Join with your characters table to populate name/description/imageUrl
  // For now, returning characterId so you can join in your pipeline
  const recurringCharacters = characters.map((c) => ({
    name: "", // populated from characters table join
    description: null as string | null,
    arc: c.characterArc,
    imageUrl: null as string | null,
    characterId: c.characterId,
  }));

  // 4. Get recurring locations
  const locations = await db
    .select({
      locationId: worldLocations.locationId,
      isRecurring: worldLocations.isRecurring,
    })
    .from(worldLocations)
    .where(
      and(
        eq(worldLocations.worldId, worldId),
        eq(worldLocations.isRecurring, true)
      )
    )
    .orderBy(asc(worldLocations.sortOrder));

  const recurringLocations = locations.map((l) => ({
    name: "", // populated from locations table join
    description: null as string | null,
    imageUrl: null as string | null,
    locationId: l.locationId,
  }));

  // 5. Get narrative memory (all previous books)
  const memory = await db
    .select()
    .from(worldNarrativeMemory)
    .where(eq(worldNarrativeMemory.worldId, worldId))
    .orderBy(asc(worldNarrativeMemory.bookNumber));

  // Also get story titles for context
  // Adjust to your stories table
  const storyTitles = await db.execute(
    `SELECT id, title, book_number FROM stories
     WHERE world_id = $1 AND book_number IS NOT NULL
     ORDER BY book_number ASC`,
    [worldId]
  );

  const titleMap = new Map<number, string>();
  (storyTitles.rows ?? []).forEach((row: any) => {
    if (row.book_number != null) {
      titleMap.set(row.book_number, row.title);
    }
  });

  const previousBooks = memory.map((m) => ({
    bookNumber: m.bookNumber,
    title: titleMap.get(m.bookNumber) ?? `Book ${m.bookNumber}`,
    summary: m.summary,
    characterDevelopments: (m.characterDevelopments as any[]) ?? [],
    ongoingPlotPoints: ((m.plotPoints as any[]) ?? [])
      .filter((p: any) => p.isOngoing)
      .map((p: any) => p.point),
    callbacks: (m.callbacks as any[]) ?? [],
    emotionalThemes: (m.emotionalThemes as string[]) ?? [],
  }));

  // 6. Calculate next book number
  const nextBookNumber =
    memory.length > 0
      ? Math.max(...memory.map((m) => m.bookNumber)) + 1
      : 1;

  return {
    worldName: world.name,
    worldDescription: world.description,
    tonality: world.tonality,
    themes: (world.themes as string[]) ?? [],
    reader: readerContext,
    recurringCharacters,
    recurringLocations,
    previousBooks,
    nextBookNumber,
  };
}

/**
 * Convert a WorldContext into a system prompt section for Claude.
 * This is the "previously on..." that makes series work.
 */
export function worldContextToPrompt(ctx: WorldContext): string {
  const parts: string[] = [];

  parts.push(`<world>
<name>${ctx.worldName}</name>
${ctx.worldDescription ? `<description>${ctx.worldDescription}</description>` : ""}
${ctx.tonality ? `<tonality>${ctx.tonality}</tonality>` : ""}
${ctx.themes.length > 0 ? `<themes>${ctx.themes.join(", ")}</themes>` : ""}
</world>`);

  parts.push(`<reader>
<name>${ctx.reader.name}</name>
${ctx.reader.age ? `<age>${ctx.reader.age}</age>` : ""}
${ctx.reader.pronouns ? `<pronouns>${ctx.reader.pronouns}</pronouns>` : ""}
${ctx.reader.personalityNotes ? `<personality>${ctx.reader.personalityNotes}</personality>` : ""}
${ctx.reader.interests.length > 0 ? `<interests>${ctx.reader.interests.join(", ")}</interests>` : ""}
${ctx.reader.fears.length > 0 ? `<working_through>${ctx.reader.fears.join(", ")}</working_through>` : ""}
${ctx.reader.readingLevel ? `<reading_level>${ctx.reader.readingLevel}</reading_level>` : ""}
${ctx.reader.activeInsights.length > 0 ? `<recent_insights>
${ctx.reader.activeInsights.map((i) => `  <insight type="${i.type}">${i.content}</insight>`).join("\n")}
</recent_insights>` : ""}
</reader>`);

  if (ctx.recurringCharacters.length > 0) {
    parts.push(`<recurring_characters>
${ctx.recurringCharacters
  .map(
    (c) => `  <character>
    <name>${c.name}</name>
    ${c.description ? `<description>${c.description}</description>` : ""}
    ${c.arc ? `<arc>${c.arc}</arc>` : ""}
  </character>`
  )
  .join("\n")}
</recurring_characters>`);
  }

  if (ctx.recurringLocations.length > 0) {
    parts.push(`<recurring_locations>
${ctx.recurringLocations
  .map(
    (l) => `  <location>
    <name>${l.name}</name>
    ${l.description ? `<description>${l.description}</description>` : ""}
  </location>`
  )
  .join("\n")}
</recurring_locations>`);
  }

  if (ctx.previousBooks.length > 0) {
    parts.push(`<series_history>
This is Book ${ctx.nextBookNumber} in the series. Here is what has happened so far:
${ctx.previousBooks
  .map(
    (b) => `
  <book number="${b.bookNumber}" title="${b.title}">
    <summary>${b.summary}</summary>
    ${b.characterDevelopments.length > 0 ? `<character_growth>
${b.characterDevelopments.map((d) => `      ${d.development}`).join("\n")}
    </character_growth>` : ""}
    ${b.ongoingPlotPoints.length > 0 ? `<unresolved_threads>
${b.ongoingPlotPoints.map((p) => `      - ${p}`).join("\n")}
    </unresolved_threads>` : ""}
    ${b.callbacks.length > 0 ? `<available_callbacks>
${b.callbacks.map((c) => `      - "${c.reference}": ${c.context}`).join("\n")}
    </available_callbacks>` : ""}
    ${b.emotionalThemes.length > 0 ? `<themes>${b.emotionalThemes.join(", ")}</themes>` : ""}
  </book>`
  )
  .join("\n")}
</series_history>

<series_instructions>
- Maintain character consistency with previous books. Characters should feel familiar but show growth.
- Reference at least one callback from a previous book — this creates the "connected universe" feeling children love.
- Build on unresolved plot threads where relevant, but each book must also work as a standalone story.
- The reader (${ctx.reader.name}) should feel like they belong in this world — the world should feel like coming home.
- Evolve the emotional complexity slightly from the previous book, appropriate for the reader's growth.
</series_instructions>`);
  }

  return parts.join("\n\n");
}