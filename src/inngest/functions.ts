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
  storyPageCharacters,
  storyPageLocations,
  storyStyleGuide,
} from "@/db/schema";
import { eq, asc, inArray } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import Anthropic from "@anthropic-ai/sdk";

type PagePresenceEntry = {
  characters?: string[];
  locations?: string[];
};


/* ------------------------------------------------------------------
   CONFIG
------------------------------------------------------------------ */

const CLAUDE_MODEL = "claude-sonnet-4-20250514";
const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

/* ------------------------------------------------------------------
   HELPERS
------------------------------------------------------------------ */

function extractClaudeText(content: any): string {
  return (Array.isArray(content) ? content : [])
    .map((b) => (b?.type === "text" ? String(b.text ?? "") : ""))
    .filter((t) => t.trim().length > 0)
    .join("\n")
    .trim();
}

function extractJson(raw: string): string {
  if (!raw) return raw;
  const fenced = raw.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/i);
  if (fenced?.[1]) return fenced[1].trim();

  const first = raw.indexOf("{");
  const last = raw.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) {
    return raw.slice(first, last + 1).trim();
  }
  return raw.trim();
}

/* ------------------------------------------------------------------
   JOB 1: GLOBAL REWRITE
------------------------------------------------------------------ */

export const globalRewriteJob = inngest.createFunction(
  { id: "global-rewrite-job", retries: 1 },
  { event: "story/global-rewrite" },
  async ({ event, step }) => {
    const { storyId, instruction } = event.data;

    await step.run("mark-processing", async () => {
      await db.update(stories)
        .set({ status: "processing", updatedAt: new Date() })
        .where(eq(stories.id, storyId));
    });

    const { pages } = await step.run("load-story", async () => {
      const pages = await db.query.storyPages.findMany({
        where: eq(storyPages.storyId, storyId),
        orderBy: asc(storyPages.pageNumber),
      });
      return { pages };
    });

    const pageCount = pages.length || 12;

    const rewritten = await step.run("ai-rewrite", async () => {
      const storyText = pages
        .map((p) => `PAGE ${p.pageNumber}: ${p.text}`)
        .join("\n");

      const res = await client.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: 4000,
        system: `Rewrite into exactly ${pageCount} pages. Output ONLY valid JSON:
{ "pages": [{ "page": number, "text": string }] }`,
        messages: [{ role: "user", content: storyText }],
      });

      return JSON.parse(extractJson(extractClaudeText(res.content)));
    });

    await step.run("save-pages", async () => {
      await db.transaction(async (tx) => {
        await tx.delete(storyPages).where(eq(storyPages.storyId, storyId));
        await tx.insert(storyPages).values(
          rewritten.pages.map((p: any, i: number) => ({
            id: uuid(),
            storyId,
            pageNumber: typeof p.page === "number" ? p.page : i + 1,
            text: String(p.text || "").trim(),
            createdAt: new Date(),
          }))
        );
        await tx.update(stories)
          .set({ status: "done", updatedAt: new Date() })
          .where(eq(stories.id, storyId));
      });
    });
  }
);

/* ------------------------------------------------------------------
   JOB 2: WORLD EXTRACTION (FINAL, CORRECT)
------------------------------------------------------------------ */

