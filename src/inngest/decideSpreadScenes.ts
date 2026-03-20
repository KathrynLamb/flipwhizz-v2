// src/inngest/decideScenes.ts
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
  description: "Assign characters and locations to each spread in the story",
  input_schema: {
    type: "object",
    required: ["spreads"],
    properties: {
      spreads: {
        type: "array",
        items: {
          type: "object",
          required: ["spreadIndex", "characterIds"],
          properties: {
            spreadIndex: {
              type: "number",
              description: "The spread number (1-based index)",
            },
            characterIds: {
              type: "array",
              description: "Array of character IDs that appear in this spread",
              items: { type: "string" },
            },
            locationId: {
              type: "string",
              description:
                "The primary location ID for this spread, or empty string if none",
            },
          },
        },
      },
    },
  },
};

type ClaudeSpreadDecision = {
  spreadIndex: number;
  characterIds: string[];
  locationId?: string;
};

type ClaudeToolInput = {
  spreads: ClaudeSpreadDecision[];
};

/* -------------------------------------------------------------------------- */
/*                                  HELPERS                                   */
/* -------------------------------------------------------------------------- */

function extractDecideScenesToolInput(
  result: Anthropic.Messages.Message
): unknown {
  const toolUse = result.content.find(
    (c) => c.type === "tool_use" && c.name === "decide_spread_scenes"
  ) as { input?: unknown } | undefined;

  return toolUse?.input ?? null;
}

function isValidClaudeToolInput(value: unknown): value is ClaudeToolInput {
  if (!value || typeof value !== "object") return false;

  const spreads = (value as { spreads?: unknown }).spreads;
  if (!Array.isArray(spreads)) return false;

  for (const spread of spreads) {
    if (!spread || typeof spread !== "object") return false;

    const s = spread as {
      spreadIndex?: unknown;
      characterIds?: unknown;
      locationId?: unknown;
    };

    if (typeof s.spreadIndex !== "number" || !Number.isFinite(s.spreadIndex)) {
      return false;
    }

    if (!Array.isArray(s.characterIds)) return false;
    if (!s.characterIds.every((id) => typeof id === "string")) return false;

    if (
      s.locationId !== undefined &&
      typeof s.locationId !== "string"
    ) {
      return false;
    }
  }

  return true;
}

function normalizeClaudeToolInput(input: ClaudeToolInput): ClaudeToolInput {
  return {
    spreads: input.spreads.map((spread) => ({
      spreadIndex: spread.spreadIndex,
      characterIds: Array.from(
        new Set((spread.characterIds ?? []).filter((id) => typeof id === "string"))
      ),
      locationId:
        typeof spread.locationId === "string" ? spread.locationId : "",
    })),
  };
}

/* -------------------------------------------------------------------------- */
/*                               INNGEST FUNCTION                             */
/* -------------------------------------------------------------------------- */

