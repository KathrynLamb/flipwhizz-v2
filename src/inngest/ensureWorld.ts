// src/inngest/ensureWorld.ts
import { inngest } from "@/inngest/client";
import { db } from "@/db";
import {
  stories,
  storyPages,
  characters,
  storyCharacters,
  locations,
  storyLocations,
  storyStyleGuide,
  storyWorkflowProgress,
  storySpreads,
  storyPageCharacters,
  storyPageLocations,
  characterStoryOutfits,
  spreadCharacterOutfits,
  projects,
} from "@/db/schema";
import { worlds } from "@/db/schema-worlds";
import { eq, asc, and, inArray } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import Anthropic from "@anthropic-ai/sdk";
import {
  extractCharactersWorldAware,
  extractLocationsWorldAware,
  autoPromoteFirstBookEntities,
} from "@/inngest/worldAwareExtraction";

export const runtime = "nodejs";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

const MODEL = "claude-sonnet-4-20250514";

/* ============================================================================
   UTILITY FUNCTIONS
============================================================================ */

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
    .map((b) => (b?.type === "text" ? String(b.text ?? "") : ""))
    .join("\n")
    .trim();
}

const cap = (v: unknown, max: number) =>
  typeof v === "string" ? v.trim().slice(0, max) : null;

const jsonOrNull = (v: unknown) => (v && typeof v === "object" ? v : null);

/* ============================================================================
   MAIN ORCHESTRATOR FUNCTION
============================================================================ */

