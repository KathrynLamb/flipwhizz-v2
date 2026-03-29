// src/inngest/worldAwareExtraction.ts
//
// Drop-in helpers for ensureWorld.ts Steps 1 & 2.
// When a story belongs to a world, these functions:
// 1. Load the existing world character/location roster
// 2. Ask Claude to MATCH existing entities or identify NEW ones
// 3. Reuse existing records (with their images, outfits, etc.)
// 4. Only create fresh records for genuinely new entities
// 5. Optionally promote new entities to the world roster

import { db } from "@/db";
import {
  stories,
  characters,
  storyCharacters,
  locations,
  storyLocations,
} from "@/db/schema";
import {
  worlds,
  worldCharacters,
  worldLocations,
} from "@/db/schema-worlds";
import { eq, and, inArray } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

const MODEL = "claude-sonnet-4-20250514";

function extractJson(raw: string) {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const text = (fenced?.[1] ?? raw).trim();
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  const json = first !== -1 && last !== -1 ? text.slice(first, last + 1) : text;
  return JSON.parse(json);
}

function extractClaudeText(content: any): string {
  return (Array.isArray(content) ? content : [])
    .map((b: any) => (b?.type === "text" ? String(b.text ?? "") : ""))
    .join("\n")
    .trim();
}

const cap = (v: unknown, max: number) =>
  typeof v === "string" ? v.trim().slice(0, max) : null;

// ============================================================================
// LOAD WORLD ROSTER
// ============================================================================

interface ExistingCharacter {
  characterId: string;
  name: string;
  description: string | null;
  appearance: string | null;
  isRecurring: boolean;
}

interface ExistingLocation {
  locationId: string;
  name: string;
  description: string | null;
  isRecurring: boolean;
}

export async function loadWorldCharacterRoster(
  worldId: string
): Promise<ExistingCharacter[]> {
  const worldChars = await db
    .select({
      characterId: worldCharacters.characterId,
      isRecurring: worldCharacters.isRecurring,
    })
    .from(worldCharacters)
    .where(eq(worldCharacters.worldId, worldId));

  if (worldChars.length === 0) return [];

  const charIds = worldChars.map((wc) => wc.characterId);
  const charDetails = await db
    .select({
      id: characters.id,
      name: characters.name,
      description: characters.description,
      appearance: characters.appearance,
    })
    .from(characters)
    .where(inArray(characters.id, charIds));

  return charDetails.map((c) => ({
    characterId: c.id,
    name: c.name,
    description: c.description,
    appearance: c.appearance,
    isRecurring:
      worldChars.find((wc) => wc.characterId === c.id)?.isRecurring ?? false,
  }));
}

export async function loadWorldLocationRoster(
  worldId: string
): Promise<ExistingLocation[]> {
  const worldLocs = await db
    .select({
      locationId: worldLocations.locationId,
      isRecurring: worldLocations.isRecurring,
    })
    .from(worldLocations)
    .where(eq(worldLocations.worldId, worldId));

  if (worldLocs.length === 0) return [];

  const locIds = worldLocs.map((wl) => wl.locationId);
  const locDetails = await db
    .select({
      id: locations.id,
      name: locations.name,
      description: locations.description,
    })
    .from(locations)
    .where(inArray(locations.id, locIds));

  return locDetails.map((l) => ({
    locationId: l.id,
    name: l.name,
    description: l.description,
    isRecurring:
      worldLocs.find((wl) => wl.locationId === l.id)?.isRecurring ?? false,
  }));
}

// ============================================================================
// WORLD-AWARE CHARACTER EXTRACTION
// ============================================================================

