// // src/inngest/functions.ts
// import { inngest } from "./client";
// import { db } from "@/db";
// import {
//   stories,
//   storyPages,
//   characters,
//   storyCharacters,
//   locations,
//   storyLocations,
//   projects,
//   storyStyleGuide,
// } from "@/db/schema";
// import { asc, eq } from "drizzle-orm";
// import { v4 as uuid } from "uuid";
// import Anthropic from "@anthropic-ai/sdk";

// /* ------------------------------------------------------------------
//    CONFIG
// ------------------------------------------------------------------ */

// const CLAUDE_MODEL = "claude-sonnet-4-20250514";

// const client = new Anthropic({
//   apiKey: process.env.ANTHROPIC_API_KEY!,
// });

// /* ------------------------------------------------------------------
//    HELPERS
// ------------------------------------------------------------------ */

// function normalizeRole(raw?: string | null): string | null {
//   if (!raw) return null;

//   const v = raw.toLowerCase();

//   if (v.includes("protagonist") || v.includes("hero")) return "protagonist";
//   if (v.includes("antagonist") || v.includes("villain")) return "antagonist";
//   if (v.includes("companion") || v.includes("friend")) return "companion";
//   if (v.includes("mentor")) return "mentor";
//   if (v.includes("parent")) return "parent";
//   if (v.includes("sidekick")) return "sidekick";

//   // guaranteed < 40 chars
//   return "supporting";
// }


// function extractClaudeText(content: unknown): string {
//   const arr = Array.isArray(content) ? content : [];
//   return arr
//     .map((b: any) => (b?.type === "text" ? String(b.text ?? "") : ""))
//     .filter((t) => t.trim().length > 0)
//     .join("\n")
//     .trim();
// }

// function extractJson(raw: string): string {
//   if (!raw) return raw;

//   const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
//   if (fenced?.[1]) return fenced[1].trim();

//   const first = raw.indexOf("{");
//   const last = raw.lastIndexOf("}");
//   if (first !== -1 && last !== -1 && last > first) {
//     return raw.slice(first, last + 1).trim();
//   }

//   return raw.trim();
// }

// function safeString(x: unknown): string {
//   return typeof x === "string" ? x.trim() : "";
// }

// function safeObject(x: unknown): Record<string, any> | null {
//   return x && typeof x === "object" && !Array.isArray(x) ? (x as any) : null;
// }

// type WorldJson = {
//   characters: Array<{
//     name: string;
//     description?: string;
//     appearance?: string;
//     personalityTraits?: string;
//     role?: string;
//   }>;
//   locations: Array<{
//     name: string;
//     description?: string;
//     visualDetails?: Record<string, any>;
//   }>;
//   style: {
//     summary: string;
//     negativePrompt?: string;
//     artStyle?: string;
//     colorPalette?: Record<string, any>;
//     visualThemes?: string;
//   };
// };

// /* ------------------------------------------------------------------
//    JOB 1: GLOBAL REWRITE
// ------------------------------------------------------------------ */

// export const globalRewriteJob = inngest.createFunction(
//   { id: "global-rewrite-job", retries: 1 },
//   { event: "story/global-rewrite" },
//   async ({ event, step }) => {
//     const { storyId } = event.data as { storyId: string };

//     await step.run("mark-processing", async () => {
//       await db
//         .update(stories)
//         .set({ status: "processing", updatedAt: new Date() })
//         .where(eq(stories.id, storyId));
//     });

//     const pages = await step.run("load-pages", async () => {
//       return db.query.storyPages.findMany({
//         where: eq(storyPages.storyId, storyId),
//         orderBy: asc(storyPages.pageNumber),
//       });
//     });

//     const pageCount = pages.length || 12;

//     const rewritten = await step.run("ai-rewrite", async () => {
//       const storyText = pages
//         .map((p) => `PAGE ${p.pageNumber}: ${p.text}`)
//         .join("\n");

