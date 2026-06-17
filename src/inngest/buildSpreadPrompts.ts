// src/inngest/buildSpreadPrompts.ts
//
// Phase between decideSpreadScenes and generateBookSpreads.
// Claude acts as art director: reads assigned characters + locations + page text,
// writes a locked illustration brief per spread into story_spread_scene.
// generateBookSpreads hard-fails if this record is missing.
//
// FIX: Auto-populates story_spread_presence when rows are missing entirely,
// instead of silently passing the guard and producing characterless scene records.

import { inngest } from "@/inngest/client";
import { db } from "@/db";
import {
  storySpreads,
  storyPages,
  storySpreadPresence,
  storySpreadScene,
  characters,
  storyCharacters,
  locations,
  storyStyleGuide,
  storyWorkflowProgress,
} from "@/db/schema";
import { eq, inArray, asc } from "drizzle-orm";
import Anthropic from "@anthropic-ai/sdk";
import { v4 as uuid } from "uuid";

/* -------------------------------------------------------------------------- */
/*                                  CONFIG                                    */
/* -------------------------------------------------------------------------- */

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
const MODEL = "claude-sonnet-4-6";

const MAX_PRIMARY_CHARACTERS = 3;

/* -------------------------------------------------------------------------- */
/*                               TOOL SCHEMA                                  */
/* -------------------------------------------------------------------------- */

const buildSpreadPromptsTool: Anthropic.Tool = {
  name: "build_spread_prompts",
  description:
    "Write a locked illustration brief for every spread in the story. " +
    "You are acting as art director. Each brief must be specific enough that " +
    "Gemini can generate a consistent, accurate double-page spread illustration.",
  input_schema: {
    type: "object",
    required: ["spreads"],
    properties: {
      spreads: {
        type: "array",
        items: {
          type: "object",
          required: [
            "spreadIndex",
            "sceneSummary",
            "illustrationPrompt",
            "compositionNotes",
            "mood",
            "doNotInclude",
            "negativePrompt",
          ],
          properties: {
            spreadIndex: {
              type: "number",
              description: "The 1-based spread index",
            },
            sceneSummary: {
              type: "string",
              description:
                "1-2 sentences. Human-readable summary of what is happening in this spread. Used for admin audit.",
            },
            illustrationPrompt: {
              type: "string",
              description:
                "The core scene direction sent to Gemini. 3-5 sentences. " +
                "Describe: what is happening, where, what the featured characters are doing, " +
                "the emotional register of the scene, any key visual elements. " +
                "Do NOT name characters — Gemini receives their portrait images separately. " +
                "Refer to them by role (e.g. 'the boy', 'the cat', 'the twin girl'). " +
                "Be specific about action and spatial relationships.",
            },
            compositionNotes: {
              type: "array",
              description:
                "2-4 short, specific composition instructions. E.g. 'Wide establishing shot', " +
                "'Character fills left page foreground', 'Looking toward each other across the spine', " +
                "'Low angle looking up at the bookshelf'. These guide Gemini's framing.",
              items: { type: "string" },
            },
            mood: {
              type: "string",
              description:
                "Single word or very short phrase capturing the emotional tone of this spread. " +
                "E.g. 'tentative curiosity', 'warm triumph', 'gentle melancholy', 'playful chaos'.",
            },
            doNotInclude: {
              type: "array",
              description:
                "Names of any characters assigned to this story who must NOT appear in this spread. " +
                "If a character has no role in this scene, list them here so Gemini doesn't invent their presence.",
              items: { type: "string" },
            },
            negativePrompt: {
              type: "string",
              description:
                "Scene-specific things to avoid in this illustration. " +
                "E.g. 'no indoor furniture — this is an outdoor scene', 'no other children visible', " +
                "'avoid dark shadows — this is a bright cheerful morning'. " +
                "Short, 1-2 sentences max.",
            },
          },
        },
      },
    },
  },
};

/* -------------------------------------------------------------------------- */
/*                                  TYPES                                     */
/* -------------------------------------------------------------------------- */

type SpreadBrief = {
  spreadIndex: number;
  sceneSummary: string;
  illustrationPrompt: string;
  compositionNotes: string[];
  mood: string;
  doNotInclude: string[];
  negativePrompt: string;
};

type ToolInput = { spreads: SpreadBrief[] };

type SpreadPresenceCharacter = {
  characterId: string;
  role: string;
};

type SpreadPresenceLocation = {
  locationId: string;
  role: string;
};

