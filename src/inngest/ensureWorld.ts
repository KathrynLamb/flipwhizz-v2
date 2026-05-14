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
import { eq, asc, and, inArray, sql } from "drizzle-orm";
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
  const json =
    first !== -1 && last !== -1 ? text.slice(first, last + 1) : text;
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
    retries: 2,
    triggers: [{ event: "story/ensure-world" }],
  },
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

      let progress = await db.query.storyWorkflowProgress.findFirst({
        where: eq(storyWorkflowProgress.storyId, storyId),
      });

      if (!progress) {
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

      return {
        story,
        project,
        pages,
        progress: progress!,
        worldId: story.worldId ?? null,
        bookNumber: story.bookNumber ?? null,
      };
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
    -------------------------------------------------- */
    if (!context.progress.charactersExtracted) {
      await step.run("extract-characters", async () => {
        const storyText = context.pages
          .map((p) => `PAGE ${p.pageNumber}: ${p.text}`)
          .join("\n");

        if (context.worldId) {
          await extractCharactersWorldAware({
            storyId,
            worldId: context.worldId,
            userId: context.project.userId!,
            storyText,
          });
        } else {
          console.log("👥 Extracting characters (standalone)...");

          const res = await client.messages.create({
            model: MODEL,
            max_tokens: 2000,
            // ── CHANGE: added personalityTraits field ──
            system: `Extract ALL characters from this story. Return ONLY this JSON:
{
  "characters": [
    {
      "name": "Character Name",
      "species": "human",
      "breed": null,
      "description": "personality, traits, behavior",
      "appearance": "detailed physical description for illustration",
      "role": "main/supporting/minor",
      "personalityTraits": "3-5 comma-separated single-word traits derived from how the character behaves in the story. E.g. 'curious, gentle, brave'. Omit (null) if insufficient story evidence."
    }
  ]
}

- Set "species" to one of: "human", "dog", "cat", "rabbit", "horse", "bird", "fantasy", "other"
- For animals, set "breed" to the best guess (e.g. "Border Collie mix", "Golden Retriever", "Tabby cat")
- For animals, the "appearance" field should LEAD with species, breed, and coat colour
- For humans, set species to "human" and breed to null
- Be specific: age, hair color/style, eye color, skin tone, body type, distinctive features
- DO NOT include clothing in appearance`,
            messages: [{ role: "user", content: storyText }],
          });

          const data = extractJson(extractClaudeText(res.content));

          await db.transaction(async (tx) => {
            await tx
              .delete(storyCharacters)
              .where(eq(storyCharacters.storyId, storyId));

            for (const c of data.characters ?? []) {
              if (!c?.name) continue;

              const characterId = uuid();

              await tx.insert(characters).values({
                id: characterId,
                userId: context.project.userId!,
                name: cap(c.name, 80)!,
                species: c.species || "human",
                breed: cap(c.breed, 100),
                description: cap(c.description, 500),
                appearance: cap(c.appearance, 500),
                // ── CHANGE: persist personalityTraits ──
                personalityTraits: cap(c.personalityTraits, 200),
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

            console.log(
              `✅ Created ${data.characters?.length || 0} characters`
            );
          });
        }

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
          await extractLocationsWorldAware({
            storyId,
            worldId: context.worldId,
            userId: context.project.userId!,
            storyText,
          });
        } else {
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

Focus on visual details: architecture, natural features, atmosphere, colors, lighting.`,
            messages: [{ role: "user", content: storyText }],
          });

          const data = extractJson(extractClaudeText(res.content));

          await db.transaction(async (tx) => {
            await tx
              .delete(storyLocations)
              .where(eq(storyLocations.storyId, storyId));

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

            console.log(
              `✅ Created ${data.locations?.length || 0} locations`
            );
          });
        }

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
    "typography": "Describe the ideal text style for this book",
    "negativePrompt": "what to avoid (modern elements, photorealism, etc.)"
  }
}`,
          messages: [{ role: "user", content: storyText }],
        });

        const data = extractJson(extractClaudeText(res.content));

        await db.transaction(async (tx) => {
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

        if (
          context.worldId &&
          (!context.bookNumber || context.bookNumber === 1)
        ) {
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
- Each spread should show ONE key moment/scene
- Describe scenes visually (not just repeating text)
- Consider visual variety and pacing`,
          messages: [{ role: "user", content: text }],
        });

        const data = extractJson(extractClaudeText(res.content));

        await db.transaction(async (tx) => {
          await tx
            .delete(storySpreads)
            .where(eq(storySpreads.storyId, storyId));

          let spreadIndex = 1;
          for (const s of data.spreads ?? []) {
            if (!s.pageNumbers || s.pageNumbers.length === 0) continue;

            const leftPageNum = s.pageNumbers[0];
            const rightPageNum = s.pageNumbers[1] || null;

            const leftPage = context.pages.find(
              (p) => p.pageNumber === leftPageNum
            );
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

        // ── SAFEGUARD: verify page IDs were actually linked ──
        const nullSpreads = await db
          .select({ spreadIndex: storySpreads.spreadIndex })
          .from(storySpreads)
          .where(
            and(
              eq(storySpreads.storyId, storyId),
              sql`${storySpreads.leftPageId} IS NULL`
            )
          );

        if (nullSpreads.length > 0) {
          throw new Error(
            `Spread build failed: ${nullSpreads.length} spread(s) have null leftPageId ` +
              `(indices: ${nullSpreads.map((s) => s.spreadIndex).join(", ")}). ` +
              `Claude may have returned page numbers that don't match the actual page records.`
          );
        }

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

        const allCharacters = await db.query.storyCharacters.findMany({
          where: eq(storyCharacters.storyId, storyId),
          with: { character: true },
        });

        const allSpreads = await db.query.storySpreads.findMany({
          where: eq(storySpreads.storyId, storyId),
        });

        if (allCharacters.length === 0 || allSpreads.length === 0) {
          console.log("⚠️ No characters or spreads found, skipping assignment");
          await db
            .update(storyWorkflowProgress)
            .set({
              charactersAssigned: true,
              charactersAssignedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(storyWorkflowProgress.storyId, storyId));
          return;
        }

        const characterList = allCharacters
          .map((sc) => `- ${sc.character.name}: ${sc.character.description}`)
          .join("\n");

        const spreadList = allSpreads
          .map((s) => {
            const pages = [s.leftPageId, s.rightPageId]
              .filter(Boolean)
              .map(
                (pageId) =>
                  context.pages.find((p) => p.id === pageId)?.pageNumber
              )
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

Only include characters that should visually appear in each spread's illustration.`,
          messages: [
            {
              role: "user",
              content: `CHARACTERS:\n${characterList}\n\nSPREADS:\n${spreadList}`,
            },
          ],
        });

        const data = extractJson(extractClaudeText(res.content));

        await db.transaction(async (tx) => {
          await tx
            .delete(storyPageCharacters)
            .where(eq(storyPageCharacters.storyId, storyId));

          for (const assignment of data.assignments ?? []) {
            const spread = allSpreads.find(
              (s) => s.spreadIndex === assignment.spreadIndex
            );
            if (!spread) continue;

            const spreadPageIds = [
              spread.leftPageId,
              spread.rightPageId,
            ].filter(Boolean);
            const spreadPages = context.pages.filter((p) =>
              spreadPageIds.includes(p.id)
            );

            for (const characterName of assignment.characterNames ?? []) {
              const storyChar = allCharacters.find(
                (sc) =>
                  sc.character.name.toLowerCase() ===
                  characterName.toLowerCase()
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

        // ── SAFEGUARD: verify rows were actually written ──
        const [countResult] = await db
          .select({ assignedCount: sql<number>`count(*)` })
          .from(storyPageCharacters)
          .where(eq(storyPageCharacters.storyId, storyId));

        const assignedCount = Number(countResult?.assignedCount ?? 0);

        if (assignedCount === 0) {
          throw new Error(
            `Character assignment wrote 0 rows for story ${storyId}. ` +
              `Claude may have returned no assignments or character names did not match.`
          );
        }

        console.log(`✅ Verified ${assignedCount} character-page assignments written`);

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

        const allLocations = await db.query.storyLocations.findMany({
          where: eq(storyLocations.storyId, storyId),
          with: { location: true },
        });

        const allSpreads = await db.query.storySpreads.findMany({
          where: eq(storySpreads.storyId, storyId),
        });

        if (allLocations.length === 0 || allSpreads.length === 0) {
          console.log("⚠️ No locations or spreads found, skipping assignment");
          await db
            .update(storyWorkflowProgress)
            .set({
              locationsAssigned: true,
              locationsAssignedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(storyWorkflowProgress.storyId, storyId));
          return;
        }

        const locationList = allLocations
          .map((sl) => `- ${sl.location.name}: ${sl.location.description}`)
          .join("\n");

        const spreadList = allSpreads
          .map((s) => {
            const pages = [s.leftPageId, s.rightPageId]
              .filter(Boolean)
              .map(
                (pageId) =>
                  context.pages.find((p) => p.id === pageId)?.pageNumber
              )
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

        await db.transaction(async (tx) => {
          await tx
            .delete(storyPageLocations)
            .where(eq(storyPageLocations.storyId, storyId));

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

            const spreadPageIds = [
              spread.leftPageId,
              spread.rightPageId,
            ].filter(Boolean);
            const spreadPages = context.pages.filter((p) =>
              spreadPageIds.includes(p.id)
            );

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

        // ── SAFEGUARD: verify rows were actually written ──
        const [countResult] = await db
          .select({ locationCount: sql<number>`count(*)` })
          .from(storyPageLocations)
          .where(eq(storyPageLocations.storyId, storyId));

        const locationCount = Number(countResult?.locationCount ?? 0);

        if (locationCount === 0) {
          throw new Error(
            `Location assignment wrote 0 rows for story ${storyId}. ` +
              `Claude may have returned no assignments or location names did not match.`
          );
        }

        console.log(`✅ Verified ${locationCount} location-page assignments written`);

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
       STEP 7: Extract Outfit Types (if not done)
    -------------------------------------------------- */
    if (!context.progress.outfitsExtracted) {
      await step.run("extract-outfit-types", async () => {
        console.log("👗 Extracting character outfit types...");

        const allCharacters = await db.query.storyCharacters.findMany({
          where: eq(storyCharacters.storyId, storyId),
          with: { character: true },
        });

        if (allCharacters.length === 0) {
          console.log("⚠️ No characters found, skipping outfit extraction");
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
          .map(
            (sc) =>
              `- ${sc.character.name}: ${sc.character.appearance || sc.character.description || "No description"}`
          )
          .join("\n");

        const res = await client.messages.create({
          model: MODEL,
          max_tokens: 4000,
          system: `Analyze this children's story and identify all DISTINCT OUTFITS each character would need throughout the story.

Return ONLY this JSON:
{
  "characterOutfits": [
    {
      "characterName": "Sophia",
      "outfits": [
        {
          "key": "default",
          "description": "Detailed outfit description 30-50 words",
          "triggers": "when this outfit is worn"
        }
      ]
    }
  ]
}

Rules:
1. Be EXTREMELY specific about colors, patterns, materials, and small details
2. Every character MUST have at least a "default" outfit
3. Keep descriptions between 30-50 words
4. DO NOT include clothing in appearance — outfit descriptions are separate`,
          messages: [
            {
              role: "user",
              content: `CHARACTERS:\n${characterDescriptions}\n\nFULL STORY:\n${storyText}`,
            },
          ],
        });

        const data = extractJson(extractClaudeText(res.content));

        await db.transaction(async (tx) => {
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
            if (!storyChar) continue;

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

          console.log(
            `✅ Created ${totalOutfits} outfit definitions for ${data.characterOutfits?.length || 0} characters`
          );
        });

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
       STEP 8: Assign Outfits to Spreads (if not done)
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
          console.log(
            "⚠️ No spreads or outfit types found, marking outfits assigned"
          );
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
              .map(
                (id) =>
                  allCharacters.find((sc) => sc.characterId === id)?.character
                    .name
              )
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
5. Use EXACT characterName and EXACT outfitKey from the provided data`,
            messages: [
              {
                role: "user",
                content: `CHARACTERS AND THEIR AVAILABLE OUTFITS:\n${JSON.stringify(
                  outfitOptions,
                  null,
                  2
                )}\n\nSPREADS TO ASSIGN:\n${JSON.stringify(
                  spreadContext,
                  null,
                  2
                )}`,
              },
            ],
          });

          const rawText = extractClaudeText(res.content);
          const data = extractJson(rawText);
          parsedAssignments = data.assignments ?? [];
          console.log(
            `👔 Parsed ${parsedAssignments.length} outfit assignments`
          );
        } catch (err) {
          console.error(
            "❌ Outfit assignment model/parse failed, falling back:",
            err
          );

          parsedAssignments = spreadContext.map((spread) => ({
            spreadIndex: spread.spreadIndex,
            characters: (spread.characterNames ?? [])
              .map((characterName) => {
                const option = outfitOptions.find(
                  (o) => o.characterName === characterName
                );
                return {
                  characterName,
                  outfitKey: option?.outfits?.[0]?.key ?? null,
                };
              })
              .filter((c) => c.outfitKey),
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
            const spread = allSpreads.find(
              (s) => s.spreadIndex === assignment.spreadIndex
            );
            if (!spread) continue;

            for (const charAssign of assignment.characters ?? []) {
              const storyChar = allCharacters.find(
                (sc) =>
                  sc.character.name.toLowerCase() ===
                  charAssign.characterName?.toLowerCase()
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

      await db
        .update(stories)
        .set({ status: "ready", updatedAt: new Date() })
        .where(eq(stories.id, storyId));

      console.log(
        "✅ [ensure-world] Complete! World is ready for illustrations."
      );
    });

    /* --------------------------------------------------
       STEP 10: Trigger decide-scenes
    -------------------------------------------------- */
    await step.run("trigger-decide-scenes", async () => {
      console.log("🎬 Triggering decide-spread-scenes...");
      await inngest.send({
        name: "story/decide-spread-scenes",
        data: { storyId },
      });
    });

    return { ok: true, worldComplete: true };
  }
);