//       const res = await client.messages.create({
//         model: CLAUDE_MODEL,
//         max_tokens: 4000,
//         system: `Rewrite into exactly ${pageCount} pages. Output ONLY valid JSON:
// { "pages": [{ "page": number, "text": string }] }`,
//         messages: [{ role: "user", content: storyText }],
//       });

//       const parsed = JSON.parse(extractJson(extractClaudeText(res.content)));
//       if (!parsed?.pages || !Array.isArray(parsed.pages)) {
//         throw new Error("Rewrite returned invalid JSON (missing pages[])");
//       }
//       return parsed as { pages: Array<{ page: number; text: string }> };
//     });

//     await step.run("save-pages", async () => {
//       await db.transaction(async (tx) => {
//         await tx.delete(storyPages).where(eq(storyPages.storyId, storyId));

//         await tx.insert(storyPages).values(
//           rewritten.pages.map((p, i) => ({
//             id: uuid(),
//             storyId,
//             pageNumber: typeof p.page === "number" ? p.page : i + 1,
//             text: safeString(p.text),
//             createdAt: new Date(),
//           }))
//         );

//         await tx
//           .update(stories)
//           .set({ status: "done", updatedAt: new Date() })
//           .where(eq(stories.id, storyId));
//       });
//     });

//     return { ok: true, pages: rewritten.pages.length };
//   }
// );

// /* ------------------------------------------------------------------
//    JOB 2: WORLD EXTRACTION (GLOBALS ONLY)
//    - characters (incl appearance)
//    - locations (incl visualDetails)
//    - style guide
//    IMPORTANT: DOES NOT WRITE story_page_characters / story_page_locations
//    It finalizes to "world_ready" AND triggers "story/build-spreads"
// ------------------------------------------------------------------ */

// export const extractWorldJob = inngest.createFunction(
//   {
//     id: "extract-world-job",
//     retries: 2,
//     timeouts: { start: "5m", finish: "5m" },
//   },
//   { event: "story/extract-world" },
//   async ({ event, step }) => {
//     const { storyId } = event.data as { storyId: string };

//     try {
//       await step.run("mark-extracting-world", async () => {
//         await db
//           .update(stories)
//           .set({ status: "extracting_world", updatedAt: new Date() })
//           .where(eq(stories.id, storyId));
//       });

//       const data = await step.run("load-story-project-pages", async () => {
//         const story = await db.query.stories.findFirst({
//           where: eq(stories.id, storyId),
//         });
//         if (!story) throw new Error("Story not found");

//         const project = await db.query.projects.findFirst({
//           where: eq(projects.id, story.projectId),
//         });
//         if (!project?.userId) throw new Error("Missing userId");

//         const pages = await db.query.storyPages.findMany({
//           where: eq(storyPages.storyId, storyId),
//           orderBy: asc(storyPages.pageNumber),
//         });
//         if (!pages.length) throw new Error("No pages found");

//         return { story, project, pages };
//       });

//       const world = await step.run("ai-extract-world", async (): Promise<WorldJson> => {
//         const text = data.pages
//           .map((p) => `PAGE ${p.pageNumber}: ${p.text}`)
//           .join("\n");

//         const system = `
// You are an expert children's story "world bible" extractor.

// Return ONLY valid JSON (no markdown, no commentary).

// Output exactly this JSON shape:
// {
//   "characters": [
//     {
//       "name": "string",
//       "description": "string",
//       "appearance": "string",
//       "personalityTraits": "string",
//       "role": "string"
//     }
//   ],
//   "locations": [
//     {
//       "name": "string",
//       "description": "string",
//       "visualDetails": {
//         "lighting": "string",
//         "colors": ["string"],
//         "materials": ["string"],
//         "architecture": "string",
//         "keyFeatures": ["string"],
//         "atmosphere": "string"
//       }
//     }
//   ],
//   "style": {
//     "summary": "string",
//     "negativePrompt": "string",
//     "artStyle": "string",
//     "colorPalette": { "primary": ["string"], "secondary": ["string"], "accent": ["string"] },
//     "visualThemes": "string"
//   }
// }

