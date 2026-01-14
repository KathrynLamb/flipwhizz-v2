// inngest/buildspreads.ts

import { inngest } from "./client";
import { db } from "@/db";
import {
  stories,
  storyPages,
  storySpreads,
  storyPageCharacters,
  storyPageLocations,
  characters,
  locations,
  storyCharacters,
  storyLocations,
} from "@/db/schema";
import { asc, eq, inArray } from "drizzle-orm";
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
   HELPERS
------------------------------------------------------------------ */

const cap = (v: unknown, max: number) =>
  typeof v === "string" ? v.trim().slice(0, max) : null;

const jsonOrNull = (v: unknown) =>
  v && typeof v === "object" ? v : null;


function extractClaudeText(content: any): string {
  return (Array.isArray(content) ? content : [])
    .map((b) => (b?.type === "text" ? String(b.text ?? "") : ""))
    .filter((t) => t.trim().length > 0)
    .join("\n")
    .trim();
}

function extractJson(raw: string): any {
  if (!raw) throw new Error("Empty AI response");

  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = (fenced?.[1] ?? raw).trim();

  const first = candidate.indexOf("{");
  const last = candidate.lastIndexOf("}");
  if (first === -1 || last === -1 || last <= first) {
    throw new Error("No JSON object found");
  }

  return JSON.parse(candidate.slice(first, last + 1));
}

const safe = (v: unknown) => (typeof v === "string" ? v.trim() : "");

type Prominence = "primary" | "secondary" | "background";
const isProminence = (v: any): v is Prominence =>
  v === "primary" || v === "secondary" || v === "background";

type AiSpread = {
  spreadIndex: number;
  characters?: { name: string; prominence?: Prominence }[];
  location?: string;
  sceneSummary?: string;
};

function buildPairs(
  pages: { id: string; pageNumber: number; text: string }[]
) {
  const pairs: {
    index: number;
    pages: { id: string; pageNumber: number; text: string }[];
  }[] = [];

  for (let i = 0; i < pages.length; i += 2) {
    pairs.push({ index: pairs.length, pages: pages.slice(i, i + 2) });
  }

  return pairs;
}

/**
 * Deterministic fallback:
 * - All characters background
 * - First location only
 */
function fallbackSpreads(
  pairs: ReturnType<typeof buildPairs>,
  chars: { name: string }[],
  locs: { name: string }[]
): { spreads: AiSpread[] } {
  const location = locs[0]?.name ?? "";

  return {
    spreads: pairs.map((p) => ({
      spreadIndex: p.index,
      location,
      sceneSummary: `Pages ${p.pages.map((x) => x.pageNumber).join("&")}`,
      characters: chars.map((c) => ({
        name: c.name,
        prominence: "background",
      })),
    })),
  };
}

/* ------------------------------------------------------------------
   JOB: BUILD SPREADS + PAGE PRESENCE (AUTHORITATIVE)
------------------------------------------------------------------ */

