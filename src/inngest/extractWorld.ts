// src/inngest/extractWorld.ts
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
  projects,
} from "@/db/schema";
import { eq, asc } from "drizzle-orm";
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
    .map((b) => (b?.type === "text" ? String(b.text ?? "") : ""))
    .join("\n")
    .trim();
}

const cap = (v: unknown, max: number) =>
  typeof v === "string" ? v.trim().slice(0, max) : null;

const jsonOrNull = (v: unknown) =>
  v && typeof v === "object" ? v : null;

export const extractWorld = inngest.createFunction(
  {
    id: "extract-world",
    retries: 2,
  },
  { event: "story/extract-world" },
  async ({ event, step }) => {
    const { storyId } = event.data as { storyId: string };

    console.log("🔵 [extract-world] Starting for story:", storyId);

    /* --------------------------------------------------
       STEP 1: Load story data
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

      return { story, project, pages };
    });

    /* --------------------------------------------------
       STEP 2: Call Claude to extract world
    -------------------------------------------------- */
    const world = await step.run("extract-world-from-claude", async () => {
      const text = data.pages
        .map((p) => `PAGE ${p.pageNumber}: ${p.text}`)
        .join("\n");

      const res = await client.messages.create({
        model: MODEL,
        max_tokens: 3500,
        system: `Extract ONLY this JSON shape:
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
}`,
        messages: [{ role: "user", content: text }],
      });

      return extractJson(extractClaudeText(res.content));
    });

    /* --------------------------------------------------
       STEP 3: Save world data to database
    -------------------------------------------------- */
    await step.run("persist-world-data", async () => {
      await db.transaction(async (tx) => {
        // Delete existing world data
        await tx.delete(storyCharacters).where(eq(storyCharacters.storyId, storyId));
        await tx.delete(storyLocations).where(eq(storyLocations.storyId, storyId));
        await tx.delete(storyStyleGuide).where(eq(storyStyleGuide.storyId, storyId));

        // Insert characters
        for (const c of world.characters ?? []) {
          if (!c.name) continue;
          
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

        // Insert locations
        for (const l of world.locations ?? []) {
          if (!l.name) continue;
          
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

        // Insert style guide
        await tx.insert(storyStyleGuide).values({
          id: uuid(),
          storyId,
          summary: cap(world.style?.summary, 100),
          negativePrompt: cap(world.style?.negativePrompt, 100),
          artStyle: cap(world.style?.artStyle, 100),
          visualThemes: cap(world.style?.visualThemes, 100),
          colorPalette: jsonOrNull(world.style?.colorPalette),
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      });
    });

    /* --------------------------------------------------
       STEP 4: Mark complete and trigger next phase
    -------------------------------------------------- */
    await step.run("mark-complete-and-trigger-next", async () => {
      await db
        .update(storyWorkflowProgress)
        .set({
          worldExtracted: true,
          worldExtractedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(storyWorkflowProgress.storyId, storyId));

      console.log("✅ [extract-world] Complete, triggering build-spreads");

      await inngest.send({
        name: "story/build-spreads",
        data: { storyId },
      });
    });

    return { ok: true };
  }
);