export const ensureWorld = inngest.createFunction(
  {
    id: "ensure-world",
    retries: 2, triggers: [{ event: "story/ensure-world" }] },
  async ({ event, step }) => {
    const { storyId } = event.data as { storyId: string };

    console.log("🌍 [ensure-world] Starting orchestration for story:", storyId);

    /* --------------------------------------------------
       STEP 0: Load story data and check progress
    -------------------------------------------------- */
    const context = await step.run("load-context", async () => {
      const story = await db.query.stories.findFirst({
        where: eq(stories.id, storyId),
      });
      if (!story) throw new Error("Story not found");

      const project = await db.query.projects.findFirst({
        where: eq(projects.id, story.projectId),
      });
      if (!project?.userId) throw new Error("Missing user");

      const pages = await db.query.storyPages.findMany({
        where: eq(storyPages.storyId, storyId),
        orderBy: asc(storyPages.pageNumber),
      });

      // Get or create progress tracker
      let progress = await db.query.storyWorkflowProgress.findFirst({
        where: eq(storyWorkflowProgress.storyId, storyId),
      });

      if (!progress) {
        // Create initial progress record
        await db.insert(storyWorkflowProgress).values({
          storyId,
          charactersExtracted: false,
          locationsExtracted: false,
          styleExtracted: false,
          spreadsBuilt: false,
          charactersAssigned: false,
          locationsAssigned: false,
          outfitsExtracted: false,
          outfitsAssigned: false,
          worldComplete: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        progress = await db.query.storyWorkflowProgress.findFirst({
          where: eq(storyWorkflowProgress.storyId, storyId),
        });
      }

      return { story, project, pages, progress: progress!, worldId: story.worldId ?? null,   bookNumber: story.bookNumber ?? null };
    });

    console.log("📊 Current progress:", {
      charactersExtracted: context.progress.charactersExtracted,
      locationsExtracted: context.progress.locationsExtracted,
      styleExtracted: context.progress.styleExtracted,
      spreadsBuilt: context.progress.spreadsBuilt,
      charactersAssigned: context.progress.charactersAssigned,
      locationsAssigned: context.progress.locationsAssigned,
      outfitsExtracted: context.progress.outfitsExtracted,
      outfitsAssigned: context.progress.outfitsAssigned,
    });

    /* --------------------------------------------------
       STEP 1: Extract Characters (if not done)
/* --------------------------------------------------
   STEP 1: Extract Characters (if not done)
-------------------------------------------------- */
if (!context.progress.charactersExtracted) {
  await step.run("extract-characters", async () => {
    const storyText = context.pages
      .map((p) => `PAGE ${p.pageNumber}: ${p.text}`)
      .join("\n");

    if (context.worldId) {
      // WORLD-AWARE: match against existing roster
      await extractCharactersWorldAware({
        storyId,
        worldId: context.worldId,
        userId: context.project.userId!,
        storyText,
      });
    } else {
      // STANDALONE: original extraction logic
      console.log("👥 Extracting characters (standalone)...");

      const res = await client.messages.create({
        model: MODEL,
        max_tokens: 2000,
        system: `Extract ALL characters from this story. Return ONLY this JSON:
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

Include:
- Main characters (protagonists, important figures)
- Supporting characters (friends, family, helpers)
- Minor characters (briefly mentioned)

   - Set "species" to one of: "human", "dog", "cat", "rabbit", "horse", "bird", "fantasy", "other"
   - For animals, set "breed" to the best guess (e.g. "Border Collie mix", "Golden Retriever", "Tabby cat")
   - For animals, the "appearance" field should LEAD with species, breed, and coat colour: "Black Border Collie mix dog, medium-sized, alert posture..." NOT "medium-sized, alert posture, black coat..."
   - For humans, set species to "human" and breed to null


For appearance, be specific: age, hair color/style, eye color, skin tone, body type, distinctive features.
DO NOT include clothing in appearance - that will be handled separately per scene.`,
        messages: [{ role: "user", content: storyText }],
      });

      const data = extractJson(extractClaudeText(res.content));

      await db.transaction(async (tx) => {
        // Clear existing story ↔ character links
        await tx
          .delete(storyCharacters)
          .where(eq(storyCharacters.storyId, storyId));

        // Insert newly extracted characters
        for (const c of data.characters ?? []) {
          if (!c?.name) continue;

          const characterId = uuid();

          await tx.insert(characters).values({
            id: characterId,
            userId: context.project.userId!,
            name: cap(c.name, 80)!,
            species: c.species || "human",        // ADD
            breed: cap(c.breed, 100),   
            description: cap(c.description, 500),
            appearance: cap(c.appearance, 500),
            createdAt: new Date(),
            updatedAt: new Date(),
          });

          await tx.insert(storyCharacters).values({
            storyId,
            characterId,
            role: cap(c.role, 40),
            arcSummary: null,
          });
        }

        console.log(`✅ Created ${data.characters?.length || 0} characters`);
      });
    }

    // Mark progress
    await db
      .update(storyWorkflowProgress)
      .set({
        charactersExtracted: true,
        charactersExtractedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(storyWorkflowProgress.storyId, storyId));
  });
} else {
  console.log("✓ Characters already extracted, skipping");
}

/* --------------------------------------------------
   STEP 2: Extract Locations (if not done)
-------------------------------------------------- */
if (!context.progress.locationsExtracted) {
  await step.run("extract-locations", async () => {
    const storyText = context.pages
      .map((p) => `PAGE ${p.pageNumber}: ${p.text}`)
      .join("\n");

    if (context.worldId) {
      // WORLD-AWARE: match against existing roster
      await extractLocationsWorldAware({
        storyId,
        worldId: context.worldId,
        userId: context.project.userId!,
        storyText,
      });
    } else {
      // STANDALONE: original extraction logic
      console.log("🗺️ Extracting locations (standalone)...");

      const res = await client.messages.create({
        model: MODEL,
        max_tokens: 1500,
        system: `Extract ALL locations/settings from this story. Return ONLY this JSON:
{
  "locations": [
    {
      "name": "Location Name",
      "description": "detailed visual description for illustration"
    }
  ]
}

Include:
- Major settings (home, school, forest, castle, etc.)
- Minor settings (rooms, specific places briefly mentioned)

For description, focus on visual details: architecture, natural features, atmosphere, colors, lighting, etc.`,
        messages: [{ role: "user", content: storyText }],
      });

      const data = extractJson(extractClaudeText(res.content));

      await db.transaction(async (tx) => {
        // Clear existing story ↔ location links
        await tx
          .delete(storyLocations)
          .where(eq(storyLocations.storyId, storyId));

        // Insert new locations
        for (const l of data.locations ?? []) {
          if (!l?.name) continue;

          const locationId = uuid();

          await tx.insert(locations).values({
            id: locationId,
            userId: context.project.userId!,
            name: cap(l.name, 80)!,
            description: cap(l.description, 500),
            createdAt: new Date(),
            updatedAt: new Date(),
          });

          await tx.insert(storyLocations).values({
            storyId,
            locationId,
            significance: null,
          });
        }

        console.log(`✅ Created ${data.locations?.length || 0} locations`);
      });
    }

    // Mark progress
    await db
      .update(storyWorkflowProgress)
      .set({
        locationsExtracted: true,
        locationsExtractedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(storyWorkflowProgress.storyId, storyId));
  });
} else {
  console.log("✓ Locations already extracted, skipping");
}
  /* --------------------------------------------------
   STEP 3: Extract Style Guide (if not done)
-------------------------------------------------- */
if (!context.progress.styleExtracted) {
  await step.run("extract-style", async () => {
    const storyText = context.pages
      .map((p) => `PAGE ${p.pageNumber}: ${p.text}`)
      .join("\n");

    /* ───────── 1. Try WORLD STYLE REUSE ───────── */

    if (context.worldId && context.bookNumber && context.bookNumber > 1) {
      console.log("🎨 Attempting to reuse world style guide...");

      const worldRecord = await db
        .select({ styleGuideId: worlds.styleGuideId })
        .from(worlds)
        .where(eq(worlds.id, context.worldId))
        .limit(1)
        .then((rows) => rows[0]);

      if (worldRecord?.styleGuideId) {
        const worldStyle = await db.query.storyStyleGuide.findFirst({
          where: eq(storyStyleGuide.id, worldRecord.styleGuideId),
        });

        if (worldStyle) {
          // Clear any existing style for this story first
          await db
            .delete(storyStyleGuide)
            .where(eq(storyStyleGuide.storyId, storyId));

          await db.insert(storyStyleGuide).values({
            id: uuid(),
            storyId,
            summary: worldStyle.summary,
            negativePrompt: worldStyle.negativePrompt,
            artStyle: worldStyle.artStyle,
            visualThemes: worldStyle.visualThemes,
            colorPalette: worldStyle.colorPalette,
            typography: worldStyle.typography,
            sampleIllustrationUrl: worldStyle.sampleIllustrationUrl,
            createdAt: new Date(),
            updatedAt: new Date(),
          });

          console.log("🎨 Reused world style guide for series continuity");

          // Mark progress + EXIT EARLY
          await db
            .update(storyWorkflowProgress)
            .set({
              styleExtracted: true,
              styleExtractedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(storyWorkflowProgress.storyId, storyId));

          return;
        }
      }

      console.log("⚠️ No reusable world style found, generating new...");
    }

    /* ───────── 2. GENERATE NEW STYLE ───────── */

    console.log("🎨 Extracting style guide...");

    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 1500,
      system: `Analyze this story and create a visual style guide for illustrations. Return ONLY this JSON:
{
  "style": {
    "summary": "one-sentence overall style description",
    "artStyle": "medium and technique (watercolor, digital, pencil, etc.)",
    "visualThemes": "mood, atmosphere, artistic approach",
    "colorPalette": {
      "primary": ["color1", "color2"],
      "secondary": ["color3", "color4"],
      "accent": ["color5"]
    },
    "typography": "Describe the ideal text style for this book: the narrative font feel, and how expressive moments (sound effects, shouts, whispers) should differ.",
    "negativePrompt": "what to avoid (modern elements, photorealism, etc.)"
  }
}

Consider:
- Story tone
- Target age group
- Setting time period
- Emotional feel`,
      messages: [{ role: "user", content: storyText }],
    });

    const data = extractJson(extractClaudeText(res.content));

    await db.transaction(async (tx) => {
      // Clear existing
      await tx
        .delete(storyStyleGuide)
        .where(eq(storyStyleGuide.storyId, storyId));

      await tx.insert(storyStyleGuide).values({
        id: uuid(),
        storyId,
        summary: cap(data.style?.summary, 100),
        negativePrompt: cap(data.style?.negativePrompt, 200),
        artStyle: cap(data.style?.artStyle, 100),
        visualThemes: cap(data.style?.visualThemes, 200),
        typography: cap(data.style?.typography, 200),
        colorPalette: jsonOrNull(data.style?.colorPalette),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      console.log("✅ Style guide generated");
    });

    /* ───────── 3. OPTIONAL: SAVE TO WORLD (Book 1) ───────── */

    if (context.worldId && (!context.bookNumber || context.bookNumber === 1)) {
      console.log("🌍 Saving style guide to world for reuse...");

      const storyStyle = await db.query.storyStyleGuide.findFirst({
        where: eq(storyStyleGuide.storyId, storyId),
      });

      if (storyStyle) {
        await db
          .update(worlds)
          .set({ styleGuideId: storyStyle.id })
          .where(eq(worlds.id, context.worldId));
      }
    }

    /* ───────── 4. Mark progress ───────── */

    await db
      .update(storyWorkflowProgress)
      .set({
        styleExtracted: true,
        styleExtractedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(storyWorkflowProgress.storyId, storyId));
  });
} else {
  console.log("✓ Style already extracted, skipping");
}
    /* --------------------------------------------------
       STEP 4: Build Spreads (if not done)
    -------------------------------------------------- */
    if (!context.progress.spreadsBuilt) {
      await step.run("build-spreads", async () => {
        console.log("📖 Building spreads...");

        const text = context.pages
          .map((p) => `PAGE ${p.pageNumber}: ${p.text}`)
          .join("\n");

        const res = await client.messages.create({
          model: MODEL,
          max_tokens: 2500,
          system: `Create illustration spreads for this children's book. Return ONLY this JSON:
{
  "spreads": [
    {
      "pageNumbers": [1, 2],
      "sceneDescription": "what to illustrate",
      "visualFocus": "main visual element or action",
      "mood": "emotional tone"
    }
  ]
}

Rules:
- Combine facing pages (1-2, 3-4, 5-6, etc.)
- Cover and title pages get their own spreads
- Each spread should show ONE key moment/scene
- Describe scenes visually (not just repeating text)
- Consider visual variety and pacing`,
          messages: [{ role: "user", content: text }],
        });

        const data = extractJson(extractClaudeText(res.content));

        // Save spreads
        await db.transaction(async (tx) => {
          // Clear existing
          await tx.delete(storySpreads).where(eq(storySpreads.storyId, storyId));

          // Insert new spreads
          let spreadIndex = 1;
          for (const s of data.spreads ?? []) {
            if (!s.pageNumbers || s.pageNumbers.length === 0) continue;

            // Find the actual page IDs from the context
            const leftPageNum = s.pageNumbers[0];
            const rightPageNum = s.pageNumbers[1] || null;

            const leftPage = context.pages.find((p) => p.pageNumber === leftPageNum);
            const rightPage = rightPageNum
              ? context.pages.find((p) => p.pageNumber === rightPageNum)
              : null;

            await tx.insert(storySpreads).values({
              id: uuid(),
              storyId,
              spreadIndex: spreadIndex++,
              sceneSummary: cap(s.sceneDescription, 500),
              leftPageId: leftPage?.id || null,
              rightPageId: rightPage?.id || null,
              createdAt: new Date(),
            });
          }

          console.log(`✅ Created ${data.spreads?.length || 0} spreads`);
        });

        // Mark progress
        await db
          .update(storyWorkflowProgress)
          .set({
            spreadsBuilt: true,
            spreadsBuiltAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(storyWorkflowProgress.storyId, storyId));
      });
    } else {
      console.log("✓ Spreads already built, skipping");
    }

    /* --------------------------------------------------
       STEP 5: Assign Characters to Pages (if not done)
    -------------------------------------------------- */
    if (!context.progress.charactersAssigned) {
      await step.run("assign-characters", async () => {
        console.log("👤 Assigning characters to pages...");

        // Get all characters and spreads
        const allCharacters = await db.query.storyCharacters.findMany({
          where: eq(storyCharacters.storyId, storyId),
          with: { character: true },
        });

        const allSpreads = await db.query.storySpreads.findMany({
          where: eq(storySpreads.storyId, storyId),
        });

        if (allCharacters.length === 0 || allSpreads.length === 0) {
          console.log("⚠️  No characters or spreads found, skipping assignment");
          return;
        }

        // Build prompt with characters and spreads
        const characterList = allCharacters
          .map((sc) => `- ${sc.character.name}: ${sc.character.description}`)
          .join("\n");

        const spreadList = allSpreads
          .map((s) => {
            const pages = [s.leftPageId, s.rightPageId]
              .filter(Boolean)
              .map((pageId) => context.pages.find((p) => p.id === pageId)?.pageNumber)
              .filter(Boolean)
              .join(", ");
            return `Spread ${s.spreadIndex} (pages ${pages}): ${s.sceneSummary || ""}`;
          })
          .join("\n");

        const res = await client.messages.create({
          model: MODEL,
          max_tokens: 2000,
          system: `Assign characters to illustration spreads. Return ONLY this JSON:
{
  "assignments": [
    {
      "spreadIndex": 1,
      "characterNames": ["Character A", "Character B"]
    }
  ]
}

Only include characters that should appear in each spread's illustration.`,
          messages: [
            {
              role: "user",
              content: `CHARACTERS:\n${characterList}\n\nSPREADS:\n${spreadList}`,
            },
          ],
        });

        const data = extractJson(extractClaudeText(res.content));

        // Save assignments
        await db.transaction(async (tx) => {
          // Clear existing
          await tx
            .delete(storyPageCharacters)
            .where(eq(storyPageCharacters.storyId, storyId));

          // Insert new assignments
          for (const assignment of data.assignments ?? []) {
            const spread = allSpreads.find(
              (s) => s.spreadIndex === assignment.spreadIndex
            );
            if (!spread) continue;

            // Find pages in this spread
            const spreadPageIds = [spread.leftPageId, spread.rightPageId].filter(Boolean);
            const spreadPages = context.pages.filter((p) =>
              spreadPageIds.includes(p.id)
            );

            // Assign each character to each page in the spread
            for (const characterName of assignment.characterNames ?? []) {
              const storyChar = allCharacters.find(
                (sc) =>
                  sc.character.name.toLowerCase() === characterName.toLowerCase()
              );
              if (!storyChar) continue;

              for (const page of spreadPages) {
                await tx.insert(storyPageCharacters).values({
                  id: uuid(),
                  storyId,
                  pageId: page.id,
                  characterId: storyChar.characterId,
                  prominence: null,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                });
              }
            }
          }

          console.log(`✅ Assigned characters to spreads`);
        });

        // Mark progress
        await db
          .update(storyWorkflowProgress)
          .set({
            charactersAssigned: true,
            charactersAssignedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(storyWorkflowProgress.storyId, storyId));
      });
    } else {
      console.log("✓ Characters already assigned, skipping");
    }

    /* --------------------------------------------------
       STEP 6: Assign Locations to Pages (if not done)
    -------------------------------------------------- */
    if (!context.progress.locationsAssigned) {
      await step.run("assign-locations", async () => {
        console.log("📍 Assigning locations to pages...");

        // Get all locations and spreads
        const allLocations = await db.query.storyLocations.findMany({
          where: eq(storyLocations.storyId, storyId),
          with: { location: true },
        });

        const allSpreads = await db.query.storySpreads.findMany({
          where: eq(storySpreads.storyId, storyId),
        });

        if (allLocations.length === 0 || allSpreads.length === 0) {
          console.log("⚠️  No locations or spreads found, skipping assignment");
          return;
        }

        // Build prompt
        const locationList = allLocations
          .map((sl) => `- ${sl.location.name}: ${sl.location.description}`)
          .join("\n");

        const spreadList = allSpreads
          .map((s) => {
            const pages = [s.leftPageId, s.rightPageId]
              .filter(Boolean)
              .map((pageId) => context.pages.find((p) => p.id === pageId)?.pageNumber)
              .filter(Boolean)
              .join(", ");
            return `Spread ${s.spreadIndex} (pages ${pages}): ${s.sceneSummary || ""}`;
          })
          .join("\n");

        const res = await client.messages.create({
          model: MODEL,
          max_tokens: 2000,
          system: `Assign locations to illustration spreads. Return ONLY this JSON:
{
  "assignments": [
    {
      "spreadIndex": 1,
      "locationName": "Location Name"
    }
  ]
}

Each spread should have ONE primary location where the scene takes place.`,
          messages: [
            {
              role: "user",
              content: `LOCATIONS:\n${locationList}\n\nSPREADS:\n${spreadList}`,
            },
          ],
        });

        const data = extractJson(extractClaudeText(res.content));

        // Save assignments
        await db.transaction(async (tx) => {
          // Clear existing
          await tx
            .delete(storyPageLocations)
            .where(eq(storyPageLocations.storyId, storyId));

          // Insert new assignments
          for (const assignment of data.assignments ?? []) {
            const spread = allSpreads.find(
              (s) => s.spreadIndex === assignment.spreadIndex
            );
            if (!spread) continue;

            const storyLoc = allLocations.find(
              (sl) =>
                sl.location.name.toLowerCase() ===
                assignment.locationName?.toLowerCase()
            );
            if (!storyLoc) continue;

            // Find pages in this spread
            const spreadPageIds = [spread.leftPageId, spread.rightPageId].filter(Boolean);
            const spreadPages = context.pages.filter((p) =>
              spreadPageIds.includes(p.id)
            );

            // Assign location to each page in the spread
            for (const page of spreadPages) {
              await tx.insert(storyPageLocations).values({
                id: uuid(),
                storyId,
                pageId: page.id,
                locationId: storyLoc.locationId,
                createdAt: new Date(),
                updatedAt: new Date(),
              });
            }
          }

          console.log(`✅ Assigned locations to spreads`);
        });

        // Mark progress
        await db
          .update(storyWorkflowProgress)
          .set({
            locationsAssigned: true,
            locationsAssignedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(storyWorkflowProgress.storyId, storyId));
      });
    } else {
      console.log("✓ Locations already assigned, skipping");
    }

    /* --------------------------------------------------
       STEP 7: Extract Outfit Types (NEW)
    -------------------------------------------------- */
    if (!context.progress.outfitsExtracted) {
      await step.run("extract-outfit-types", async () => {
        console.log("👗 Extracting character outfit types...");

        const allCharacters = await db.query.storyCharacters.findMany({
          where: eq(storyCharacters.storyId, storyId),
          with: { character: true },
        });

        if (allCharacters.length === 0) {
          console.log("⚠️  No characters found, skipping outfit extraction");
          await db
            .update(storyWorkflowProgress)
            .set({
              outfitsExtracted: true,
              outfitsExtractedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(storyWorkflowProgress.storyId, storyId));
          return;
        }

        const storyText = context.pages
          .map((p) => `PAGE ${p.pageNumber}: ${p.text}`)
          .join("\n");

        const characterDescriptions = allCharacters
          .map((sc) => `- ${sc.character.name}: ${sc.character.appearance || sc.character.description || "No description"}`)
          .join("\n");

        const res = await client.messages.create({
          model: MODEL,
          max_tokens: 4000,
          system: `Analyze this children's story and identify all DISTINCT OUTFITS each character would need throughout the story.

Characters change clothes when:
- Weather/environment changes (indoor → outdoor, warm → cold)
- Activity changes (swimming, sleeping, formal events, sports)
- Time passes significantly (next day, next morning)
- Scene context demands it (bath time, bedtime, beach, skiing)

For each character, define SPECIFIC, CONSISTENT outfit descriptions that will be reused across multiple scenes.

Return ONLY this JSON:
{
  "characterOutfits": [
    {
      "characterName": "Sophia",
      "outfits": [
        {
          "key": "ski_gear",
          "description": "Bright turquoise zip-up ski jacket with white zipper and trim, matching turquoise snow pants, pink knit beanie with fluffy white pom-pom, white waterproof ski gloves, pink snow boots with white laces and fur trim",
          "triggers": "outdoor winter scenes, skiing, playing in snow, walking to ski lift, snowball fights"
        },
        {
          "key": "hot_tub",
          "description": "Light purple one-piece swimsuit with small white polka dots, hair pulled up in a messy bun with loose strands framing face",
          "triggers": "hot tub scene, swimming pool, water play, spa"
        },
        {
          "key": "indoor_casual",
          "description": "Soft lavender long-sleeve thermal shirt, comfortable grey jogger pants, fuzzy white slipper socks, hair down and natural",
          "triggers": "inside cabin or chalet, eating meals indoors, relaxing by fireplace, morning scenes indoors"
        },
        {
          "key": "sleepwear",
          "description": "Cozy pink flannel pajamas with tiny white stars pattern, matching pink fuzzy slippers, hair in loose side braid",
          "triggers": "bedtime, waking up, nighttime scenes, getting ready for bed"
        }
      ]
    }
  ]
}

CRITICAL RULES:
1. Be EXTREMELY specific about colors, patterns, materials, and small details
2. Each outfit must be visually DISTINCT and MEMORABLE
3. Include hair styling if it would logically change (ponytail for sports, bun for swimming, down for casual)
4. Keep descriptions between 30-50 words - detailed but concise
5. Every character MUST have at least a "default" outfit
6. Use a CONSISTENT color palette per character across all their outfits (e.g., if a character wears pink in one outfit, incorporate pink accents in others)
7. Consider age-appropriate clothing for children
8. Make outfits practical for the activity (waterproof for rain, warm for cold, etc.)`,
          messages: [
            {
              role: "user",
              content: `CHARACTERS:\n${characterDescriptions}\n\nFULL STORY:\n${storyText}`,
            },
          ],
        });

        const data = extractJson(extractClaudeText(res.content));

        // Save outfit types
        await db.transaction(async (tx) => {
          // Clear existing outfits for this story
          const characterIds = allCharacters.map((sc) => sc.characterId);
          if (characterIds.length > 0) {
            await tx
              .delete(characterStoryOutfits)
              .where(
                and(
                  eq(characterStoryOutfits.storyId, storyId),
                  inArray(characterStoryOutfits.characterId, characterIds)
                )
              );
          }

          let totalOutfits = 0;

          for (const charOutfit of data.characterOutfits ?? []) {
            const storyChar = allCharacters.find(
              (sc) =>
                sc.character.name.toLowerCase() ===
                charOutfit.characterName?.toLowerCase()
            );
            if (!storyChar) {
              console.warn(`⚠️  Character not found: ${charOutfit.characterName}`);
              continue;
            }

            for (const outfit of charOutfit.outfits ?? []) {
              if (!outfit.key || !outfit.description) continue;

              await tx.insert(characterStoryOutfits).values({
                id: uuid(),
                storyId,
                characterId: storyChar.characterId,
                outfitKey: outfit.key.toLowerCase().replace(/\s+/g, "_"),
                outfitDescription: outfit.description,
                triggerConditions: outfit.triggers || null,
                createdAt: new Date(),
              });
              totalOutfits++;
            }
          }

          console.log(`✅ Created ${totalOutfits} outfit definitions for ${data.characterOutfits?.length || 0} characters`);
        });

        // Mark progress
        await db
          .update(storyWorkflowProgress)
          .set({
            outfitsExtracted: true,
            outfitsExtractedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(storyWorkflowProgress.storyId, storyId));
      });
    } else {
      console.log("✓ Outfits already extracted, skipping");
    }

    /* --------------------------------------------------
       STEP 8: Assign Outfits to Spreads (NEW)
    -------------------------------------------------- */
    if (!context.progress.outfitsAssigned) {
      await step.run("assign-outfits-to-spreads", async () => {
        console.log("👔 Assigning outfits to spreads...");
    
        const allSpreads = await db.query.storySpreads.findMany({
          where: eq(storySpreads.storyId, storyId),
          orderBy: asc(storySpreads.spreadIndex),
        });
    
        const allCharacters = await db.query.storyCharacters.findMany({
          where: eq(storyCharacters.storyId, storyId),
          with: { character: true },
        });
    
        const outfitTypes = await db.query.characterStoryOutfits.findMany({
          where: eq(characterStoryOutfits.storyId, storyId),
        });
    
        if (allSpreads.length === 0 || outfitTypes.length === 0) {
          console.log("⚠️ No spreads or outfit types found, marking outfits assigned");
          await db
            .update(storyWorkflowProgress)
            .set({
              outfitsAssigned: true,
              outfitsAssignedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(storyWorkflowProgress.storyId, storyId));
          return;
        }
    
        const outfitsByCharacter = new Map<string, typeof outfitTypes>();
        for (const outfit of outfitTypes) {
          const existing = outfitsByCharacter.get(outfit.characterId) ?? [];
          existing.push(outfit);
          outfitsByCharacter.set(outfit.characterId, existing);
        }
    
        const pageCharacters = await db.query.storyPageCharacters.findMany({
          where: eq(storyPageCharacters.storyId, storyId),
        });
    
        const spreadContext = allSpreads.map((s) => {
          const leftPage = context.pages.find((p) => p.id === s.leftPageId);
          const rightPage = context.pages.find((p) => p.id === s.rightPageId);
    
          const spreadPageIds = [s.leftPageId, s.rightPageId].filter(Boolean);
          const charactersInSpread = pageCharacters
            .filter((pc) => spreadPageIds.includes(pc.pageId))
            .map((pc) => pc.characterId);
    
          const uniqueCharacterIds = [...new Set(charactersInSpread)];
    
          return {
            spreadIndex: s.spreadIndex,
            text: [leftPage?.text, rightPage?.text].filter(Boolean).join(" "),
            sceneSummary: s.sceneSummary,
            characterNames: uniqueCharacterIds
              .map((id) => allCharacters.find((sc) => sc.characterId === id)?.character.name)
              .filter(Boolean),
          };
        });
    
        const outfitOptions = allCharacters.map((sc) => ({
          characterName: sc.character.name,
          outfits:
            outfitsByCharacter.get(sc.characterId)?.map((o) => ({
              key: o.outfitKey,
              triggers: o.triggerConditions,
            })) ?? [],
        }));
    
        let parsedAssignments: any[] = [];
    
        try {
          const res = await client.messages.create({
            model: MODEL,
            max_tokens: 3000,
            system: `For each spread, decide which outfit each character should wear based on the scene context.
    
    Return ONLY this JSON:
    {
      "assignments": [
        {
          "spreadIndex": 1,
          "characters": [
            { "characterName": "Sophia", "outfitKey": "ski_gear" }
          ]
        }
      ]
    }
    
    Rules:
    1. Match outfit to scene context using triggers as hints
    2. Maintain continuity across consecutive spreads in the same scene
    3. Only change outfits when the story clearly suggests a change
    4. Only assign outfits to characters that appear in the spread
    5. If unsure, choose the most contextually appropriate outfit
    6. Use EXACT characterName and EXACT outfitKey from the provided data`,
            messages: [
              {
                role: "user",
                content: `CHARACTERS AND THEIR AVAILABLE OUTFITS:\n${JSON.stringify(
                  outfitOptions,
                  null,
                  2
                )}\n\nSPREADS TO ASSIGN:\n${JSON.stringify(spreadContext, null, 2)}`,
              },
            ],
          });
    
          const rawText = extractClaudeText(res.content);
          console.log("👔 [assign-outfits] Claude response:", rawText.slice(0, 3000));
    
          const data = extractJson(rawText);
          parsedAssignments = data.assignments ?? [];
          console.log("👔 [assign-outfits] Parsed assignments:", parsedAssignments.length);
        } catch (err) {
          console.error("❌ [assign-outfits] Model/parse failed, falling back", err);
    
          // Fallback: assign first available outfit for each character in each spread
          parsedAssignments = spreadContext.map((spread) => ({
            spreadIndex: spread.spreadIndex,
            characters: (spread.characterNames ?? []).map((characterName) => {
              const option = outfitOptions.find((o) => o.characterName === characterName);
              return {
                characterName,
                outfitKey: option?.outfits?.[0]?.key ?? null,
              };
            }).filter((c) => c.outfitKey),
          }));
        }
    
        await db.transaction(async (tx) => {
          const spreadIds = allSpreads.map((s) => s.id);
          if (spreadIds.length > 0) {
            await tx
              .delete(spreadCharacterOutfits)
              .where(inArray(spreadCharacterOutfits.spreadId, spreadIds));
          }
    
          let totalAssignments = 0;
    
          for (const assignment of parsedAssignments) {
            const spread = allSpreads.find((s) => s.spreadIndex === assignment.spreadIndex);
            if (!spread) continue;
    
            for (const charAssign of assignment.characters ?? []) {
              const storyChar = allCharacters.find(
                (sc) => sc.character.name.toLowerCase() === charAssign.characterName?.toLowerCase()
              );
              if (!storyChar) continue;
    
              const outfitType = outfitTypes.find(
                (o) =>
                  o.characterId === storyChar.characterId &&
                  o.outfitKey === charAssign.outfitKey
              );
    
              if (!outfitType) continue;
    
              await tx.insert(spreadCharacterOutfits).values({
                id: uuid(),
                spreadId: spread.id,
                characterId: storyChar.characterId,
                outfitKey: charAssign.outfitKey,
                outfitDescription: outfitType.outfitDescription,
                createdAt: new Date(),
              });
    
              totalAssignments++;
            }
          }
    
          console.log(`✅ Created ${totalAssignments} outfit assignments`);
        });
    
        await db
          .update(storyWorkflowProgress)
          .set({
            outfitsAssigned: true,
            outfitsAssignedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(storyWorkflowProgress.storyId, storyId));
      });
    }

    /* --------------------------------------------------
       STEP 9: Mark world as complete
    -------------------------------------------------- */
    await step.run("mark-world-complete", async () => {
      console.log("🎉 Marking world as complete...");

      // Inside the "mark-world-complete" step, BEFORE marking complete:
        if (context.worldId && context.bookNumber === 1) {
          await autoPromoteFirstBookEntities({
            storyId,
            worldId: context.worldId,
          });
        }

      await db
        .update(storyWorkflowProgress)
        .set({
          worldComplete: true,
          worldCompleteAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(storyWorkflowProgress.storyId, storyId));

      // Update story status
      await db
        .update(stories)
        .set({
          status: "ready",
          updatedAt: new Date(),
        })
        .where(eq(stories.id, storyId));

      console.log("✅ [ensure-world] Complete! World is ready for illustrations.");
    });

    /* --------------------------------------------------
       STEP 10: Trigger next workflow (if configured)
    -------------------------------------------------- */
    await step.run("trigger-next", async () => {
      console.log("🎬 World building complete. Ready for next phase.");
    });

    return { ok: true, worldComplete: true };
  }
);