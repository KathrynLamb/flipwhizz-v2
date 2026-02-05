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
import { v4 as uuid } from "uuid";

/* -------------------------------------------------------------------------- */
/*                                   CONFIG                                   */
/* -------------------------------------------------------------------------- */

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

const MODEL = "claude-sonnet-4-20250514";

/* -------------------------------------------------------------------------- */
/*                         CLAUDE TOOL (HARD CONTRACT)                         */
/* -------------------------------------------------------------------------- */

const decideSpreadScenesTool: Anthropic.Tool = {
  name: "decide_spread_scenes",
  description:
    "Assign characters and locations to the left and right page of each spread",
  input_schema: {
    type: "object", // 👈 literal
    required: ["spreads"],
    properties: {
      spreads: {
        type: "array",
        items: {
          type: "object", // 👈 literal
          required: ["spreadIndex", "left", "right"],
          properties: {
            spreadIndex: { type: "number" },
            left: {
              type: "object",
              required: ["characterIds", "locationId"],
              properties: {
                characterIds: {
                  type: "array",
                  items: { type: "string" },
                },
                locationId: { type: ["string", "null"] },
              },
            },
            right: {
              type: "object",
              required: ["characterIds", "locationId"],
              properties: {
                characterIds: {
                  type: "array",
                  items: { type: "string" },
                },
                locationId: { type: ["string", "null"] },
              },
            },
          },
        },
      },
    },
  },
};


/* -------------------------------------------------------------------------- */
/*                               INNGEST STEP                                 */
/* -------------------------------------------------------------------------- */

export const decideScenes = inngest.createFunction(
  { id: "decide-scenes-v4", retries: 2 },
  { event: "story/decide-spread-scenes" },
  async ({ event, step }) => {
    const { storyId } = event.data as { storyId: string };

    console.log("🟣 [decide-scenes] Starting:", storyId);

    /* ------------------------------------------------------------------ */
    /* Load spreads                                                        */
    /* ------------------------------------------------------------------ */

    const spreads = await db.query.storySpreads.findMany({
      where: eq(storySpreads.storyId, storyId),
      orderBy: asc(storySpreads.spreadIndex),
    });

    if (!spreads.length) {
      throw new Error("No spreads found");
    }

    const spreadByIndex = new Map(
      spreads.map((s) => [s.spreadIndex, s])
    );

    /* ------------------------------------------------------------------ */
    /* Load page text                                                      */
    /* ------------------------------------------------------------------ */

    const pageIds = spreads
      .flatMap((s) => [s.leftPageId, s.rightPageId])
      .filter(Boolean) as string[];

    const pages = await db.query.storyPages.findMany({
      where: inArray(storyPages.id, pageIds),
    });

    const pageText = new Map(
      pages.map((p) => [p.id, p.text ?? ""])
    );

    /* ------------------------------------------------------------------ */
    /* Load characters                                                     */
    /* ------------------------------------------------------------------ */

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

    /* ------------------------------------------------------------------ */
    /* Load locations                                                      */
    /* ------------------------------------------------------------------ */

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

    /* ------------------------------------------------------------------ */
    /* Build Claude input                                                  */
    /* ------------------------------------------------------------------ */

    const spreadText = spreads
      .map((s) => {
        const left = s.leftPageId
          ? pageText.get(s.leftPageId) ?? ""
          : "";
        const right = s.rightPageId
          ? pageText.get(s.rightPageId) ?? ""
          : "";

        return `
SPREAD ${s.spreadIndex}

LEFT PAGE:
${left}

RIGHT PAGE:
${right}
`.trim();
      })
      .join("\n\n");

    const characterList = chars
      .map((c) => `${c.name} (${c.id})`)
      .join(", ");

    const locationList = locs
      .map((l) => `${l.name} (${l.id})`)
      .join(", ");

    /* ------------------------------------------------------------------ */
    /* Claude (TOOLS — NO JSON PARSING)                                    */
    /* ------------------------------------------------------------------ */

    const result = await client.messages.create({
      model: MODEL,
      max_tokens: 1800,
      tools: [decideSpreadScenesTool],
      tool_choice: {
        type: "tool",
        name: "decide_spread_scenes",
      },
      system: `
You are performing a STRUCTURAL planning task.

Rules:
- Use ONLY the IDs provided
- Do NOT invent anything
- Do NOT explain
- Output ONLY via the provided tool
- Every spreadIndex must be included exactly once
`.trim(),
      messages: [
        {
          role: "user",
          content: `
CHARACTERS:
${characterList || "None"}

LOCATIONS:
${locationList || "None"}

${spreadText}
`.trim(),
        },
      ],
    });

    const toolUse = result.content.find(
      (c) =>
        c.type === "tool_use" &&
        c.name === "decide_spread_scenes"
    ) as
      | {
          type: "tool_use";
          input: {
            spreads: Array<{
              spreadIndex: number;
              left: {
                characterIds: string[];
                locationId: string | null;
              };
              right: {
                characterIds: string[];
                locationId: string | null;
              };
            }>;
          };
        }
      | undefined;

    if (!toolUse) {
      throw new Error("Claude did not return tool output");
    }

    /* ------------------------------------------------------------------ */
    /* Persist                                                            */
    /* ------------------------------------------------------------------ */

    for (const decision of toolUse.input.spreads) {
      const spread = spreadByIndex.get(decision.spreadIndex);
      if (!spread) {
        throw new Error(
          `Invalid spreadIndex ${decision.spreadIndex}`
        );
      }

      const allCharacterIds = Array.from(
        new Set([
          ...decision.left.characterIds,
          ...decision.right.characterIds,
        ])
      );

      await db.insert(storySpreadPresence).values({
        id: uuid(),
        spreadId: spread.id,
        characters: allCharacterIds.map((characterId) => ({
          characterId,
          role: "primary",
          confidence: 0.8,
          reason: "Derived from spread text",
        })),
        primaryLocationId:
          decision.left.locationId === decision.right.locationId
            ? decision.left.locationId
            : decision.left.locationId ??
              decision.right.locationId,
        source: "claude",
        locked: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    /* ------------------------------------------------------------------ */
    /* Mark workflow complete                                              */
    /* ------------------------------------------------------------------ */

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
