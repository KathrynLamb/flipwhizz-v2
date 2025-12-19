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

// FIX: Use a real, current model ID.
// Claude 3.5 Sonnet is excellent for this.

const CLAUDE_MODEL = "claude-sonnet-4-20250514"

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
  // Match json block or fallback to curly braces
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
   JOB 1: CHUNKED GLOBAL REWRITE (Simplified)
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

    // Default to current length if not specified
    const pageCount = storyData.pages.length > 0 ? storyData.pages.length : 12;

    // 2. Perform AI Rewrite
    const rewrittenJson = await step.run("ai-rewrite", async () => {
      const storyTextForModel = storyData.pages
        .map((p) => `PAGE ${p.pageNumber}: ${p.text}`)
        .join("\n");

      const completion = await client.messages.create({
        model: CLAUDE_MODEL, // FIX: Using valid model
        max_tokens: 4000,
        // FIX: Adjusted prompt to ensure "page" is a number, not a string
        system: `You are FlipWhizz, a children's story editor. Rewrite the story following the instructions into exactly ${pageCount} pages. Use SINGLE QUOTES for dialogue. Output ONLY valid JSON with this structure: { "pages": [{ "page": number, "text": string }] }`,
        messages: [{
          role: "user",
          content: `Instruction: ${instruction}\n\nOriginal Story:\n${storyTextForModel}`
        }],
      });

      const raw = extractClaudeText(completion.content);
      const cleaned = extractJson(raw);
      console.log("AI Rewrite Output:", cleaned); // Helpful debug
      return JSON.parse(cleaned);
    });

    // 3. Save Rewritten Pages
    await step.run("save-rewritten-pages", async () => {
      if (!rewrittenJson.pages || !Array.isArray(rewrittenJson.pages)) {
        throw new Error("Invalid JSON structure from AI rewrite");
      }

      const normalized = rewrittenJson.pages.map((p: any, i: number) => ({
        id: uuid(),
        storyId,
        // Ensure pageNumber is reliable even if AI slips up
        pageNumber: typeof p.page === 'number' ? p.page : i + 1,
        text: String(p.text || "").trim(),
        createdAt: new Date(),
      }));

      await db.transaction(async (tx) => {
        await tx.delete(storyPages).where(eq(storyPages.storyId, storyId));
        if (normalized.length > 0) {
            await tx.insert(storyPages).values(normalized);
        }
        await tx.update(stories).set({ status: "done", updatedAt: new Date() }).where(eq(stories.id, storyId));
      });
    });
  }
);