/* -------------------------------------------------------------------------- */
/*                                 VALIDATION                                 */
/* -------------------------------------------------------------------------- */

function isValidToolInput(v: unknown): v is ToolInput {
  if (!v || typeof v !== "object") return false;
  const { spreads } = v as { spreads?: unknown };
  if (!Array.isArray(spreads)) return false;
  for (const s of spreads) {
    if (typeof s !== "object" || !s) return false;
    const b = s as Record<string, unknown>;
    if (typeof b.spreadIndex !== "number") return false;
    if (typeof b.sceneSummary !== "string") return false;
    if (typeof b.illustrationPrompt !== "string") return false;
    if (!Array.isArray(b.compositionNotes)) return false;
    if (typeof b.mood !== "string") return false;
    if (!Array.isArray(b.doNotInclude)) return false;
    if (typeof b.negativePrompt !== "string") return false;
  }
  return true;
}

function extractToolInput(result: Anthropic.Messages.Message): unknown {
  const toolUse = result.content.find(
    (c) => c.type === "tool_use" && c.name === "build_spread_prompts"
  ) as { input?: unknown } | undefined;
  return toolUse?.input ?? null;
}

/* -------------------------------------------------------------------------- */
/*                              INNGEST FUNCTION                              */
/* -------------------------------------------------------------------------- */

