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
} from "@/db/schema";
import { eq, inArray, asc } from "drizzle-orm";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { v4 as uuid } from "uuid";

/* -------------------------------------------------------------------------- */
/*                                CONFIG                                      */
/* -------------------------------------------------------------------------- */

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

const MODEL = "claude-sonnet-4-20250514";

/* -------------------------------------------------------------------------- */
/*                               SCHEMA                                       */
/* -------------------------------------------------------------------------- */

/**
 * Claude ONLY decides:
 * - which characters appear on each page
 * - which location applies to each page
 *
 * NO prose. NO prompts. NO mood.
 */
const SpreadDecisionSchema = z.object({
  spreadIndex: z.number(),
  left: z.object({
    characterIds: z.array(z.string()),
    locationId: z.string().nullable(),
  }),
  right: z.object({
    characterIds: z.array(z.string()),
    locationId: z.string().nullable(),
  }),
});

const DecisionResponseSchema = z.object({
  spreads: z.array(SpreadDecisionSchema),
});

/* -------------------------------------------------------------------------- */
/*                          SAFE JSON EXTRACTION                               */
/* -------------------------------------------------------------------------- */

function extractJson(raw: string) {
  // Claude sometimes wraps JSON in fences
  const fenced = raw.match(/```json\s*([\s\S]*?)```/i);
  const text = fenced?.[1] ?? raw;

  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");

  if (first === -1 || last === -1) {
    throw new Error("No JSON object found in Claude response");
  }

  const json = text
    .slice(first, last + 1)
    .replace(/,(\s*[}\]])/g, "$1"); // remove trailing commas

  return JSON.parse(json);
}

/* -------------------------------------------------------------------------- */
/*                               FUNCTION                                     */
/* -------------------------------------------------------------------------- */

export const decideScenes = inngest.createFunction(
  { id: "decide-scenes-v4", retries: 2 },
  { event: "story/decide-spread-scenes" },
  async ({ event, step }) => {
    const { storyId } = event.data as { storyId: string };

    console.log("🟣 [decide-scenes] Starting:", storyId);

    /* ------------------------------------------------------------------
       Load spreads
    ------------------------------------------------------------------ */

    const spreads = await db.query.storySpreads.findMany({
      where: eq(storySpreads.storyId, storyId),
      orderBy: asc(storySpreads.spreadIndex),
    });

    if (spreads.length === 0) {
      throw new Error("No spreads found");
    }

    /* ------------------------------------------------------------------
       Load pages
    ------------------------------------------------------------------ */

    const pageIds = spreads
      .flatMap((s) => [s.leftPageId, s.rightPageId])
      .filter(Boolean) as string[];

    const pages = await db.query.storyPages.findMany({
      where: inArray(storyPages.id, pageIds),
    });

    const pageTextById = new Map(
      pages.map((p) => [p.id, p.text ?? ""])
    );

    /* ------------------------------------------------------------------
       Load characters
    ------------------------------------------------------------------ */

    const storyChars = await db.query.storyCharacters.findMany({
      where: eq(storyCharacters.storyId, storyId),
    });

    const chars = storyChars.length
      ? await db.query.characters.findMany({
          where: inArray(
            characters.id,
            storyChars.map((c) => c.characterId)
          ),
        })
      : [];

    /* ------------------------------------------------------------------
       Load locations
    ------------------------------------------------------------------ */

    const storyLocs = await db.query.storyLocations.findMany({
      where: eq(storyLocations.storyId, storyId),
    });

    const locs = storyLocs.length
      ? await db.query.locations.findMany({
          where: inArray(
            locations.id,
            storyLocs.map((l) => l.locationId)
          ),
        })
      : [];

    /* ------------------------------------------------------------------
       Build prompt
    ------------------------------------------------------------------ */

    const spreadText = spreads
      .map((s) => {
        const left = s.leftPageId
          ? pageTextById.get(s.leftPageId) ?? ""
          : "";
        const right = s.rightPageId
          ? pageTextById.get(s.rightPageId) ?? ""
          : "";

        return `
SPREAD ${s.spreadIndex}
LEFT PAGE TEXT:
${left}

RIGHT PAGE TEXT:
${right}
`.trim();
      })
      .join("\n\n");

    const charList = chars
      .map((c) => `${c.name} (${c.id})`)
      .join(", ");

    const locList = locs
      .map((l) => `${l.name} (${l.id})`)
      .join(", ");

    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 1800,
      system: `
You are planning visual scenes for a children's picture book.

For EACH spread:
- Decide which characters appear on the LEFT page
- Decide which characters appear on the RIGHT page
- Choose ONE location per page (or null)

Rules:
- Use ONLY the IDs provided
- Do NOT invent characters or locations
- Return ONLY valid JSON
- No explanations, no prose

Format exactly:
{
  "spreads": [
    {
      "spreadIndex": 1,
      "left": {
        "characterIds": ["uuid"],
        "locationId": "uuid-or-null"
      },
      "right": {
        "characterIds": ["uuid"],
        "locationId": "uuid-or-null"
      }
    }
  ]
}
`.trim(),
      messages: [
        {
          role: "user",
          content: `
CHARACTERS:
${charList || "None"}

LOCATIONS:
${locList || "None"}

${spreadText}
`.trim(),
        },
      ],
    });

    const text = res.content
      .map((p: any) => (p.type === "text" ? p.text : ""))
      .join("\n");

    const parsed = DecisionResponseSchema.parse(
      extractJson(text)
    );

    /* ------------------------------------------------------------------
       Persist spread presence
    ------------------------------------------------------------------ */

    for (const d of parsed.spreads) {
      const spread = spreads.find(
        (s) => s.spreadIndex === d.spreadIndex
      );
      if (!spread) continue;

      const allCharacters = [
        ...d.left.characterIds,
        ...d.right.characterIds,
      ];

      await db.insert(storySpreadPresence).values({
        spreadId: spread.id,
        characters: Array.from(new Set(allCharacters)).map((characterId) => ({
          characterId,
          role: "primary",        // derived (safe default)
          confidence: 0.8,        // deterministic
          reason: "Derived from spread text analysis",
        })),
        primaryLocationId:
          d.left.locationId === d.right.locationId
            ? d.left.locationId
            : d.left.locationId ?? d.right.locationId,
        source: "claude",
        locked: true,
      });
      
    }

    /* ------------------------------------------------------------------
       Mark workflow complete
    ------------------------------------------------------------------ */

    await db
      .update(storyWorkflowProgress)
      .set({
        scenesDecided: true,
        scenesDecidedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(storyWorkflowProgress.storyId, storyId));

    console.log("✅ [decide-scenes] Complete");

    return { ok: true };
  }
);
