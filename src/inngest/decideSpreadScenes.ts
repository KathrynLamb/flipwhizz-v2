// src/inngest/decideScenes.ts
import { inngest } from "@/inngest/client";
import { db } from "@/db";
import {
  storySpreads,
  storyPages,
  storyCharacters,
  characters,
  storyWorkflowProgress,
  storySpreadPresence,
  locations,
  storyLocations,
} from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

const MODEL = "claude-sonnet-4-20250514"


/* ======================================================
   CLAUDE TOOL DEFINITION (STRICT JSON CONTRACT)
====================================================== */

const decideScenesTool = {
  name: "decide_spread_scenes",
  description:
    "Decide which characters and locations appear in each story spread",
  input_schema: {
    type: "object",
    // FIX: Cast to string[] to satisfy mutable array requirement of SDK
    required: ["spreads"] as string[],
    properties: {
      spreads: {
        type: "array",
        items: {
          type: "object",
          // FIX: Cast to string[] to satisfy mutable array requirement of SDK
          required: [
            "spreadIndex",
            "primaryLocationId",
            "characters",
            "reasoning",
          ] as string[],
          properties: {
            spreadIndex: { type: "number" },
            primaryLocationId: { type: ["string", "null"] },
            characters: {
              type: "array",
              items: {
                type: "object",
                // FIX: Cast to string[] to satisfy mutable array requirement of SDK
                required: [
                  "characterId",
                  "role",
                  "confidence",
                ] as string[],
                properties: {
                  characterId: { type: "string" },
                  role: {
                    type: "string",
                    enum: ["primary", "secondary", "background"],
                  },
                  confidence: {
                    type: "number",
                    minimum: 0,
                    maximum: 1,
                  },
                  reason: { type: "string" },
                },
              },
            },
            reasoning: { type: "string" },
          },
        },
      },
    },
  },
} as const;

/* ======================================================
   INNGEST FUNCTION
====================================================== */

export const decideScenes = inngest.createFunction(
  {
    id: "decide-scenes-v2",
    retries: 2,
  },
  { event: "story/decide-spread-scenes" },
  async ({ event, step }) => {
    const { storyId } = event.data as { storyId: string };

    console.log("🔵 [decide-scenes] Starting for story:", storyId);

    /* --------------------------------------------------
       STEP 1: Load spreads
    -------------------------------------------------- */
    const spreads = await step.run("load-spreads", async () =>
      db.query.storySpreads.findMany({
        where: eq(storySpreads.storyId, storyId),
        orderBy: (s, { asc }) => [asc(s.spreadIndex)],
      })
    );

    if (spreads.length === 0) {
      throw new Error("No spreads found for story");
    }

    const spreadByIndex = new Map(spreads.map((s, i) => [i + 1, s]));

    /* --------------------------------------------------
       STEP 2: Load pages
    -------------------------------------------------- */
    const pageIds = spreads
      .flatMap((s) => [s.leftPageId, s.rightPageId])
      .filter(Boolean) as string[];

    const pages = await step.run("load-pages", async () =>
      db.query.storyPages.findMany({
        where: inArray(storyPages.id, pageIds),
      })
    );

    const pageMap = new Map(pages.map((p) => [p.id, p]));

    /* --------------------------------------------------
       STEP 3: Load characters
    -------------------------------------------------- */
    const storyChars = await step.run("load-story-characters", async () =>
      db.query.storyCharacters.findMany({
        where: eq(storyCharacters.storyId, storyId),
      })
    );

    const charIds = storyChars.map((sc) => sc.characterId);

    const chars = await step.run("load-characters", async () =>
      charIds.length === 0
        ? []
        : db.query.characters.findMany({
            where: inArray(characters.id, charIds),
          })
    );

    /* --------------------------------------------------
       STEP 4: Load locations
    -------------------------------------------------- */
    const storyLocs = await step.run("load-story-locations", async () =>
      db.query.storyLocations.findMany({
        where: eq(storyLocations.storyId, storyId),
      })
    );

    const locIds = storyLocs.map((sl) => sl.locationId);

    const locs = await step.run("load-locations", async () =>
      locIds.length === 0
        ? []
        : db.query.locations.findMany({
            where: inArray(locations.id, locIds),
          })
    );

    /* --------------------------------------------------
       STEP 5: Ask Claude (TOOLS — NO JSON PARSING)
    -------------------------------------------------- */
    const assignments = await step.run("decide-with-claude", async () => {
      const spreadTexts = spreads
        .map((s, i) => {
          const left = s.leftPageId
            ? pageMap.get(s.leftPageId)?.text ?? ""
            : "";
          const right = s.rightPageId
            ? pageMap.get(s.rightPageId)?.text ?? ""
            : "";
          return `SPREAD ${i + 1}:\nLeft: ${left}\nRight: ${right}`;
        })
        .join("\n\n");

      const charList = chars
        .filter((c) => c !== null && c !== undefined)
        .map((c) => `${c?.name} (${c?.id})`)
        .join(", ");

      const locList = locs
        .filter((l) => l !== null && l !== undefined)
        .map((l) => `${l?.name} (${l?.id})`)
        .join(", ");

      const res = await client.messages.create({
        model: MODEL,
        max_tokens: 3000,
        tools: [decideScenesTool],
        tool_choice: {
          type: "tool",
          name: "decide_spread_scenes",
        },
        messages: [
          {
            role: "user",
            content: `Characters:\n${charList}\n\nLocations:\n${locList}\n\n${spreadTexts}`,
          },
        ],
      });

      const toolUse = res.content.find(
        (c) => c.type === "tool_use" && c.name === "decide_spread_scenes"
      ) as
        | {
            type: "tool_use";
            input: { spreads: any[] };
          }
        | undefined;

      if (!toolUse?.input?.spreads) {
        throw new Error("Claude did not return spread decisions");
      }

      return toolUse.input;
    });

    /* --------------------------------------------------
       STEP 6: Persist spread presence
    -------------------------------------------------- */
    await step.run("save-spread-presence", async () => {
      for (const assignment of assignments.spreads) {
        const spread = spreadByIndex.get(assignment.spreadIndex);

        if (!spread) {
          throw new Error(
            `Invalid spreadIndex returned by Claude: ${assignment.spreadIndex}`
          );
        }

        await db.insert(storySpreadPresence).values({
          id: uuid(),
          spreadId: spread.id,
          primaryLocationId: assignment.primaryLocationId,
          characters: assignment.characters,
          excludedCharacters: [],
          reasoning: assignment.reasoning,
          source: "claude",
          locked: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    });

    /* --------------------------------------------------
       STEP 7: Mark workflow complete
    -------------------------------------------------- */
    await step.run("mark-complete", async () => {
      await db
        .update(storyWorkflowProgress)
        .set({
          scenesDecided: true,
          scenesDecidedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(storyWorkflowProgress.storyId, storyId));
    });

    console.log("✅ [decide-scenes] Complete");

    return { ok: true };
  }
);