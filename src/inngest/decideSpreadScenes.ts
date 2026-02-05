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
  description:
    "Assign characters and locations to each spread in the story",
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
              description: "The spread number (1-based index)"
            },
            characterIds: {
              type: "array",
              description: "Array of character IDs that appear in this spread",
              items: { type: "string" },
            },
            locationId: { 
              type: "string",
              description: "The primary location ID for this spread, or empty string if none"
            },
          },
        },
      },
    },
  },
};

/* -------------------------------------------------------------------------- */
/*                               INNGEST FUNCTION                             */
/* -------------------------------------------------------------------------- */

export const decideScenes = inngest.createFunction(
  { 
    id: "decide-scenes-v3",  // Changed version to force re-registration
    retries: 2 
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

    const spreadByIndex = new Map(
      spreads.map((s) => [s.spreadIndex, s])
    );

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

    const pageText = new Map(
      pages.map((p) => [p.id, p.text ?? ""])
    );

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
      .map((c) => `${c.name} (ID: ${c.id})`)
      .join("\n");

    const locationList = locs
      .map((l) => `${l.name} (ID: ${l.id})`)
      .join("\n");

    /* ------------------------------------------------------------------ */
    /* Claude (TOOLS — NO JSON PARSING)                                    */
    /* ------------------------------------------------------------------ */

    const result = await step.run("decide-with-claude", async () => {
      console.log("🤖 Calling Claude with tool...");
      
      return client.messages.create({
        model: MODEL,
        max_tokens: 2000,
        tools: [decideSpreadScenesTool],
        tool_choice: {
          type: "tool",
          name: "decide_spread_scenes",
        },
        system: `
You are performing a STRUCTURAL planning task.

For each spread, decide which characters appear and what the primary location is.

Rules:
- Use ONLY the character and location IDs provided in the user message
- Do NOT invent or guess IDs
- If no location is relevant, use empty string ""
- If no characters appear, use empty array []
- Every spreadIndex from the input must be included exactly once
- Output ONLY via the decide_spread_scenes tool
`.trim(),
        messages: [
          {
            role: "user",
            content: `
AVAILABLE CHARACTERS:
${characterList || "None"}

AVAILABLE LOCATIONS:
${locationList || "None"}

SPREADS TO ANALYZE:
${spreadText}
`.trim(),
          },
        ],
      });
    });

    /* ------------------------------------------------------------------ */
    /* Extract tool use                                                    */
    /* ------------------------------------------------------------------ */

    console.log("🔍 Extracting tool use from Claude response...");

    const toolUse = result.content.find(
      (c) =>
        c.type === "tool_use" &&
        c.name === "decide_spread_scenes"
    ) as any;

    if (!toolUse) {
      console.error("❌ No tool use found. Full response:", JSON.stringify(result.content, null, 2));
      throw new Error("Claude did not return tool output");
    }

    console.log("🔍 Tool use input:", JSON.stringify(toolUse.input, null, 2));

    // Validate the structure
    if (!toolUse.input || !Array.isArray(toolUse.input.spreads)) {
      console.error("❌ Invalid tool input structure:", toolUse.input);
      throw new Error(`Invalid tool output structure. Expected spreads array, got: ${typeof toolUse.input?.spreads}`);
    }

    console.log(`✅ Claude returned decisions for ${toolUse.input.spreads.length} spreads`);

    /* ------------------------------------------------------------------ */
    /* Persist                                                            */
    /* ------------------------------------------------------------------ */

    await step.run("save-spread-presence", async () => {
      console.log(`📝 Processing ${toolUse.input.spreads.length} spread decisions`);

      for (const decision of toolUse.input.spreads) {
        const spread = spreadByIndex.get(decision.spreadIndex);
        if (!spread) {
          console.error(`❌ Invalid spreadIndex ${decision.spreadIndex}. Available:`, Array.from(spreadByIndex.keys()));
          throw new Error(
            `Invalid spreadIndex ${decision.spreadIndex}`
          );
        }

        const characterIds = decision.characterIds || [];
        const locationId = decision.locationId && decision.locationId !== "" ? decision.locationId : null;

        console.log(`✅ Spread ${decision.spreadIndex}: ${characterIds.length} characters, location: ${locationId || 'none'}`);

        await db.insert(storySpreadPresence).values({
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
        });
      }

      console.log(`✅ Saved ${toolUse.input.spreads.length} spread presence records`);
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

      console.log("✅ [decide-scenes-v3] Workflow complete!");
    });

    return { ok: true, spreadsProcessed: toolUse.input.spreads.length };
  }
);