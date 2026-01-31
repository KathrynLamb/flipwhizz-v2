// inngest/functions.ts
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
} from "@/db/schema";
import { eq, asc, inArray, sql } from "drizzle-orm";
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

export const extractWorldJob = inngest.createFunction(
  { id: "extract-world-job", retries: 2 },
  { event: "story/extract-world" },
  async ({ event, step }) => {
    const { storyId } = event.data;

    console.log("🔵 extractWorldJob started:", storyId);

    /* --------------------------------------------------
       0️⃣ HARD LOCK (prevents duplicate runs)
    -------------------------------------------------- */

    const locked = await step.run("acquire-lock", async () => {
      return db
        .update(stories)
        .set({
          status: "extracting",
          updatedAt: new Date(),
        })
        .where(eq(stories.id, storyId))
        .returning({ id: stories.id });
    });

    if (locked.length === 0) {
      console.log("⏭️ extractWorldJob skipped — already running:", storyId);
      return;
    }

    /* --------------------------------------------------
       1️⃣ Load story + pages
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

    const text = data.pages
      .map((p) => `PAGE ${p.pageNumber}: ${p.text}`)
      .join("\n");

    /* --------------------------------------------------
       2️⃣ Call Claude
    -------------------------------------------------- */

    const world = await step.run("extract-world-from-claude", async () => {
      console.log("🤖 Calling Claude for world extraction...");

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

      console.log("✅ Claude parsed:", {
        characters: parsed.characters?.length ?? 0,
        locations: parsed.locations?.length ?? 0,
      });

      return parsed;
    });

    /* --------------------------------------------------
       3️⃣ Transaction: wipe + rebuild world
    -------------------------------------------------- */

    await step.run("persist-world-data", async () => {
      await db.transaction(async (tx) => {
        console.log("🧹 Clearing existing world data…");

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
          console.log("🗑️ Deleted", oldCharacterIds.length, "old characters");
        }

        if (oldLocationIds.length > 0) {
          await tx.delete(locations).where(inArray(locations.id, oldLocationIds));
          console.log("🗑️ Deleted", oldLocationIds.length, "old locations");
        }

        /* --------------------------------------------------
           4️⃣ Insert NEW characters (DEDUPED)
        -------------------------------------------------- */

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

        console.log(
          "✅ Created",
          uniqueCharacters.size,
          "unique characters (deduped)"
        );

        /* --------------------------------------------------
           5️⃣ Insert locations
        -------------------------------------------------- */

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

        console.log("✅ Created", world.locations?.length ?? 0, "new locations");

        /* --------------------------------------------------
           6️⃣ Style guide (upsert)
        -------------------------------------------------- */

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

        console.log("✅ Style guide updated");
      });
    });

    /* --------------------------------------------------
       7️⃣ Update status to world_ready
    -------------------------------------------------- */

    await step.run("mark-world-ready", async () => {
      await db
        .update(stories)
        .set({ status: "world_ready", updatedAt: new Date() })
        .where(eq(stories.id, storyId));

      console.log("✅ World extraction complete");
    });

    /* --------------------------------------------------
       8️⃣ AUTO-TRIGGER SPREAD BUILDING (NEW!)
    -------------------------------------------------- */

    await step.run("trigger-build-spreads", async () => {
      await inngest.send({
        name: "story/build-spreads",
        data: { storyId },
      });

      console.log("🚀 Triggered build-spreads");
    });

    console.log("🎉 extractWorldJob complete:", storyId);

    return { ok: true };
  }
);

// ADD THIS TO YOUR inngest/functions.ts FILE

// REPLACE THE generateCoversJob IN YOUR inngest/functions.ts WITH THIS

import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { v2 as cloudinary } from "cloudinary";
import { Readable } from "node:stream";
import fs from "fs/promises";

// Initialize Gemini client (add this at top of your functions.ts if not already there)
const geminiClient = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
  apiVersion: "v1alpha",
});

const GEMINI_IMAGE_MODEL = "gemini-3-pro-image-preview";

// Helper functions
function isDataUrl(v: string) {
  return v.startsWith("data:image");
}

function guessMimeTypeFromSource(source: string) {
  const s = source.toLowerCase();
  if (s.endsWith(".png")) return "image/png";
  if (s.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}

async function getImagePart(source: string) {
  if (isDataUrl(source)) {
    throw new Error("Base64 data URL not supported - use URLs only");
  }

  let buffer: Buffer;
  const mimeType = guessMimeTypeFromSource(source);

  if (source.startsWith("http")) {
    const res = await fetch(source);
    if (!res.ok) {
      throw new Error(`Failed to fetch image: ${res.status}`);
    }
    buffer = Buffer.from(await res.arrayBuffer());
  } else {
    buffer = await fs.readFile(source);
  }

  return {
    inlineData: {
      data: buffer.toString("base64"),
      mimeType,
    },
  };
}

async function saveImageToCloudinary(
  base64Data: string,
  mimeType: string,
  storyId: string,
  coverType: "front" | "back"
) {
  const buffer = Buffer.from(base64Data, "base64");

  return new Promise<string>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: `flipwhizz/stories/${storyId}/covers`,
        filename_override: `${coverType}-${uuid()}`,
        resource_type: "image",
      },
      (err, res) => {
        if (err) return reject(err);
        resolve(res?.secure_url ?? "");
      }
    );

    Readable.from(buffer).pipe(stream);
  });
}

function extractInlineImage(result: any) {
  const parts = result.candidates?.[0]?.content?.parts ?? [];
  const imagePart = parts.find((p: any) => p.inlineData?.data);
  if (!imagePart) return null;

  return {
    data: imagePart.inlineData.data as string,
    mimeType: imagePart.inlineData.mimeType as string,
  };
}