export const extractWorldJob = inngest.createFunction(
  {
    id: "extract-world-job",
    retries: 2,
    timeouts: {
      start: "5m",
      finish: "5m",
    },
  },
  { event: "story/extract-world" },
  async ({ event, step }) => {
    const { storyId } = event.data;

    try {
      /* ------------------------------
         1. Mark extracting (authoritative)
      ------------------------------ */
      await step.run("mark-extracting", async () => {
        await db.update(stories)
          .set({ status: "extracting", updatedAt: new Date() })
          .where(eq(stories.id, storyId));
      });

      /* ------------------------------
         2. Load story context
      ------------------------------ */
      const data = await step.run("load-data", async () => {
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

        return { story, pages, userId: project.userId };
      });

      /* ------------------------------
         3. AI extraction
      ------------------------------ */
      const json = await step.run("ai-extract", async () => {
        const text = data.pages
          .map((p) => `PAGE ${p.pageNumber}: ${p.text}`)
          .join("\n");

        const res = await client.messages.create({
          model: CLAUDE_MODEL,
          max_tokens: 3000,
          system: `Extract world JSON ONLY with:
characters[], locations[], pagePresence{}, style{}`,
          messages: [{ role: "user", content: text }],
        });

        const parsed = JSON.parse(extractJson(extractClaudeText(res.content)));
        if (!Array.isArray(parsed.characters) || !Array.isArray(parsed.locations)) {
          throw new Error("Invalid AI world JSON");
        }
        return parsed;
      });

      const pageIds = data.pages.map((p) => p.id);

      /* ------------------------------
         4. Clear old world
      ------------------------------ */
      await step.run("clear-old", async () => {
        await db.transaction(async (tx) => {
          await tx.delete(storyCharacters).where(eq(storyCharacters.storyId, storyId));
          await tx.delete(storyLocations).where(eq(storyLocations.storyId, storyId));
          if (pageIds.length) {
            await tx.delete(storyPageCharacters).where(inArray(storyPageCharacters.pageId, pageIds));
            await tx.delete(storyPageLocations).where(inArray(storyPageLocations.pageId, pageIds));
          }
        });
      });

      /* ------------------------------
         5. Insert globals
      ------------------------------ */
      const { charMap, locMap } = await step.run("insert-globals", async () => {
        const charMap: Record<string, string> = {};
        const locMap: Record<string, string> = {};

        await db.transaction(async (tx) => {
          for (const c of json.characters) {
            const id = uuid();
            await tx.insert(characters).values({
              id,
              userId: data.userId,
              name: c.name,
              description: c.description,
            });
            await tx.insert(storyCharacters).values({ storyId, characterId: id });
            charMap[c.name] = id;
          }

          for (const l of json.locations) {
            const id = uuid();
            await tx.insert(locations).values({
              id,
              userId: data.userId,
              name: l.name,
              description: l.description,
            });
            await tx.insert(storyLocations).values({ storyId, locationId: id });
            locMap[l.name] = id;
          }
        });

        return { charMap, locMap };
      });


/* ------------------------------
   6. Page presence
------------------------------ */
await step.run("insert-presence", async () => {
  const pageByNum = new Map(data.pages.map((p) => [p.pageNumber, p.id]));

  await db.transaction(async (tx) => {
    const entries = Object.entries(
      (json.pagePresence ?? {}) as Record<string, PagePresenceEntry>
    );

    for (const [num, p] of entries) {
      const pageId = pageByNum.get(Number(num));
      if (!pageId) continue;

      for (const name of p.characters ?? []) {
        const characterId = charMap[name];
        if (!characterId) continue;

        await tx.insert(storyPageCharacters).values({
          id: uuid(),
          pageId,
          characterId,
          source: "ai",
        });
      }

      for (const name of p.locations ?? []) {
        const locationId = locMap[name];
        if (!locationId) continue;

        await tx.insert(storyPageLocations).values({
          id: uuid(),
          pageId,
          locationId,
          source: "ai",
        });
      }
    }
  });
});


      /* ------------------------------
         7. Finalize
      ------------------------------ */
      await step.run("finalize", async () => {
        await db.transaction(async (tx) => {
          await tx.insert(storyStyleGuide)
            .values({
              id: uuid(),
              storyId,
              summary: json.style?.summary,
              negativePrompt: json.style?.negativePrompt,
              createdAt: new Date(),
              updatedAt: new Date(),
            })
            .onConflictDoUpdate({
              target: storyStyleGuide.storyId,
              set: {
                summary: json.style?.summary,
                negativePrompt: json.style?.negativePrompt,
                updatedAt: new Date(),
              },
            });

          await tx.update(stories)
            .set({ status: "done", updatedAt: new Date() })
            .where(eq(stories.id, storyId));
        });
      });

    } catch (err) {
      await db.update(stories)
        .set({ status: "extracting_failed", updatedAt: new Date() })
        .where(eq(stories.id, storyId));
      throw err;
    }
  }
);
