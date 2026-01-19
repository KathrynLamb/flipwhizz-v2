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
import { asc, eq, inArray, sql } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import Anthropic from "@anthropic-ai/sdk";

/* ======================================================
   CONFIG
====================================================== */

const MODEL = "claude-sonnet-4-20250514";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

/* ======================================================
   TYPES
====================================================== */

type Prominence = "primary" | "secondary" | "background";

type AiPagePlan = {
  page: "left" | "right";
  location: string;
  characters: {
    name: string;
    prominence: Prominence;
    justification: string;
  }[];
};

type AiSpread = {
  spreadIndex: number;
  pages: AiPagePlan[];
  sceneSummary: string;
};

type AiOutput = {
  spreads: AiSpread[];
};

/* ======================================================
   HELPERS
====================================================== */

function extractText(content: any): string {
  return (Array.isArray(content) ? content : [])
    .map((b) => (b?.type === "text" ? String(b.text ?? "") : ""))
    .filter((t) => t.trim().length > 0)
    .join("\n")
    .trim();
}

function extractJsonSafe(raw: string): any | null {
  if (!raw) return null;

  // Try parsing the whole string first
  try {
    return JSON.parse(raw);
  } catch {}

  // Try finding fenced code blocks
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) {
    try {
      return JSON.parse(fenced[1]);
    } catch {}
  }

  // Try finding the first opening brace
  const firstBrace = raw.indexOf("{");
  const lastBrace = raw.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1) {
    try {
      return JSON.parse(raw.substring(firstBrace, lastBrace + 1));
    } catch {}
  }

  return null;
}

function normalizeProminence(v: any): Prominence {
  return v === "primary" || v === "secondary" || v === "background"
    ? v
    : "background";
}

function normalizeSide(v: any): "left" | "right" | null {
  return v === "left" || v === "right" ? v : null;
}

function buildPairs(pages: { id: string; pageNumber: number; text: string }[]) {
  const pairs: {
    spreadIndex: number;
    left?: typeof pages[number];
    right?: typeof pages[number];
  }[] = [];

  for (let i = 0; i < pages.length; i += 2) {
    pairs.push({
      spreadIndex: pairs.length,
      left: pages[i],
      right: pages[i + 1],
    });
  }

  return pairs;
}

