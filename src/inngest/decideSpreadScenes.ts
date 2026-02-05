import { inngest } from "@/inngest/client";
import { db } from "@/db";
import {
  storySpreads,
  storyPages,
  storyCharacters,
  storyLocations,
  characters,
  locations,
  storyWorkflowProgress,
  storySpreadPresence,
  storySpreadScene,
} from "@/db/schema";
import { eq, inArray, asc } from "drizzle-orm";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

/* ======================================================
   CONFIG
====================================================== */

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

const MODEL = "claude-sonnet-4-20250514";

/* ======================================================
   ZOD CONTRACT (SOURCE OF TRUTH)
====================================================== */

const SpreadDecisionSchema = z.object({
  spreadIndex: z.number(),
  characterIds: z.array(z.string()),
  primaryLocationId: z.string().nullable(),
  sceneSummary: z.string(),
  illustrationPrompt: z.string(),
  mood: z.string(),
});

const DecisionResponseSchema = z.object({
  spreads: z.array(SpreadDecisionSchema),
});

/* ======================================================
   SAFE JSON EXTRACTION (CLAUDE)
====================================================== */

function extractJson(raw: string): unknown {
  const fenced = raw.match(/```json\s*([\s\S]*?)```/i);
  const text = (fenced?.[1] ?? raw).trim();

  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");

  if (first === -1 || last === -1) {
    throw new Error("No JSON object found in Claude response");
  }

  const cleaned = text
    .slice(first, last + 1)
    .replace(/,(\s*[}\]])/g, "$1"); // remove trailing commas

  return JSON.parse(cleaned);
}

/* ======================================================
   INNGEST FUNCTION
====================================================== */

export const decideScenes = inngest.createFunction(
  { id: "decide-scenes-v2", retries: 2 },
  { event: "story/decide-spread-scenes" },
  async ({ event }) => {
    const { storyId } = event.data as { storyId: string };

    /* --------------------------------------------------
       1. Load spreads
    -------------------------------------------------- */

    const spreads = await db.query.storySpreads.findMany({
      where: eq(storySpreads.storyId, storyId),
      orderBy: asc(storySpreads.spreadIndex),
    });

    if (spreads.length === 0) {
      throw new Error("No spreads found for story");
    }

    const spreadByIndex = new Map(
      spreads.map((s) => [s.spreadIndex, s])
    );

    /* --------------------------------------------------
       2. Load pages
    -------------------------------------------------- */

    const pageIds = spreads
      .flatMap((s) => [s.leftPageId, s.rightPageId])
      .filter((v): v is string => Boolean(v));

    const pages = await db.query.storyPages.findMany({
      where: inArray(storyPages.id, pageIds),
    });

    const pageMap = new Map(
      pages.map((p) => [p.id, p.text ?? ""])
    );

    /* --------------------------------------------------
       3. Load characters
    -------------------------------------------------- */

    const storyChars = await db.query.storyCharacters.findMany({
      where: eq(storyCharacters.storyId, storyId),
    });

    const chars =
      storyChars.length === 0
        ? []
        : await db.query.characters.findMany({
            where: inArray(
              characters.id,
              storyChars.map((c) => c.characterId)
            ),
          });

    /* --------------------------------------------------
       4. Load locations
    -------------------------------------------------- */

    const storyLocs = await db.query.storyLocations.findMany({
      where: eq(storyLocations.storyId, storyId),
    });

    const locs =
      storyLocs.length === 0
        ? []
        : await db.query.locations.findMany({
            where: inArray(
              locations.id,
              storyLocs.map((l) => l.locationId)
            ),
          });

    /* --------------------------------------------------
       5. Build Claude prompt
    -------------------------------------------------- */

    const spreadText = spreads
      .map((s) => {
        const left = s.leftPageId
          ? pageMap.get(s.leftPageId) ?? ""
          : "";
        const right = s.rightPageId
          ? pageMap.get(s.rightPageId) ?? ""
          : "";

        return `SPREAD ${s.spreadIndex}
LEFT: ${left}
RIGHT: ${right}`;
      })
      .join("\n\n");

    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 2000,
      system: `
You are planning illustrations for a children's picture book.

For EACH spread:
- Decide which characters appear (IDs only)
- Choose ONE primary location ID or null
- Write a short scene summary
- Write a vivid illustration prompt
- Choose a simple mood word

Return ONLY valid JSON in this format:
{
  "spreads": [
    {
      "spreadIndex": 1,
      "characterIds": ["uuid"],
      "primaryLocationId": "uuid-or-null",
      "sceneSummary": "...",
      "illustrationPrompt": "...",
      "mood": "warm"
    }
  ]
}
`.trim(),
      messages: [
        {
          role: "user",
          content: `
Characters:
${chars.map((c) => `${c.name} (${c.id})`).join(", ")}

Locations:
${locs.map((l) => `${l.name} (${l.id})`).join(", ")}

${spreadText}
`.trim(),
        },
      ],
    });

    const text = res.content
    .filter((p) => p.type === "text")
    .map((p) => (p as any).text as string)
    .join("\n");
  

    const parsed = DecisionResponseSchema.parse(extractJson(text));

    /* --------------------------------------------------
       6. Persist (SCHEMA-SAFE)
    -------------------------------------------------- */

    for (const d of parsed.spreads) {
      const spread = spreadByIndex.get(d.spreadIndex);
      if (!spread) continue;

      await db.insert(storySpreadPresence).values({
        spreadId: spread.id,
        primaryLocationId: d.primaryLocationId,
        characters: d.characterIds.map((id) => ({
          characterId: id,
          role: "primary",          // schema-required
          confidence: 1,             // schema-required
          reason: "Present in scene" // schema-required
        })),
        source: "claude",
        locked: true,
      });

      await db.insert(storySpreadScene).values({
        spreadId: spread.id,
        sceneSummary: d.sceneSummary,
        illustrationPrompt: d.illustrationPrompt,
        mood: d.mood,
      });
    }

    /* --------------------------------------------------
       7. Mark workflow complete
    -------------------------------------------------- */

    await db
      .update(storyWorkflowProgress)
      .set({
        scenesDecided: true,
        scenesDecidedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(storyWorkflowProgress.storyId, storyId));

    return { ok: true };
  }
);