// Rules:
// - Use ONLY what the story implies; best guess if uncertain.
// - Include all important recurring characters/locations.
// - Be concrete for illustration consistency.
// `.trim();

//         const res = await client.messages.create({
//           model: CLAUDE_MODEL,
//           max_tokens: 3500,
//           system,
//           messages: [{ role: "user", content: text }],
//         });

//         const parsed = JSON.parse(extractJson(extractClaudeText(res.content)));
//         const obj = safeObject(parsed);
//         if (!obj) throw new Error("AI returned non-object JSON");

//         if (!Array.isArray(obj.characters) || !Array.isArray(obj.locations) || !obj.style) {
//           throw new Error("AI world JSON missing required keys");
//         }

//         return obj as WorldJson;
//       });

//       await step.run("persist-world-globals", async () => {
//         await db.transaction(async (tx) => {
//           // clear story links (globals only)
//           await tx.delete(storyCharacters).where(eq(storyCharacters.storyId, storyId));
//           await tx.delete(storyLocations).where(eq(storyLocations.storyId, storyId));

//           // NOTE: we do NOT delete story_page_characters / story_page_locations here.
//           // build-spreads owns presence.

//           // insert characters + link to story
//           for (const c of world.characters) {
//             const id = uuid();
//             await tx.insert(characters).values({
//               id,
//               userId: data.project.userId,
//               name: safeString(c.name),
//               description: safeString(c.description) || null,
//               appearance: safeString(c.appearance) || null,
//               personalityTraits: safeString(c.personalityTraits) || null,
//               visualDetails: null,
//               portraitImageUrl: null,
//               referenceImageUrl: null,
//               locked: false,
//               createdAt: new Date(),
//               updatedAt: new Date(),
//             });
//             const role = normalizeRole(c.role);

//             await tx.insert(storyCharacters).values({
//               storyId,
//               characterId: id,
//               role,
//               arcSummary: safeString(c.role) || null, // full description goes here
//             });
            
//           }

//           // insert locations + link to story
//           for (const l of world.locations) {
//             const id = uuid();
//             await tx.insert(locations).values({
//               id,
//               userId: data.project.userId,
//               name: safeString(l.name),
//               description: safeString(l.description) || null,
//               visualDetails: l.visualDetails ?? null,
//               portraitImageUrl: null,
//               referenceImageUrl: null,
//               locked: false,
//               createdAt: new Date(),
//               updatedAt: new Date(),
//             });

//             await tx.insert(storyLocations).values({
//               storyId,
//               locationId: id,
//               significance: null,
//             });
//           }

//           // upsert style guide
//           await tx
//             .insert(storyStyleGuide)
//             .values({
//               id: uuid(),
//               storyId,
//               summary: safeString(world.style?.summary),
//               negativePrompt: safeString(world.style?.negativePrompt) || null,
//               artStyle: safeString(world.style?.artStyle) || null,
//               colorPalette: world.style?.colorPalette ?? null,
//               visualThemes: safeString(world.style?.visualThemes) || null,
//               createdAt: new Date(),
//               updatedAt: new Date(),
//             })
//             .onConflictDoUpdate({
//               target: storyStyleGuide.storyId,
//               set: {
//                 summary: safeString(world.style?.summary),
//                 negativePrompt: safeString(world.style?.negativePrompt) || null,
//                 artStyle: safeString(world.style?.artStyle) || null,
//                 colorPalette: world.style?.colorPalette ?? null,
//                 visualThemes: safeString(world.style?.visualThemes) || null,
//                 updatedAt: new Date(),
//               },
//             });
//         });
//       });

//       // ✅ world is now ready
//       await step.run("finalize-world", async () => {
//         await db
//           .update(stories)
//           .set({ status: "world_ready", updatedAt: new Date() })
//           .where(eq(stories.id, storyId));
//       });

