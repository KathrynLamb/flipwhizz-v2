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

// DELETE extractWorldJob ENTIRELY - it's replaced by ensureWorld

// Keep your Gemini/Cloudinary helper functions below
import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { v2 as cloudinary } from "cloudinary";
import { Readable } from "node:stream";
import fs from "fs/promises";

// ... rest of your helper functions stay ...