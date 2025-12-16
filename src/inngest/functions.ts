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
  storyStyleGuide 
} from "@/db/schema";
import { eq, asc, inArray } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

/* ------------------------------------------------------------------
   HELPER: JSON CLEANING & EXTRACTION
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
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) return fenced[1].trim();
  const first = raw.indexOf("{");
  const last = raw.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) {
    return raw.slice(first, last + 1).trim();
  }
  return raw.trim();
}

/* ------------------------------------------------------------------
   JOB 1: CHUNKED GLOBAL REWRITE
   ------------------------------------------------------------------ */
export const globalRewriteJob = inngest.createFunction(
  { id: "global-rewrite-job", retries: 1 },
  { event: "story/global-rewrite" },
  async ({ event, step }) => {
    const { storyId, instruction } = event.data;

    // 1. Mark status as 'processing'
    await step.run("update-status-start", async () => {
      await db.update(stories).set({ status: "processing" }).where(eq(stories.id, storyId));
    });

    const storyData = await step.run("fetch-story", async () => {
      const story = await db.query.stories.findFirst({ where: eq(stories.id, storyId) });
      const pages = await db.query.storyPages.findMany({
        where: eq(storyPages.storyId, storyId),
        orderBy: asc(storyPages.pageNumber),
      });
      return { story, pages };
    });

    const pageCount = storyData.pages.length || 24;

    // 2. Perform AI Rewrite
    const rewrittenJson = await step.run("ai-rewrite", async () => {
      const storyTextForModel = storyData.pages
        .map((p) => `PAGE ${p.pageNumber}: ${p.text}`)
        .join("\n");

      const completion = await client.messages.create({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 4000,
        system: `You are FlipWhizz, a children's story editor. Rewrite the story into ${pageCount} pages. Use SINGLE QUOTES for dialogue. Output ONLY valid JSON: { "pages": [{ "page": 1, "text": "..." }] }`,
        messages: [{ 
          role: "user", 
          content: `Instruction: ${instruction}\n\nOriginal Story:\n${storyTextForModel}` 
        }],
      });

      const raw = extractClaudeText(completion.content);
      return JSON.parse(extractJson(raw));
    });

    // 3. Save Rewritten Pages
    await step.run("save-rewritten-pages", async () => {
      const normalized = rewrittenJson.pages.map((p: any, i: number) => ({
        id: uuid(),
        storyId,
        pageNumber: p.page || i + 1,
        text: String(p.text || "").trim(),
        createdAt: new Date(),
      }));

      await db.transaction(async (tx) => {
        await tx.delete(storyPages).where(eq(storyPages.storyId, storyId));
        await tx.insert(storyPages).values(normalized);
        await tx.update(stories).set({ status: "done", updatedAt: new Date() }).where(eq(stories.id, storyId));
      });
    });
  }
);

/* ------------------------------------------------------------------
   JOB 2: WORLD EXTRACTION
   ------------------------------------------------------------------ */
export const extractWorldJob = inngest.createFunction(
  { id: "extract-world-job", retries: 2 },
  { event: "story/extract-world" },
  async ({ event, step }) => {
    const { storyId } = event.data;

    // 1. Initial Status Update
    await step.run("update-status-extracting", async () => {
      await db.update(stories)
        .set({ status: 'extracting', storyConfirmed: true, updatedAt: new Date() })
        .where(eq(stories.id, storyId));
    });

    // 2. Fetch Story & Pages
    const data = await step.run("fetch-data", async () => {
      const story = await db.query.stories.findFirst({ where: eq(stories.id, storyId) });
      const pages = await db.query.storyPages.findMany({
        where: eq(storyPages.storyId, storyId),
        orderBy: asc(storyPages.pageNumber)
      });
      return { story, pages };
    });

    // 3. AI Extraction
    const extractionJson = await step.run("ai-extraction", async () => {
      const storyText = data.pages.map((p) => `PAGE ${p.pageNumber}: ${p.text}`).join("\n");
      const completion = await client.messages.create({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 3000,
        system: `You are FlipWhizz, a world and scene extractor. Output ONLY valid JSON: { "characters": [], "locations": [], "pagePresence": {}, "style": {} }`,
        messages: [{ role: "user", content: `Extract world from this story:\n\n${storyText}` }],
      });
      
      const raw = extractClaudeText(completion.content);
      return JSON.parse(extractJson(raw));
    });

    // 4. Heavy DB Transaction
    await step.run("save-world-to-db", async () => {
      const json = extractionJson;
      if (!data.story) {
        throw new Error(`Story not found for ID: ${storyId}`);
      }
      await db.transaction(async (tx) => {
        const project = await tx.query.projects.findFirst({
          where: eq(projects.id, data.story!.projectId)
        });
        if (!project?.userId) throw new Error("Project User ID not found");

        const userId = project.userId;
        const pageIds = data.pages.map((p) => p.id);
        const pagesByNumber = new Map(data.pages.map(p => [p.pageNumber, p.id]));

        // Clear existing scoped data
        await tx.delete(storyCharacters).where(eq(storyCharacters.storyId, storyId));
        await tx.delete(storyLocations).where(eq(storyLocations.storyId, storyId));
        if (pageIds.length) {
          await tx.delete(storyPageCharacters).where(inArray(storyPageCharacters.pageId, pageIds));
          await tx.delete(storyPageLocations).where(inArray(storyPageLocations.pageId, pageIds));
        }

        // Insert Entities & Map Names
        const charMap = new Map<string, string>();
        const locMap = new Map<string, string>();

        for (const c of (json.characters || [])) {
          const id = uuid();
          await tx.insert(characters).values({ id, userId, name: c.name, description: c.description });
          await tx.insert(storyCharacters).values({ storyId, characterId: id });
          charMap.set(c.name, id);
        }

        for (const l of (json.locations || [])) {
          const id = uuid();
          await tx.insert(locations).values({ id, userId, name: l.name, description: l.description });
          await tx.insert(storyLocations).values({ storyId, locationId: id });
          locMap.set(l.name, id);
        }

        // Page Presence Joins
        for (const [pageNumStr, presence] of Object.entries(json.pagePresence || {})) {
          const pageId = pagesByNumber.get(Number(pageNumStr));
          if (!pageId) continue;
          
          const p = presence as any;
          for (const name of (p.characters || [])) {
            const charId = charMap.get(name);
            if (charId) await tx.insert(storyPageCharacters).values({ pageId, characterId: charId });
          }
          for (const name of (p.locations || [])) {
            const locId = locMap.get(name);
            if (locId) await tx.insert(storyPageLocations).values({ pageId, locationId: locId });
          }
        }

        // Style Guide
        const summary = [json.style?.lighting, json.style?.palette, json.style?.render].filter(Boolean).join("\n");
        await tx.insert(storyStyleGuide).values({
          storyId,
          summary: json.style?.summary || summary,
          negativePrompt: json.style?.negativePrompt
        }).onConflictDoUpdate({
          target: storyStyleGuide.storyId,
          set: { summary: json.style?.summary || summary, updatedAt: new Date() }
        });

        // Final Update
        await tx.update(stories).set({ status: 'needs_style', updatedAt: new Date() }).where(eq(stories.id, storyId));
      });
    });
  }
);