//       // 🚀 kick off spreads (who/where) as the next stage
//       await step.sendEvent("trigger-build-spreads", {
//         name: "story/build-spreads",
//         data: { storyId },
//       });

//       return { ok: true };
//     } catch (err) {
//       await db
//         .update(stories)
//         .set({ status: "extracting_failed", updatedAt: new Date() })
//         .where(eq(stories.id, storyId));
//       throw err;
//     }
//   }
// );
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
} from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import Anthropic from "@anthropic-ai/sdk";

/* ------------------------------------------------------------------
   CONFIG
------------------------------------------------------------------ */

const MODEL = "claude-sonnet-4-20250514";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

/* ------------------------------------------------------------------
   HARD SAFETY HELPERS (CRITICAL)
------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------
   JOB 1: GLOBAL REWRITE
------------------------------------------------------------------ */

export const globalRewriteJob = inngest.createFunction(
  { id: "global-rewrite-job", retries: 1 },
  { event: "story/global-rewrite" },
  async ({ event }) => {
    const { storyId } = event.data;

    const pages = await db.query.storyPages.findMany({
      where: eq(storyPages.storyId, storyId),
      orderBy: asc(storyPages.pageNumber),
    });

    const text = pages
      .map((p) => `PAGE ${p.pageNumber}: ${p.text}`)
      .join("\n");

    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 4000,
      system:
        "Rewrite into the same number of pages. Output ONLY JSON: { pages: [{ page, text }] }",
      messages: [{ role: "user", content: text }],
    });

    const parsed = extractJson(extractClaudeText(res.content));

    await db.transaction(async (tx) => {
      await tx.delete(storyPages).where(eq(storyPages.storyId, storyId));
      await tx.insert(storyPages).values(
        parsed.pages.map((p: any, i: number) => ({
          id: uuid(),
          storyId,
          pageNumber: p.page ?? i + 1,
          text: String(p.text ?? ""),
          createdAt: new Date(),
        }))
      );

      await tx
        .update(stories)
        .set({ status: "done", updatedAt: new Date() })
        .where(eq(stories.id, storyId));
    });
  }
);

/* ------------------------------------------------------------------
   JOB 2: WORLD EXTRACTION (SAFE + SCHEMA-COMPATIBLE)
------------------------------------------------------------------ */

export const extractWorldJob = inngest.createFunction(
  { id: "extract-world-job", retries: 2 },
  { event: "story/extract-world" },
  async ({ event }) => {
    const { storyId } = event.data;

    await db
      .update(stories)
      .set({ status: "extracting_world", updatedAt: new Date() })
      .where(eq(stories.id, storyId));

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

    const text = pages
      .map((p) => `PAGE ${p.pageNumber}: ${p.text}`)
      .join("\n");

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

    const world = extractJson(extractClaudeText(res.content));

    await db.transaction(async (tx) => {
      await tx.delete(storyCharacters).where(eq(storyCharacters.storyId, storyId));
      await tx.delete(storyLocations).where(eq(storyLocations.storyId, storyId));

      for (const c of world.characters ?? []) {
        const characterId = uuid();
      
        await tx.insert(characters).values({
          id: characterId, // ✅ MUST be inserted
          userId: project.userId!, // assert non-null
          name: cap(c.name, 80)!,  // characters.name is NOT NULL
          description: cap(c.description, 500),
          appearance: cap(c.appearance, 500),
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      
        await tx.insert(storyCharacters).values({
          storyId,
          characterId, // ✅ now guaranteed correct
          role: cap(c.role, 40),
          arcSummary: null,
        });
      }
      
      for (const l of world.locations ?? []) {
        const locationId = uuid();
      
        await tx.insert(locations).values({
          id: locationId,
          userId: project.userId!,
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
      
  

      // ✅ STYLE GUIDE — SAFE CAPS (FIXES YOUR CURRENT CRASH)
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
    });

    await db
      .update(stories)
      .set({ status: "world_ready", updatedAt: new Date() })
      .where(eq(stories.id, storyId));
  }
);