export const decideScenes = inngest.createFunction(
  {
    id: "decide-scenes-v3",
    retries: 2,
  },
  { event: "story/decide-spread-scenes" },
  async ({ event, step }) => {
    const { storyId } = event.data as { storyId: string };

    console.log("🟣 [decide-scenes-v3] Starting:", storyId);

    /* ------------------------------------------------------------------ */
    /* Load spreads                                                        */
    /* ------------------------------------------------------------------ */

    const spreads = await step.run("load-spreads", async () => {
      return db.query.storySpreads.findMany({
        where: eq(storySpreads.storyId, storyId),
        orderBy: asc(storySpreads.spreadIndex),
      });
    });

    if (!spreads.length) {
      throw new Error("No spreads found");
    }

    const spreadByIndex = new Map(spreads.map((s) => [s.spreadIndex, s]));

    console.log(`📚 Loaded ${spreads.length} spreads`);

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
    /* Load characters                                                     */
    /* ------------------------------------------------------------------ */

    const storyChars = await step.run("load-story-characters", async () => {
      return db.query.storyCharacters.findMany({
        where: eq(storyCharacters.storyId, storyId),
      });
    });

    const chars = await step.run("load-characters", async () => {
      if (storyChars.length === 0) return [];
      return db.query.characters.findMany({
        where: inArray(
          characters.id,
          storyChars.map((c) => c.characterId)
        ),
      });
    });

    console.log(`👥 Loaded ${chars.length} characters`);

    /* ------------------------------------------------------------------ */
    /* Load locations                                                      */
    /* ------------------------------------------------------------------ */

    const storyLocs = await step.run("load-story-locations", async () => {
      return db.query.storyLocations.findMany({
        where: eq(storyLocations.storyId, storyId),
      });
    });

    const locs = await step.run("load-locations", async () => {
      if (storyLocs.length === 0) return [];
      return db.query.locations.findMany({
        where: inArray(
          locations.id,
          storyLocs.map((l) => l.locationId)
        ),
      });
    });

    console.log(`📍 Loaded ${locs.length} locations`);

    /* ------------------------------------------------------------------ */
    /* Build Claude input                                                  */
    /* ------------------------------------------------------------------ */

    const spreadText = spreads
      .map((s) => {
        const left = s.leftPageId ? pageText.get(s.leftPageId) ?? "" : "";
        const right = s.rightPageId ? pageText.get(s.rightPageId) ?? "" : "";

        return `
SPREAD ${s.spreadIndex}

LEFT PAGE:
${left}

RIGHT PAGE:
${right}
`.trim();
      })
      .join("\n\n");

    const characterList = chars.length
      ? chars
          .map((c) => {
            const extra = c.description ? ` — ${c.description}` : "";
            return `${c.name} (ID: ${c.id})${extra}`;
          })
          .join("\n")
      : "None";

    const locationList = locs.length
      ? locs
          .map((l) => {
            const extra = l.description ? ` — ${l.description}` : "";
            return `${l.name} (ID: ${l.id})${extra}`;
          })
          .join("\n")
      : "None";

    const expectedSpreadIndexes = spreads
      .map((s) => s.spreadIndex)
      .sort((a, b) => a - b);

    /* ------------------------------------------------------------------ */
    /* Claude (TOOLS — REPAIRABLE CONTRACT)                                */
    /* ------------------------------------------------------------------ */

    const systemPrompt = `
You are performing a STRUCTURAL planning task.

For each spread, decide which characters appear and what the primary location is.

You MUST return ONLY via the decide_spread_scenes tool.

The tool input MUST look exactly like this shape:

{
  "spreads": [
    {
      "spreadIndex": 1,
      "characterIds": ["character-id-1", "character-id-2"],
      "locationId": "location-id-1"
    },
    {
      "spreadIndex": 2,
      "characterIds": [],
      "locationId": ""
    }
  ]
}

Rules:
- Use ONLY the character and location IDs provided in the user message
- Do NOT invent or guess IDs
- If no location is relevant, use empty string ""
- If no characters appear, use empty array []
- Every spreadIndex from the input must be included exactly once
- "spreads" must always be present
- "spreads" must always be an array
- Do not omit required fields
`.trim();

    const userPrompt = `
AVAILABLE CHARACTERS:
${characterList}

AVAILABLE LOCATIONS:
${locationList}

SPREAD INDEXES THAT MUST APPEAR EXACTLY ONCE:
${expectedSpreadIndexes.join(", ")}

SPREADS TO ANALYZE:
${spreadText}
`.trim();

    const firstResult = await step.run("decide-with-claude", async () => {
      console.log("🤖 Calling Claude with tool...");

      return client.messages.create({
        model: MODEL,
        max_tokens: 2000,
        tools: [decideSpreadScenesTool],
        tool_choice: {
          type: "tool",
          name: "decide_spread_scenes",
        },
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: userPrompt,
          },
        ],
      });
    });

    console.log("🔍 Extracting tool use from Claude response...");

    let rawToolInput = extractDecideScenesToolInput(firstResult);

    if (!rawToolInput) {
      console.error(
        "❌ No tool use found. Full response:",
        JSON.stringify(firstResult.content, null, 2)
      );
      throw new Error("Claude did not return tool output");
    }

    console.log("🔍 First tool input:", JSON.stringify(rawToolInput, null, 2));

    if (!isValidClaudeToolInput(rawToolInput)) {
      console.warn("⚠️ Invalid first tool input structure:", rawToolInput);

      const repairedResult = await step.run("repair-tool-output", async () => {
        return client.messages.create({
          model: MODEL,
          max_tokens: 1200,
          tools: [decideSpreadScenesTool],
          tool_choice: {
            type: "tool",
            name: "decide_spread_scenes",
          },
          system: `
You previously returned invalid tool arguments.

You must now call the decide_spread_scenes tool again with VALID input.

Required shape:
{
  "spreads": [
    {
      "spreadIndex": 1,
      "characterIds": ["id1", "id2"],
      "locationId": "location-id-or-empty-string"
    }
  ]
}

Rules:
- spreads must be present
- spreads must be an array
- every spreadIndex from the input must appear exactly once
- use only IDs already provided
- do not omit required fields
- do not add commentary
`.trim(),
          messages: [
            {
              role: "user",
              content: `
Your previous tool input was invalid:
${JSON.stringify(rawToolInput, null, 2)}

Please correct it for the same story using this required spread index list:
${expectedSpreadIndexes.join(", ")}
`.trim(),
            },
          ],
        });
      });

      rawToolInput = extractDecideScenesToolInput(repairedResult);

      console.log(
        "🔍 Repaired tool input:",
        JSON.stringify(rawToolInput, null, 2)
      );
    }

    if (!isValidClaudeToolInput(rawToolInput)) {
      console.error("❌ Claude repair failed. Final tool input:", rawToolInput);
      throw new Error("Claude returned invalid tool output twice");
    }

    const toolInput = normalizeClaudeToolInput(rawToolInput);

    const returnedSpreadIndexes = toolInput.spreads
      .map((s) => s.spreadIndex)
      .sort((a, b) => a - b);

    if (
      JSON.stringify(returnedSpreadIndexes) !==
      JSON.stringify(expectedSpreadIndexes)
    ) {
      console.error("❌ Spread index mismatch", {
        expectedSpreadIndexes,
        returnedSpreadIndexes,
      });
      throw new Error(
        `Claude returned wrong spread indexes. Expected ${expectedSpreadIndexes.join(
          ", "
        )}, got ${returnedSpreadIndexes.join(", ")}`
      );
    }

    console.log(
      `✅ Claude returned decisions for ${toolInput.spreads.length} spreads`
    );

    /* ------------------------------------------------------------------ */
    /* Persist                                                             */
    /* ------------------------------------------------------------------ */

    await step.run("save-spread-presence", async () => {
      console.log(`📝 Processing ${toolInput.spreads.length} spread decisions`);

      for (const decision of toolInput.spreads) {
        const spread = spreadByIndex.get(decision.spreadIndex);

        if (!spread) {
          console.error(
            `❌ Invalid spreadIndex ${decision.spreadIndex}. Available:`,
            Array.from(spreadByIndex.keys())
          );
          throw new Error(`Invalid spreadIndex ${decision.spreadIndex}`);
        }

        const characterIds = decision.characterIds || [];
        const locationId =
          decision.locationId && decision.locationId !== ""
            ? decision.locationId
            : null;

        console.log(
          `✅ Spread ${decision.spreadIndex}: ${characterIds.length} characters, location: ${
            locationId || "none"
          }`
        );

        await db
          .insert(storySpreadPresence)
          .values({
            id: uuid(),
            spreadId: spread.id,
            characters: characterIds.map((characterId: string) => ({
              characterId,
              role: "primary",
              confidence: 0.8,
              reason: "Derived from spread text",
            })),
            primaryLocationId: locationId,
            source: "claude",
            locked: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: storySpreadPresence.spreadId,
            set: {
              characters: characterIds.map((characterId: string) => ({
                characterId,
                role: "primary",
                confidence: 0.8,
                reason: "Derived from spread text",
              })),
              primaryLocationId: locationId,
              updatedAt: new Date(),
            },
          });
      }

      console.log(
        `✅ Saved ${toolInput.spreads.length} spread presence records`
      );
    });

    /* ------------------------------------------------------------------ */
    /* Mark workflow complete                                              */
    /* ------------------------------------------------------------------ */

    await step.run("mark-complete", async () => {
      await db
        .update(storyWorkflowProgress)
        .set({
          scenesDecided: true,
          scenesDecidedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(storyWorkflowProgress.storyId, storyId));

      await inngest.send({
        name: "story/generate-spreads",
        data: { storyId },
      });
    });

    console.log("✅ [decide-scenes-v3] Workflow complete!");

    return { ok: true, spreadsProcessed: toolInput.spreads.length };
  }
);