function safeStr(v: any, max = 600) {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

/* ======================================================
   INNGEST FUNCTION — PHASE A
====================================================== */

export const buildSpreadsPhaseA = inngest.createFunction(
  {
    id: "build-spreads-phase-a",
    retries: 1,
    timeouts: { start: "5m", finish: "10m" },
  },
  { event: "story/build-spreads" },
  async ({ event, step }) => {
    const { storyId } = event.data as { storyId: string };

    let shouldUnlockOnFailure = true;

    try {
      /* ---------------- MARK STATUS ---------------- */

      await step.run("mark-building", async () => {
        await db
          .update(stories)
          .set({ status: "building_spreads", updatedAt: new Date() })
          .where(eq(stories.id, storyId));
      });

      /* ---------------- LOAD INPUTS ---------------- */

      const data = await step.run("load-inputs", async () => {
        const pages = await db.query.storyPages.findMany({
          where: eq(storyPages.storyId, storyId),
          orderBy: asc(storyPages.pageNumber),
        });

        if (!pages.length) throw new Error("No pages for build spreads");

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

        return { pages, chars, locs };
      });

      const pairs = buildPairs(
        data.pages.map((p) => ({
          id: p.id,
          pageNumber: p.pageNumber,
          text: String(p.text ?? ""),
        }))
      );

      /* ---------------- CLAUDE ANALYSIS ---------------- */

      const ai = await step.run("claude-analyze", async () => {
        const storyText = pairs
          .map(
            (s) =>
              `SPREAD INDEX ${s.spreadIndex}\n` +
              `LEFT PAGE (${s.left?.pageNumber ?? "none"}):\n${s.left?.text ?? ""}\n\n` +
              `RIGHT PAGE (${s.right?.pageNumber ?? "none"}):\n${s.right?.text ?? ""}`
          )
          .join("\n\n---\n\n");

        // We explicitly define the schema so Claude follows the TS types
        const SCHEMA_DEF = JSON.stringify(
          {
            spreads: [
              {
                spreadIndex: 0,
                sceneSummary:
                  "A description of the visual scene for this spread.",
                pages: [
                  {
                    page: "left", // MUST be "left" or "right"
                    location: "Name of location from list",
                    characters: [
                      {
                        name: "Name of character from list",
                        prominence: "primary", // "primary", "secondary", or "background"
                        justification: "Why they are here",
                      },
                    ],
                  },
                ],
              },
            ],
          },
          null,
          2
        );

        const res = await anthropic.messages.create({
          model: MODEL,
          max_tokens: 8000, // Increased slighty for safety
          system: `
You are a children's picture book story editor.
You must analyze the story text provided and plan the visual descriptions for each spread.

CRITICAL INSTRUCTIONS:
1. Output ONLY valid JSON.
2. Do not include markdown fencing (like \`\`\`json).
3. Use the EXACT schema provided below.
4. Only use Characters and Locations from the provided ALLOWED lists.

TARGET JSON SCHEMA:
${SCHEMA_DEF}
          `.trim(),
          messages: [
            {
              role: "user",
              content: `
ALLOWED CHARACTERS:
${data.chars.map((c) => `- ${c.name}`).join("\n") || "(none)"}

ALLOWED LOCATIONS:
${data.locs.map((l) => `- ${l.name}`).join("\n") || "(none)"}

STORY TEXT TO ANALYZE:
${storyText}
              `.trim(),
            },
          ],
        });

        const raw = extractText(res.content);
        
        // Debug log to catch format issues in Inngest logs
        console.log("DEBUG - CLAUDE RAW OUTPUT:", raw.slice(0, 500) + "...");

        const parsed = extractJsonSafe(raw) as AiOutput | null;

        if (!parsed || !Array.isArray(parsed.spreads)) {
          console.warn("⚠️ Claude JSON malformed — attempting recovery");

          // LAST RESORT: try to recover spread objects manually via Regex
          // This handles cases where Claude might output multiple JSON blocks or malformed arrays
          const recoveredSpreads: AiSpread[] = [];

          const spreadMatches = raw.match(
            /{\s*"spreadIndex"\s*:\s*\d+[\s\S]*?}\s*(?=,?\s*{|\s*]|$)/g
          );

          if (spreadMatches) {
            for (const block of spreadMatches) {
              try {
                // We try to close the object if the regex cut it off (simple heuristic)
                let cleanBlock = block.trim();
                const open = (cleanBlock.match(/{/g) || []).length;
                const close = (cleanBlock.match(/}/g) || []).length;
                if (open > close) cleanBlock += "}".repeat(open - close);

                const s = JSON.parse(cleanBlock);
                if (typeof s?.spreadIndex === "number") {
                  recoveredSpreads.push({
                    spreadIndex: s.spreadIndex,
                    sceneSummary: safeStr(s.sceneSummary, 1200),
                    pages: Array.isArray(s.pages)
                      ? s.pages
                          .map((p: any) => {
                            const side = normalizeSide(p?.page);
                            if (!side) return null;

                            return {
                              page: side,
                              location: safeStr(p?.location, 200),
                              characters: Array.isArray(p?.characters)
                                ? p.characters
                                    .filter(
                                      (c: any) => typeof c?.name === "string"
                                    )
                                    .map((c: any) => ({
                                      name: safeStr(c.name, 200),
                                      prominence: normalizeProminence(
                                        c.prominence
                                      ),
                                      justification: safeStr(
                                        c.justification,
                                        600
                                      ),
                                    }))
                                : [],
                            };
                          })
                          .filter(Boolean)
                      : [],
                  });
                }
              } catch (e) {
                // skip bad block
              }
            }
          }

          if (recoveredSpreads.length === 0) {
            console.error("FAILED JSON:", raw); // Log full raw on failure
            throw new Error("Claude returned unrecoverable JSON");
          }

          console.warn(
            `⚠️ Recovered ${recoveredSpreads.length} spreads from malformed JSON`
          );

          return recoveredSpreads;
        }

        // Standard Parse Success Path
        return parsed.spreads.map((s) => ({
          spreadIndex: s.spreadIndex,
          sceneSummary: safeStr(s.sceneSummary, 1200),
          pages: Array.isArray(s.pages)
            ? s.pages
                .map((p) => {
                  const side = normalizeSide(p.page);
                  if (!side) return null;
                  return {
                    page: side,
                    location: safeStr(p.location, 200),
                    characters: Array.isArray(p.characters)
                      ? p.characters.map((c) => ({
                          name: safeStr(c.name, 200),
                          prominence: normalizeProminence(c.prominence),
                          justification: safeStr(c.justification, 600),
                        }))
                      : [],
                  };
                })
                .filter(Boolean)
            : [],
        }));
      });

      /* ---------------- PERSIST ---------------- */

      await step.run("persist", async () => {
        const charByName = Object.fromEntries(
          data.chars.map((c) => [c.name, c.id])
        );
        const locByName = Object.fromEntries(
          data.locs.map((l) => [l.name, l.id])
        );

        await db.transaction(async (tx) => {
          await tx
            .delete(storySpreads)
            .where(eq(storySpreads.storyId, storyId));

          const pageIds = data.pages.map((p) => p.id);

          if (pageIds.length) {
            await tx
              .delete(storyPageCharacters)
              .where(inArray(storyPageCharacters.pageId, pageIds));

            await tx
              .delete(storyPageLocations)
              .where(inArray(storyPageLocations.pageId, pageIds));
          }

          for (const spread of ai) {
            const pair = pairs.find(
              (p) => p.spreadIndex === spread.spreadIndex
            );
            if (!pair) continue;

            await tx.insert(storySpreads).values({
              id: uuid(),
              storyId,
              spreadIndex: spread.spreadIndex,
              leftPageId: pair.left?.id ?? null,
              rightPageId: pair.right?.id ?? null,
              sceneSummary: spread.sceneSummary,
              createdAt: new Date(),
            });

            for (const pageInfo of spread.pages) {
              if (!pageInfo) continue; // ← TS narrowing
            
              const page =
                pageInfo.page === "left" ? pair.left : pair.right;
            
              if (!page) continue;
            

              const locationId = locByName[pageInfo.location];
              if (locationId) {
                await tx.insert(storyPageLocations).values({
                  id: uuid(),
                  pageId: page.id,
                  locationId,
                  canonical: true,
                  source: "ai",
                  createdAt: new Date(),
                });
              }

              for (const c of pageInfo.characters) {
                const characterId = charByName[c.name];
                if (!characterId) continue;

                await tx.insert(storyPageCharacters).values({
                  id: uuid(),
                  pageId: page.id,
                  characterId,
                  prominence: c.prominence,
                  action: c.justification,
                  canonical: true,
                  source: "ai",
                  createdAt: new Date(),
                });
              }
            }
          }
        });
      });

      /* ---------------- FINALIZE ---------------- */
      
      await step.run("finalize", async () => {
        const [{ count }] = await db
          .select({ count: sql<number>`count(*)` })
          .from(storySpreads)
          .where(eq(storySpreads.storyId, storyId));

        await db
          .update(stories)
          .set({
            status: count > 0 ? "spreads_ready" : "planning",
            updatedAt: new Date(),
          })
          .where(eq(stories.id, storyId));
      });

      shouldUnlockOnFailure = false;

      /* ---------------- DISPATCH PHASE B ---------------- */

      await step.run("dispatch-phase-b", async () => {
        if (!ai.length) return;
        await inngest.send({
          name: "story/generate-spread-images",
          data: { storyId },
        });
      });

      return { ok: true, spreads: ai.length };
    } catch (err) {
      if (shouldUnlockOnFailure) {
        await db
          .update(stories)
          .set({ status: "planning", updatedAt: new Date() })
          .where(eq(stories.id, storyId));
      }
      throw err;
    }
  }
);