/* ------------------------------------------------------------------
   JOB 2: WORLD EXTRACTION (Fixed: Broken into smaller steps)
   ------------------------------------------------------------------ */
   export const extractWorldJob = inngest.createFunction(
    {
      id: "extract-world-job",
      retries: 2,
      timeouts: {
        finish: "5m",
        start: "5m",
      },
    }, // 👈 THIS COMMA WAS MISSING
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
        if (!story) throw new Error(`Story not found: ${storyId}`);
        
        const project = await db.query.projects.findFirst({
            where: eq(projects.id, story.projectId)
        });
        if (!project?.userId) throw new Error("Project User ID not found");
  
        const pages = await db.query.storyPages.findMany({
          where: eq(storyPages.storyId, storyId),
          orderBy: asc(storyPages.pageNumber)
        });
        // Return everything needed for subsequent steps
        return { story, pages, userId: project.userId };
      });
  
      // 3. AI Extraction
      const json = await step.run("ai-extraction", async () => {
        const storyText = data.pages.map((p) => `PAGE ${p.pageNumber}: ${p.text}`).join("\n");
  
        const systemPrompt = `You are FlipWhizz, a world and scene extractor for a children's book.
  Extract the key elements and output ONLY valid JSON with this exact structure:
  {
    "characters": [
      { "name": "Exact Name", "description": "Visual description for an illustrator" }
    ],
    "locations": [
      { "name": "Exact Location Name", "description": "Visual description" }
    ],
    "pagePresence": {
      "1": { "characters": ["Name 1"], "locations": ["Location A"] }
      // map page numbers (as strings) to lists of exact names found on that page
    },
    "style": {
      "summary": "Overall art style summary",
      "negativePrompt": "Things to avoid in images"
    }
  }`;
  
        const completion = await client.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens: 3000,
          system: systemPrompt,
          messages: [{ role: "user", content: `Extract world from this story:\n\n${storyText}` }],
        });
  
        const raw = extractClaudeText(completion.content);
        const cleaned = extractJson(raw);
        console.log("AI Extraction Output complete."); 
        return JSON.parse(cleaned);
      });
  
      /* --------------------------------------------------
         Database Operations - Broken into smaller steps
      -------------------------------------------------- */
  
      const pageIds = data.pages.map((p) => p.id);
  
      // Step 4: Clear old data
      await step.run("db-clear-old-data", async () => {
        console.log("Clearing old story data...");
        await db.transaction(async (tx) => {
          await tx.delete(storyCharacters).where(eq(storyCharacters.storyId, storyId));
          await tx.delete(storyLocations).where(eq(storyLocations.storyId, storyId));
          if (pageIds.length > 0) {
            await tx.delete(storyPageCharacters).where(inArray(storyPageCharacters.pageId, pageIds));
            await tx.delete(storyPageLocations).where(inArray(storyPageLocations.pageId, pageIds));
          }
        });
      });
  
      // Step 5: Insert Global Characters & Locations, build ID maps
      // We return maps to be used in the next step.
      const { charMap, locMap } = await step.run("db-insert-globals", async () => {
         console.log("Inserting global characters and locations...");
         const charNameMap: Record<string, string> = {};
         const locNameMap: Record<string, string> = {};
  
         await db.transaction(async (tx) => {
           // Characters
           for (const c of (json.characters || [])) {
             if(!c.name) continue;
             const id = uuid();
             await tx.insert(characters).values({ id, userId: data.userId, name: c.name, description: c.description || "A character." });
             await tx.insert(storyCharacters).values({ storyId, characterId: id });
             charNameMap[c.name] = id;
           }
           // Locations
           for (const l of (json.locations || [])) {
              if(!l.name) continue;
             const id = uuid();
             await tx.insert(locations).values({ id, userId: data.userId, name: l.name, description: l.description || "A location." });
             await tx.insert(storyLocations).values({ storyId, locationId: id });
             locNameMap[l.name] = id;
           }
         });
         
         return { charMap: charNameMap, locMap: locNameMap };
      });
  
  
      // Step 6: Insert Page Presence using maps from Step 5
      await step.run("db-insert-page-presence", async () => {
         console.log("Inserting page presence data...");
         const pagesByNumber = new Map(data.pages.map(p => [p.pageNumber, p.id]));
  
         await db.transaction(async (tx) => {
           for (const [pageNumStr, presence] of Object.entries(json.pagePresence || {})) {
             const pageId = pagesByNumber.get(Number(pageNumStr));
             if (!pageId) continue;
   
             const p = presence as any;
             // Characters on page
             for (const name of (p.characters || [])) {
               const charId = charMap[name]; // Use map from previous step
               if (charId) await tx.insert(storyPageCharacters).values({ id: uuid(), pageId, characterId: charId, source: 'ai' });
             }
             // Locations on page
             for (const name of (p.locations || [])) {
               const locId = locMap[name]; // Use map from previous step
               if (locId) await tx.insert(storyPageLocations).values({ id: uuid(), pageId, locationId: locId, source: 'ai' });
             }
           }
         });
      });
  
      // Step 7: Finalize Style and Status
    await step.run("db-finalize-status", async () => {
      console.log("Finalizing style and status...");
      await db.transaction(async (tx) => {
        // Style Guide (Unchanged)
        await tx.insert(storyStyleGuide).values({
            id: uuid(),
            storyId,
            summary: json.style?.summary || "An illustrated children's book.",
            negativePrompt: json.style?.negativePrompt,
            createdAt: new Date(),
            updatedAt: new Date()
          }).onConflictDoUpdate({
            target: storyStyleGuide.storyId,
            set: {
                summary: json.style?.summary || "An illustrated children's book.",
                negativePrompt: json.style?.negativePrompt,
                updatedAt: new Date()
            }
          });

          // --- THE FIX IS HERE ---
          // Change status to 'done' instead of 'needs_style'.
          // This should signal the /extract page that its job is finished.
          await tx.update(stories)
             .set({ status: 'done', updatedAt: new Date() })
             .where(eq(stories.id, storyId));
      });
    });

    console.log("✅ World extraction complete!");
  }
);