export const buildSpreadsJob = inngest.createFunction(
  {
    id: "build-spreads-job",
    retries: 1,
    timeouts: { start: "5m", finish: "5m" },
  },
  { event: "story/build-spreads" },
  async ({ event, step }) => {
    const { storyId } = event.data as { storyId: string };

    /* ---------------- MARK STATUS ---------------- */

    await step.run("mark-building", async () => {
      await db
        .update(stories)
        .set({ status: "building_spreads", updatedAt: new Date() })
        .where(eq(stories.id, storyId));
    });

    /* ---------------- LOAD CANONICAL INPUTS ---------------- */

    const data = await step.run("load-inputs", async () => {
      const pages = await db.query.storyPages.findMany({
        where: eq(storyPages.storyId, storyId),
        orderBy: asc(storyPages.pageNumber),
      });

      const chars = await db
        .select({ id: characters.id, name: characters.name })
        .from(storyCharacters)
        .innerJoin(characters, eq(storyCharacters.characterId, characters.id))
        .where(eq(storyCharacters.storyId, storyId));

      const locs = await db
        .select({ id: locations.id, name: locations.name })
        .from(storyLocations)
        .innerJoin(locations, eq(storyLocations.locationId, locations.id))
        .where(eq(storyLocations.storyId, storyId));

      if (!pages.length) throw new Error("No pages for build-spreads");
      if (!chars.length) throw new Error("No characters for build-spreads");
      if (!locs.length) throw new Error("No locations for build-spreads");

      return { pages, chars, locs };
    });

    const pairs = buildPairs(
      data.pages.map((p) => ({
        id: p.id,
        pageNumber: p.pageNumber,
        text: String(p.text ?? ""),
      }))
    );

    /* ---------------- AI COMPOSITION ---------------- */

    const aiResult = await step.run("ai-compose", async () => {
      const storyText = pairs
        .map(
          (p) =>
            `SPREAD ${p.index}:\n` +
            p.pages.map((pg) => `PAGE ${pg.pageNumber}: ${pg.text}`).join("\n")
        )
        .join("\n\n");

      const system = `
You are a children's picture book scene director.

Rules:
- Use ONLY provided character names
- Use EXACTLY ONE provided location per spread
- Do NOT invent names
- Output ONLY valid JSON

Shape:
{
  "spreads": [
    {
      "spreadIndex": number,
      "characters": [
        { "name": string, "prominence": "primary" | "secondary" | "background" }
      ],
      "location": string,
      "sceneSummary": string
    }
  ]
}
      `.trim();

      try {
        const res = await client.messages.create({
          model: MODEL,
          max_tokens: 2500,
          system,
          messages: [
            {
              role: "user",
              content: `
CHARACTERS:
${data.chars.map((c) => `- ${c.name}`).join("\n")}

LOCATIONS:
${data.locs.map((l) => `- ${l.name}`).join("\n")}

STORY:
${storyText}
              `.trim(),
            },
          ],
        });

        const parsed = extractJson(extractClaudeText(res.content));

        if (!Array.isArray(parsed?.spreads)) {
          throw new Error("Invalid AI spreads");
        }

        return { spreads: parsed.spreads as AiSpread[], source: "ai" as const };
      } catch {
        const fb = fallbackSpreads(pairs, data.chars, data.locs);
        return { spreads: fb.spreads, source: "fallback" as const };
      }
    });

    /* ---------------- PERSIST SPREADS + PRESENCE ---------------- */

    await step.run("persist", async () => {
      const charByName = Object.fromEntries(data.chars.map((c) => [c.name, c.id]));
      const locByName = Object.fromEntries(data.locs.map((l) => [l.name, l.id]));
      const pageIds = data.pages.map((p) => p.id);

      await db.transaction(async (tx) => {
        await tx.delete(storySpreads).where(eq(storySpreads.storyId, storyId));

        if (pageIds.length) {
          await tx
            .delete(storyPageCharacters)
            .where(inArray(storyPageCharacters.pageId, pageIds));
          await tx
            .delete(storyPageLocations)
            .where(inArray(storyPageLocations.pageId, pageIds));
        }

        for (const s of aiResult.spreads) {
          if (typeof s.spreadIndex !== "number") continue;
          const group = pairs[s.spreadIndex];
          if (!group) continue;

          const left = group.pages[0];
          const right = group.pages[1];

          await tx.insert(storySpreads).values({
            id: uuid(),
            storyId,
            spreadIndex: s.spreadIndex, // 🔴 REQUIRED
            leftPageId: left?.id ?? null,
            rightPageId: right?.id ?? null,
            sceneSummary: safe(s.sceneSummary) || null,
            createdAt: new Date(),
          });

          const locationId = locByName[safe(s.location)];

          for (const page of group.pages) {
            for (const c of s.characters ?? []) {
              const characterId = charByName[safe(c.name)];
              if (!characterId) continue;

              await tx.insert(storyPageCharacters).values({
                id: uuid(),
                pageId: page.id,
                characterId,
                prominence: isProminence(c.prominence)
                  ? c.prominence
                  : "background",
                source: aiResult.source,
                createdAt: new Date(),
              });
            }

            if (locationId) {
              await tx.insert(storyPageLocations).values({
                id: uuid(),
                pageId: page.id,
                locationId,
                source: aiResult.source,
                createdAt: new Date(),
              });
            }
          }
        }
      });
    });

    /* ---------------- FINALIZE ---------------- */

    await step.run("finalize", async () => {
      await db
        .update(stories)
        .set({ status: "spreads_ready", updatedAt: new Date() })
        .where(eq(stories.id, storyId));
    });

    return { ok: true, source: aiResult.source };
  }
);
