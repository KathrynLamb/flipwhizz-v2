// inngest/extractWorld.ts
import { inngest } from "./client";
import { db } from "@/db";
import {
  stories,
  storyPages,
  characters,
  storyCharacters,
  locations,
  storyLocations,
  projects,
  storyStyleGuide,
  storyPageCharacters,
  storyPageLocations,
  storyWorkflowProgress,
} from "@/db/schema";
import { eq, asc, inArray } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-sonnet-4-20250514";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

const cap = (v: unknown, max: number) =>
  typeof v === "string" ? v.trim().slice(0, max) : null;

const jsonOrNull = (v: unknown) =>
  v && typeof v === "object" ? v : null;

function extractClaudeText(content: any): string {
  return (Array.isArray(content) ? content : [])
    .map((b) => (b?.type === "text" ? String(b.text ?? "") : ""))
    .join("\n")
    .trim();
}

function extractJson(raw: string) {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const text = (fenced?.[1] ?? raw).trim();

  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  const json =
    first !== -1 && last !== -1 ? text.slice(first, last + 1) : text;

  return JSON.parse(json);
}

export const extractWorldJob = inngest.createFunction(
  { 
    id: "extract-world-job", 
    retries: 2,
    concurrency: { limit: 1, key: "event.data.storyId" }
  },
  { event: "story/extract-world" },
  async ({ event, step }) => {
    const { storyId } = event.data;

    console.log("🔵 [extract-world] Starting for story:", storyId);

    /* --------------------------------------------------
       STEP 1: Check if already completed (idempotency)
    -------------------------------------------------- */

    const progress = await step.run("check-progress", async () => {
      return db.query.storyWorkflowProgress.findFirst({
        where: eq(storyWorkflowProgress.storyId, storyId),
      });
    });

    if (progress?.worldExtracted) {
      console.log("⏭️ [extract-world] Already completed, skipping");
      
      // Still trigger next phase if spreads not built
      if (!progress.spreadsBuilt) {
        await step.run("trigger-build-spreads", async () => {
          await inngest.send({
            name: "story/build-spreads",
            data: { storyId },
          });
        });
      }
      
      return { ok: true, skipped: true };
    }

    /* --------------------------------------------------
       STEP 2: Acquire lock to prevent duplicate runs
    -------------------------------------------------- */

    await step.run("acquire-lock", async () => {
      if (progress) {
        await db
          .update(storyWorkflowProgress)
          .set({ extractingWorld: true, updatedAt: new Date() })
          .where(eq(storyWorkflowProgress.storyId, storyId));
      } else {
        await db.insert(storyWorkflowProgress).values({
          storyId,
          extractingWorld: true,
        });
      }
    });

    /* --------------------------------------------------
       STEP 3: Load story data
    -------------------------------------------------- */

    const data = await step.run("load-story-data", async () => {
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

      if (pages.length === 0) throw new Error("No pages found");

      return { story, project, pages };
    });

    const text = data.pages
      .map((p) => `PAGE ${p.pageNumber}: ${p.text}`)
      .join("\n");

    /* --------------------------------------------------
       STEP 4: Call Claude to extract world
    -------------------------------------------------- */

    const world = await step.run("extract-world-from-claude", async () => {
      console.log("🤖 [extract-world] Calling Claude API...");

      const res = await client.messages.create({
        model: MODEL,
        max_tokens: 3500,
        system: `
Extract ONLY this JSON shape:

{
  "characters": [{ "name": "", "description": "", "appearance": "", "role": "" }],
  "locations": [{ "name": "", "description": "" }],
  "style": {
    "summary": "",
    "negativePrompt": "",
    "artStyle": "",
    "visualThemes": "",
    "colorPalette": {}
  }
}
`.trim(),
        messages: [{ role: "user", content: text }],
      });

      const parsed = extractJson(extractClaudeText(res.content));

      console.log("✅ [extract-world] Claude returned:", {
        characters: parsed.characters?.length ?? 0,
        locations: parsed.locations?.length ?? 0,
      });

      return parsed;
    });

    /* --------------------------------------------------
       STEP 5: Save world data to database
    -------------------------------------------------- */

    await step.run("persist-world-data", async () => {
      await db.transaction(async (tx) => {
        console.log("🧹 [extract-world] Clearing old world data...");

        const pageIds = data.pages.map((p) => p.id);

        if (pageIds.length > 0) {
          await tx
            .delete(storyPageCharacters)
            .where(inArray(storyPageCharacters.pageId, pageIds));

          await tx
            .delete(storyPageLocations)
            .where(inArray(storyPageLocations.pageId, pageIds));
        }

        const oldCharacterLinks = await tx.query.storyCharacters.findMany({
          where: eq(storyCharacters.storyId, storyId),
          columns: { characterId: true },
        });

        const oldLocationLinks = await tx.query.storyLocations.findMany({
          where: eq(storyLocations.storyId, storyId),
          columns: { locationId: true },
        });

        const oldCharacterIds = oldCharacterLinks.map((c) => c.characterId);
        const oldLocationIds = oldLocationLinks.map((l) => l.locationId);

        await tx.delete(storyCharacters).where(eq(storyCharacters.storyId, storyId));
        await tx.delete(storyLocations).where(eq(storyLocations.storyId, storyId));

        if (oldCharacterIds.length > 0) {
          await tx.delete(characters).where(inArray(characters.id, oldCharacterIds));
        }

        if (oldLocationIds.length > 0) {
          await tx.delete(locations).where(inArray(locations.id, oldLocationIds));
        }

        // Insert NEW characters (deduped)
        const uniqueCharacters = new Map<string, any>();

        for (const c of world.characters ?? []) {
          const rawName = typeof c?.name === "string" ? c.name.trim() : "";
          if (!rawName) continue;

          const key = rawName.toLowerCase();
          if (uniqueCharacters.has(key)) continue;

          uniqueCharacters.set(key, c);
        }

        for (const c of uniqueCharacters.values()) {
          const characterId = uuid();

          await tx.insert(characters).values({
            id: characterId,
            userId: data.project.userId!,
            name: cap(c.name, 80)!,
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

        console.log(`✅ [extract-world] Created ${uniqueCharacters.size} characters`);

        // Insert locations
        for (const l of world.locations ?? []) {
          const locationId = uuid();

          await tx.insert(locations).values({
            id: locationId,
            userId: data.project.userId!,
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

        console.log(`✅ [extract-world] Created ${world.locations?.length ?? 0} locations`);

        // Style guide (upsert)
        await tx
          .insert(storyStyleGuide)
          .values({
            id: uuid(),
            storyId,
            summary: cap(world.style?.summary, 100),
            negativePrompt: cap(world.style?.negativePrompt, 100),
            artStyle: cap(world.style?.artStyle, 100),
            visualThemes: cap(world.style?.visualThemes, 100),
            colorPalette: jsonOrNull(world.style?.colorPalette),
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: storyStyleGuide.storyId,
            set: {
              summary: cap(world.style?.summary, 100),
              negativePrompt: cap(world.style?.negativePrompt, 100),
              artStyle: cap(world.style?.artStyle, 100),
              visualThemes: cap(world.style?.visualThemes, 100),
              colorPalette: jsonOrNull(world.style?.colorPalette),
              updatedAt: new Date(),
            },
          });

        console.log("✅ [extract-world] Style guide saved");
      });
    });

    /* --------------------------------------------------
       STEP 6: Mark phase complete and trigger next phase
    -------------------------------------------------- */

    await step.run("mark-complete-and-trigger-next", async () => {
      await db
        .update(storyWorkflowProgress)
        .set({
          worldExtracted: true,
          worldExtractedAt: new Date(),
          extractingWorld: false,
          updatedAt: new Date(),
        })
        .where(eq(storyWorkflowProgress.storyId, storyId));

      console.log("✅ [extract-world] Phase complete, triggering build-spreads");

      await inngest.send({
        name: "story/build-spreads",
        data: { storyId },
      });
    });

    console.log("🎉 [extract-world] Complete for story:", storyId);

    return { ok: true, phase: "world_extracted" };
  }
);