export async function extractCharactersWorldAware(params: {
  storyId: string;
  worldId: string;
  userId: string;
  storyText: string;
}): Promise<void> {
  const { storyId, worldId, userId, storyText } = params;

  console.log("👥 [world-aware] Extracting characters with world context...");

  const existingRoster = await loadWorldCharacterRoster(worldId);
  console.log(
    `📋 World has ${existingRoster.length} existing characters:`,
    existingRoster.map((c) => c.name).join(", ")
  );

  const rosterSection =
    existingRoster.length > 0
      ? `KNOWN CHARACTERS FROM THIS WORLD (reuse these when they appear):
${existingRoster
  .map(
    (c) =>
      `- "${c.name}" (ID: ${c.characterId}): ${c.description || "No description"}`
  )
  .join("\n")}`
      : "No existing characters in this world yet.";

  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 2500,
    system: `Extract ALL characters from this story. Some characters may already exist from previous books in this series.

${rosterSection}

Return ONLY this JSON:
{
  "characters": [
     {
          "existingId": "uuid-or-null",
          "name": "Character Name",
           "nameIsUpgrade": false,
           "species": "human",
           "breed": null,
           "description": "personality, traits, behavior",
           "appearance": "detailed physical description for illustration",
           "role": "main/supporting/minor",
           "isNew": false,
           "shouldPromoteToWorld": false
         }
  ]
}

MATCHING RULES:
- If a character matches a KNOWN CHARACTER by name (even with slight variations like "Bodi" vs "Bodi the dog"), set existingId to their ID and isNew to false
- If a known character had a generic or incomplete name (like "Smaller Dog", "Aunt", "The Fox") but this story uses a proper name (like "Bodi", "Aunt Katy", "Milo"), set nameIsUpgrade to true. The system will update their name.
- If the existing name is already a proper name and the new story uses the same or a less specific name, set nameIsUpgrade to false.
- For genuinely NEW characters not in the roster, set existingId to null and isNew to true
- Set "species" to one of: "human", "dog", "cat", "rabbit", "horse", "bird", "fantasy", "other"
- For animals, set "breed" to the best guess (e.g. "Border Collie mix", "Golden Retriever", "Tabby cat")
- For animals, the "appearance" field should LEAD with species, breed, and coat colour: "Black Border Collie mix dog, medium-sized, alert posture..." NOT "medium-sized, alert posture, black coat..."
- For humans, set species to "human" and breed to null
- For new characters that seem important/recurring (not one-off minor characters), set shouldPromoteToWorld to true
- ALWAYS include appearance details even for existing characters (for consistency checking)
- DO NOT include clothing in appearance — that's handled separately`,
    messages: [{ role: "user", content: storyText }],
  });

  const data = extractJson(extractClaudeText(res.content));

  await db.transaction(async (tx) => {
    // Clear existing story-character links (not the characters themselves)
    await tx
      .delete(storyCharacters)
      .where(eq(storyCharacters.storyId, storyId));

    for (const c of data.characters ?? []) {
      if (!c.name) continue;

      let characterId: string;

      if (c.existingId && !c.isNew) {
        characterId = c.existingId;
        console.log(`  ✓ Matched existing: ${c.name} (${characterId})`);
      
        const existing = existingRoster.find(
          (e) => e.characterId === characterId
        );
        if (existing) {
          const updates: Record<string, any> = {};
      
          if (c.nameIsUpgrade && c.name) {
            updates.name = cap(c.name, 80);
            console.log(`  📝 Name upgraded: "${existing.name}" → "${c.name}"`);
          }
      
          if (!existing.appearance && c.appearance) {
            updates.appearance = cap(c.appearance, 500);
          }
          if (!existing.description && c.description) {
            updates.description = cap(c.description, 500);
          }

          // Update species/breed if not already set
          if (c.species && c.species !== 'human') {
            const charRecord = await tx
              .select({ species: characters.species, breed: characters.breed })
              .from(characters)
              .where(eq(characters.id, characterId))
              .limit(1)
              .then((r) => r[0]);

            if (charRecord && (!charRecord.species || charRecord.species === 'human')) {
              updates.species = c.species;
            }
            if (charRecord && !charRecord.breed && c.breed) {
              updates.breed = cap(c.breed, 100);
            }
          }

          if (Object.keys(updates).length > 0) {
            updates.updatedAt = new Date();
            await tx
              .update(characters)
              .set(updates)
              .where(eq(characters.id, characterId));
          }
        }
      } else {
        // NEW — create fresh character
        characterId = uuid();
        await tx.insert(characters).values({
          id: characterId,
          userId,
          name: cap(c.name, 80)!,
          species: c.species || "human",        // ADD
          breed: cap(c.breed, 100),    
          description: cap(c.description, 500),
          appearance: cap(c.appearance, 500),
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        console.log(`  + New character: ${c.name} (${characterId})`);

        // Promote to world if recommended
        if (c.shouldPromoteToWorld) {
          try {
            await tx.insert(worldCharacters).values({
              id: uuid(),
              worldId,
              characterId,
              isRecurring: c.role === "main" || c.role === "supporting",
              firstAppearanceStoryId: storyId,
              characterArc: null,
              sortOrder: existingRoster.length + 1,
              createdAt: new Date(),
              updatedAt: new Date(),
            });
            console.log(`  🌍 Promoted to world: ${c.name}`);
          } catch {
            // Might already exist in world — ignore duplicate
          }
        }
      }

      // Link character to this story
      await tx.insert(storyCharacters).values({
        storyId,
        characterId,
        role: cap(c.role, 40),
        arcSummary: null,
      });
    }

    console.log(`✅ [world-aware] Processed ${data.characters?.length || 0} characters`);
  });
}

// ============================================================================
// WORLD-AWARE LOCATION EXTRACTION
// ============================================================================

export async function extractLocationsWorldAware(params: {
  storyId: string;
  worldId: string;
  userId: string;
  storyText: string;
}): Promise<void> {
  const { storyId, worldId, userId, storyText } = params;

  console.log("🗺️ [world-aware] Extracting locations with world context...");

  const existingRoster = await loadWorldLocationRoster(worldId);
  console.log(
    `📋 World has ${existingRoster.length} existing locations:`,
    existingRoster.map((l) => l.name).join(", ")
  );

  const rosterSection =
    existingRoster.length > 0
      ? `KNOWN LOCATIONS FROM THIS WORLD (reuse these when they appear):
${existingRoster
  .map(
    (l) =>
      `- "${l.name}" (ID: ${l.locationId}): ${l.description || "No description"}`
  )
  .join("\n")}`
      : "No existing locations in this world yet.";

  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 1500,
    system: `Extract ALL locations/settings from this story. Some locations may already exist from previous books in this series.

${rosterSection}

Return ONLY this JSON:
{
  "locations": [
    {
      "existingId": "uuid-or-null",
      "name": "Location Name",
      "description": "detailed visual description for illustration",
      "isNew": false,
      "shouldPromoteToWorld": false
    }
  ]
}

MATCHING RULES:
- If a location matches a KNOWN LOCATION by name or concept (e.g. "The Garden" matches "Sophia's Garden"), set existingId to their ID and isNew to false
- For genuinely NEW locations, set existingId to null and isNew to true
- For new locations that seem significant (not a brief passing mention), set shouldPromoteToWorld to true
- ALWAYS include visual description even for existing locations`,
    messages: [{ role: "user", content: storyText }],
  });

  const data = extractJson(extractClaudeText(res.content));

  await db.transaction(async (tx) => {
    // Clear existing story-location links
    await tx
      .delete(storyLocations)
      .where(eq(storyLocations.storyId, storyId));

    for (const l of data.locations ?? []) {
      if (!l.name) continue;

      let locationId: string;

      if (l.existingId && !l.isNew) {
        // MATCHED — reuse existing location
        locationId = l.existingId;
        console.log(`  ✓ Matched existing: ${l.name} (${locationId})`);



        // Enrich description if sparse
        const existing = existingRoster.find(
          (e) => e.locationId === locationId
        );
        if (existing && !existing.description && l.description) {
          await tx
            .update(locations)
            .set({
              description: cap(l.description, 500),
              updatedAt: new Date(),
            })
            .where(eq(locations.id, locationId));
        }
   
      } else {
        // NEW — create fresh location
        locationId = uuid();
        await tx.insert(locations).values({
          id: locationId,
          userId,
          name: cap(l.name, 80)!,
          description: cap(l.description, 500),
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        console.log(`  + New location: ${l.name} (${locationId})`);

        // Promote to world if recommended
        if (l.shouldPromoteToWorld) {
          try {
            await tx.insert(worldLocations).values({
              id: uuid(),
              worldId,
              locationId,
              isRecurring: true,
              firstAppearanceStoryId: storyId,
              sortOrder: existingRoster.length + 1,
              createdAt: new Date(),
            });
            console.log(`  🌍 Promoted to world: ${l.name}`);
          } catch {
            // Might already exist — ignore duplicate
          }
        }
      }

      // Link location to this story
      await tx.insert(storyLocations).values({
        storyId,
        locationId,
        significance: null,
      });
    }

    console.log(`✅ [world-aware] Processed ${data.locations?.length || 0} locations`);
  });
}

// ============================================================================
// AUTO-PROMOTE FIRST BOOK ENTITIES
// When Book 1 in a world completes extraction, promote all main characters
// and significant locations to the world roster automatically.
// ============================================================================

export async function autoPromoteFirstBookEntities(params: {
  storyId: string;
  worldId: string;
}): Promise<void> {
  const { storyId, worldId } = params;

  console.log("🌍 [auto-promote] Promoting Book 1 entities to world...");

  // Promote characters
  const storyChars = await db
    .select({
      characterId: storyCharacters.characterId,
      role: storyCharacters.role,
    })
    .from(storyCharacters)
    .where(eq(storyCharacters.storyId, storyId));

  for (const sc of storyChars) {
    // Only promote main and supporting characters
    if (sc.role !== "main" && sc.role !== "supporting") continue;

    try {
      await db.insert(worldCharacters).values({
        id: uuid(),
        worldId,
        characterId: sc.characterId,
        isRecurring: sc.role === "main",
        firstAppearanceStoryId: storyId,
        sortOrder: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    } catch {
      // Already exists — skip
    }
  }

  // Promote locations
  const storyLocs = await db
    .select({ locationId: storyLocations.locationId })
    .from(storyLocations)
    .where(eq(storyLocations.storyId, storyId));

  for (const sl of storyLocs) {
    try {
      await db.insert(worldLocations).values({
        id: uuid(),
        worldId,
        locationId: sl.locationId,
        isRecurring: true,
        firstAppearanceStoryId: storyId,
        sortOrder: 0,
        createdAt: new Date(),
      });
    } catch {
      // Already exists — skip
    }
  }

  console.log(
    `✅ [auto-promote] Promoted ${storyChars.length} characters and ${storyLocs.length} locations`
  );
}