export const buildSpreadPrompts = inngest.createFunction(
  {
    id: "build-spread-prompts",
    retries: 2,
    timeouts: { finish: "10m" },       // ← give Claude room to breathe
    concurrency: { limit: 3 },          // ← max 3 stories at once
    triggers: [{ event: "story/build-spread-prompts" }],
  },
  async ({ event, step }) => {
    const { storyId } = event.data as { storyId: string };
    if (!storyId) throw new Error("storyId required");

    console.log("🟡 [build-spread-prompts] Starting:", storyId);

    /* ------------------------------------------------------------------ */
    /* Load spreads                                                        */
    /* ------------------------------------------------------------------ */

    const spreads = await step.run("load-spreads", async () => {
      return db.query.storySpreads.findMany({
        where: eq(storySpreads.storyId, storyId),
        orderBy: asc(storySpreads.spreadIndex),
      });
    });

    if (!spreads.length) throw new Error("No spreads found — run build-spreads first");

    const expectedIndexes = spreads.map((s) => s.spreadIndex).sort((a, b) => a - b);

    /* ------------------------------------------------------------------ */
    /* Load page text                                                      */
    /* ------------------------------------------------------------------ */

    const pageIds = spreads
      .flatMap((s) => [s.leftPageId, s.rightPageId])
      .filter(Boolean) as string[];

    const pages = await step.run("load-pages", async () => {
      return db.query.storyPages.findMany({
        where: inArray(storyPages.id, pageIds),
      });
    });

    const pageText = new Map(pages.map((p) => [p.id, p.text ?? ""]));

    /* ------------------------------------------------------------------ */
    /* Load spread presence — auto-populate if entirely missing           */
    /* ------------------------------------------------------------------ */

    let presenceRows = await step.run("load-spread-presence", async () => {
      return db.query.storySpreadPresence.findMany({
        where: inArray(
          storySpreadPresence.spreadId,
          spreads.map((s) => s.id)
        ),
      });
    });

    // SAFEGUARD: Auto-populate presence if rows are missing entirely OR all rows have
    // empty characters arrays. Covers two failure modes:
    //   1. decideSpreadScenes never ran → zero rows
    //   2. decideSpreadScenes ran but wrote empty arrays → rows exist but useless
    const allEmpty =
      presenceRows.length === 0 ||
      presenceRows.every(
        (r) => !r.characters || (r.characters as SpreadPresenceCharacter[]).length === 0
      );

    if (allEmpty) {
      console.warn(
        `⚠️ [build-spread-prompts] Presence rows missing or all empty for story ${storyId}. ` +
          `Auto-populating all story characters as primary across all spreads.`
      );

      presenceRows = await step.run("auto-populate-presence", async () => {
        const storyCharRows = await db.query.storyCharacters.findMany({
          where: eq(storyCharacters.storyId, storyId),
        });

        if (storyCharRows.length === 0) {
          throw new Error(
            `Cannot auto-populate presence: no storyCharacters found for story ${storyId}`
          );
        }
        const defaultCharacters: SpreadPresenceCharacter[] = storyCharRows.map(
          (sc, index) => ({
            characterId: sc.characterId,
            role: index < MAX_PRIMARY_CHARACTERS ? "primary" : "background",
          })
        );

        console.log(
          `  ↳ Auto-populating ${spreads.length} spreads with ${defaultCharacters.length} characters: ` +
            defaultCharacters.map((c) => c.characterId).join(", ")
        );

        for (const spread of spreads) {
          await db
            .insert(storySpreadPresence)
            .values({
              id: uuid(),
              spreadId: spread.id,
              characters: defaultCharacters,
              locations: [],
              createdAt: new Date(),
              updatedAt: new Date(),
            })
            .onConflictDoUpdate({
              target: storySpreadPresence.spreadId,
              set: {
                characters: defaultCharacters,
                updatedAt: new Date(),
              },
            });
        }

        // Reload to confirm writes
        const reloaded = await db.query.storySpreadPresence.findMany({
          where: inArray(
            storySpreadPresence.spreadId,
            spreads.map((s) => s.id)
          ),
        });

        const stillEmpty = reloaded.filter(
          (r) => !r.characters || (r.characters as SpreadPresenceCharacter[]).length === 0
        );

        if (reloaded.length === 0 || stillEmpty.length === reloaded.length) {
          throw new Error(
            `Auto-populate presence failed: rows still empty after upsert for story ${storyId}`
          );
        }

        console.log(
          `  ✅ Auto-populated ${reloaded.length}/${spreads.length} presence rows`
        );
        return reloaded;
      });
    }

    // SAFEGUARD: Warn if some (but not all) spreads still have empty presence
    const emptyPresence = presenceRows.filter(
      (r) => !r.characters || (r.characters as SpreadPresenceCharacter[]).length === 0
    );
    if (emptyPresence.length > 0) {
      console.warn(
        `⚠️ ${emptyPresence.length} spread(s) have empty character presence — will use text-only direction`
      );
    }

    const presenceBySpreadId = new Map(presenceRows.map((p) => [p.spreadId, p]));

    /* ------------------------------------------------------------------ */
    /* Load character details                                              */
    /* ------------------------------------------------------------------ */

    const allCharacterIds = [
      ...new Set(
        presenceRows.flatMap((p) => {
          const chars = (p.characters ?? []) as SpreadPresenceCharacter[];
          return chars.map((c) => c.characterId);
        })
      ),
    ];

    const charRecords = await step.run("load-characters", async () => {
      if (allCharacterIds.length === 0) return [];
      return db.query.characters.findMany({
        where: inArray(characters.id, allCharacterIds),
      });
    });

    const charById = new Map(charRecords.map((c) => [c.id, c]));

    /* ------------------------------------------------------------------ */
    /* Load location details                                               */
    /* ------------------------------------------------------------------ */

    const allLocationIds = [
      ...new Set(
        presenceRows.flatMap((p) => {
          const locs = (p.locations ?? []) as SpreadPresenceLocation[];
          return locs.map((l) => l.locationId);
        })
      ),
    ];

    const locRecords = await step.run("load-locations", async () => {
      if (allLocationIds.length === 0) return [];
      return db.query.locations.findMany({
        where: inArray(locations.id, allLocationIds),
      });
    });

    const locById = new Map(locRecords.map((l) => [l.id, l]));

    /* ------------------------------------------------------------------ */
    /* Load style guide                                                    */
    /* ------------------------------------------------------------------ */

    const style = await step.run("load-style", async () => {
      return db.query.storyStyleGuide.findFirst({
        where: eq(storyStyleGuide.storyId, storyId),
      });
    });

    /* ------------------------------------------------------------------ */
    /* Build Claude system prompt                                          */
    /* ------------------------------------------------------------------ */

    const styleDescription = [
      style?.artStyle,
      style?.userNotes,
      style?.visualThemes,
    ]
      .filter(Boolean)
      .join(". ") || "Whimsical, warm children's book illustration";

    const allCharacterDescriptions = charRecords
      .map((c) => {
        const species = c.species !== "human" ? ` (${c.breed || c.species})` : "";
        return [
          `CHARACTER: ${c.name}${species}`,
          c.appearance ? `APPEARANCE: ${c.appearance}` : null,
          c.description ? `PERSONALITY/ROLE: ${c.description}` : null,
        ]
          .filter(Boolean)
          .join("\n");
      })
      .join("\n\n");

    const allLocationDescriptions = locRecords
      .map((l) => {
        return [
          `LOCATION: ${l.name}`,
          l.description ? `DESCRIPTION: ${l.description}` : null,
        ]
          .filter(Boolean)
          .join("\n");
      })
      .join("\n\n");

    const systemPrompt = `
You are art director for a personalised children's picture book.

Your job is to write a locked illustration brief for every double-page spread.
These briefs will be passed directly to an AI image generator (Gemini) alongside
portrait reference images of the characters. Your briefs must be specific,
consistent, and match the emotional arc of the story.

ILLUSTRATION STYLE FOR THIS BOOK:
${styleDescription}

ALL CHARACTERS IN THIS STORY:
${allCharacterDescriptions || "No character details available."}

ALL LOCATIONS IN THIS STORY:
${allLocationDescriptions || "No location details available."}

IMPORTANT RULES:
- In illustrationPrompt, refer to characters by role/description only (e.g. "the boy", "the tuxedo cat", "the twin girl with pigtails"). Do NOT use their names — the image generator receives their portrait photos as visual reference and names add noise.
- In doNotInclude, USE their actual names — this list is used to explicitly exclude characters from the Gemini prompt.
- Keep illustrationPrompt focused on action, setting, and emotion — not on style (style is handled separately).
- compositionNotes should be concrete framing instructions, not vague adjectives.
- negativePrompt should be scene-specific (what's wrong for THIS spread) not generic avoid lists.
- Every spreadIndex from the input must appear exactly once in your output.
- You must call the build_spread_prompts tool. Do not respond in plain text.
`.trim();

    /* ------------------------------------------------------------------ */
    /* Build per-spread context for Claude                                 */
    /* ------------------------------------------------------------------ */

    const spreadContexts = spreads.map((s) => {
      const presence = presenceBySpreadId.get(s.id);
      const chars = (presence?.characters ?? []) as SpreadPresenceCharacter[];
      const locs = (presence?.locations ?? []) as SpreadPresenceLocation[];

      const featuredChars = chars
        .filter((c) => c.role === "primary")
        .map((c) => {
          const char = charById.get(c.characterId);
          return char
            ? `${char.name} (${char.species !== "human" ? char.breed || char.species : "human"})`
            : c.characterId;
        });

      const backgroundChars = chars
        .filter((c) => c.role === "background")
        .map((c) => charById.get(c.characterId)?.name ?? c.characterId);

      const absentChars = charRecords
        .filter((c) => !chars.some((pc) => pc.characterId === c.id))
        .map((c) => c.name);

      const primaryLoc = locs.find((l) => l.role === "primary");
      const locName = primaryLoc
        ? locById.get(primaryLoc.locationId)?.name ?? "unknown location"
        : "unspecified location";

      const leftText = s.leftPageId ? pageText.get(s.leftPageId) ?? "" : "";
      const rightText = s.rightPageId ? pageText.get(s.rightPageId) ?? "" : "";

      return [
        `SPREAD ${s.spreadIndex}`,
        `FEATURED CHARACTERS: ${featuredChars.length ? featuredChars.join(", ") : "none"}`,
        `BACKGROUND CHARACTERS: ${backgroundChars.length ? backgroundChars.join(", ") : "none"}`,
        `NOT IN THIS SPREAD: ${absentChars.length ? absentChars.join(", ") : "none"}`,
        `PRIMARY LOCATION: ${locName}`,
        `LEFT PAGE TEXT:\n${leftText}`,
        `RIGHT PAGE TEXT:\n${rightText}`,
      ].join("\n");
    });

    const userPrompt = `
SPREAD INDEXES THAT MUST EACH APPEAR EXACTLY ONCE: ${expectedIndexes.join(", ")}

${spreadContexts.join("\n\n---\n\n")}
`.trim();

    /* ------------------------------------------------------------------ */
    /* Call Claude                                                         */
    /* ------------------------------------------------------------------ */

    const firstResult = await step.run("build-with-claude", async () => {
      console.log(`🤖 Calling Claude for ${spreads.length} spread briefs...`);
      return client.messages.create({
        model: MODEL,
        max_tokens: 8000,
        tools: [buildSpreadPromptsTool],
        tool_choice: { type: "tool", name: "build_spread_prompts" },
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      });
    });

    let rawToolInput = extractToolInput(firstResult);

    if (!rawToolInput) {
      throw new Error("Claude did not return tool output");
    }

    // Retry if invalid
    if (!isValidToolInput(rawToolInput)) {
      console.warn("⚠️ Invalid first tool output — attempting repair...");

      const repairedResult = await step.run("repair-tool-output", async () => {
        return client.messages.create({
          model: MODEL,
          max_tokens: 8000,
          tools: [buildSpreadPromptsTool],
          tool_choice: { type: "tool", name: "build_spread_prompts" },
          system: systemPrompt,
          messages: [
            { role: "user", content: userPrompt },
            {
              role: "user",
              content: `Your previous tool output was invalid. Required spread indexes: ${expectedIndexes.join(", ")}. Every spread must have all required fields. Call build_spread_prompts again with valid output.`,
            },
          ],
        });
      });

      rawToolInput = extractToolInput(repairedResult);
    }

    if (!isValidToolInput(rawToolInput)) {
      throw new Error("Claude returned invalid tool output twice — aborting");
    }

    // Validate spread indexes
    const returnedIndexes = rawToolInput.spreads
      .map((s) => s.spreadIndex)
      .sort((a, b) => a - b);

    if (JSON.stringify(returnedIndexes) !== JSON.stringify(expectedIndexes)) {
      throw new Error(
        `Spread index mismatch. Expected: ${expectedIndexes.join(", ")}, got: ${returnedIndexes.join(", ")}`
      );
    }

    /* ------------------------------------------------------------------ */
    /* Persist to story_spread_scene                                       */
    /* ------------------------------------------------------------------ */

    const spreadByIndex = new Map(spreads.map((s) => [s.spreadIndex, s]));

    await step.run("save-spread-scenes", async () => {
      console.log(`📝 Saving ${rawToolInput!.spreads.length} spread scene records...`);

      for (const brief of (rawToolInput as ToolInput).spreads) {
        const spread = spreadByIndex.get(brief.spreadIndex);
        if (!spread) throw new Error(`No spread found for index ${brief.spreadIndex}`);

        const values = {
          id: uuid(),
          spreadId: spread.id,
          sceneSummary: brief.sceneSummary.trim(),
          illustrationPrompt: brief.illustrationPrompt.trim(),
          compositionNotes: brief.compositionNotes.filter(Boolean),
          mood: brief.mood.trim(),
          doNotInclude: brief.doNotInclude.filter(Boolean),
          negativePrompt: brief.negativePrompt.trim(),
          source: "claude" as const,
          locked: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        await db
          .insert(storySpreadScene)
          .values(values)
          .onConflictDoUpdate({
            target: storySpreadScene.spreadId,
            set: {
              sceneSummary: values.sceneSummary,
              illustrationPrompt: values.illustrationPrompt,
              compositionNotes: values.compositionNotes,
              mood: values.mood,
              doNotInclude: values.doNotInclude,
              negativePrompt: values.negativePrompt,
              updatedAt: new Date(),
            },
          });

        console.log(
          `  ✅ Spread ${brief.spreadIndex}: "${brief.mood}" — ${brief.illustrationPrompt.slice(0, 80)}...`
        );
      }

      console.log(`✅ All ${(rawToolInput as ToolInput).spreads.length} scene records saved`);
    });

    /* ------------------------------------------------------------------ */
    /* Validate all records exist before triggering generation             */
    /* ------------------------------------------------------------------ */

    await step.run("validate-scene-records", async () => {
      const sceneRows = await db.query.storySpreadScene.findMany({
        where: inArray(
          storySpreadScene.spreadId,
          spreads.map((s) => s.id)
        ),
      });

      const missingCount = spreads.length - sceneRows.length;
      if (missingCount > 0) {
        throw new Error(
          `Scene record validation failed: ${missingCount} spread(s) still missing story_spread_scene records. ` +
            `Generation blocked.`
        );
      }

      const emptyPrompts = sceneRows.filter(
        (r) => !r.illustrationPrompt || r.illustrationPrompt.trim().length < 10
      );
      if (emptyPrompts.length > 0) {
        throw new Error(
          `${emptyPrompts.length} spread(s) have empty or trivial illustration prompts. ` +
            `Generation blocked.`
        );
      }

      console.log(
        `✅ Scene validation passed: ${sceneRows.length}/${spreads.length} spreads have locked prompts`
      );
    });

    /* ------------------------------------------------------------------ */
    /* Mark complete + trigger generation                                  */
    /* ------------------------------------------------------------------ */

    await step.run("trigger-generation", async () => {
      await db
        .update(storyWorkflowProgress)
        .set({
          promptsBuilt: true,
          promptsBuiltAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(storyWorkflowProgress.storyId, storyId));

      await inngest.send({
        name: "story/generate-spreads",
        data: { storyId },
      });

      console.log("🚀 Triggered story/generate-spreads");
    });

    console.log("✅ [build-spread-prompts] Complete");

    return {
      ok: true,
      spreadsProcessed: rawToolInput.spreads.length,
    };
  }
);