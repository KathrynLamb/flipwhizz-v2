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

/* ======================================================
   CLIENT
====================================================== */

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

const MODEL = "claude-sonnet-4-20250514";

/* ======================================================
   TYPE HELPERS
====================================================== */

type NonNull<T> = T extends null | undefined ? never : T;

function isNonNull<T>(v: T | null | undefined): v is NonNull<T> {
  return v !== null && v !== undefined;
}

/* ======================================================
   CLAUDE TOOL (STRICT CONTRACT)
====================================================== */

const decideScenesTool = {
  name: "decide_spread_scenes",
  description:
    "Assign characters and a primary location to each story spread based on the text.",
  input_schema: {
    type: "object",
    required: ["spreads"] as string[],
    properties: {
      spreads: {
        type: "array",
        items: {
          type: "object",
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
                required: ["characterId", "role", "confidence"] as string[],
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

    console.log("🔵 [decide-scenes] Starting:", storyId);

    /* --------------------------------------------------
       1. Load spreads (ordered, canonical)
    -------------------------------------------------- */

    const spreads = await step.run("load-spreads", async () =>
      db.query.storySpreads.findMany({
        where: eq(storySpreads.storyId, storyId),
        orderBy: (s, { asc }) => [asc(s.spreadIndex)],
      })
    );

    if (spreads.length === 0) {
      throw new Error("No spreads found");
    }

    const spreadByIndex = new Map(spreads.map((s) => [s.spreadIndex, s]));

    /* --------------------------------------------------
       2. Load pages
    -------------------------------------------------- */

    const pageIds = spreads
      .flatMap((s) => [s.leftPageId, s.rightPageId])
      .filter(isNonNull);

    const pages = await step.run("load-pages", async () =>
      db.query.storyPages.findMany({
        where: inArray(storyPages.id, pageIds),
      })
    );

    const pageMap = new Map(pages.map((p) => [p.id, p]));

    /* --------------------------------------------------
       3. Load characters
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

    const safeChars = chars.filter(isNonNull);

    /* --------------------------------------------------
       4. Load locations
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

    const safeLocs = locs.filter(isNonNull);

    /* --------------------------------------------------
       5. Ask Claude (TOOLS + CLEAR TASK)
    -------------------------------------------------- */

    const assignments = await step.run("decide-with-claude", async () => {
      const spreadText = spreads
        .map((s) => {
          const left =
            s.leftPageId && pageMap.get(s.leftPageId)
              ? pageMap.get(s.leftPageId)!.text ?? ""
              : "";
          const right =
            s.rightPageId && pageMap.get(s.rightPageId)
              ? pageMap.get(s.rightPageId)!.text ?? ""
              : "";
          return `SPREAD ${s.spreadIndex}\nLeft: ${left}\nRight: ${right}`;
        })
        .join("\n\n");

      const charList = safeChars
        .map((c) => `${c.name} (${c.id})`)
        .join(", ");

      const locList = safeLocs
        .map((l) => `${l.name} (${l.id})`)
        .join(", ");

      const res = await client.messages.create({
        model: MODEL,
        max_tokens: 3000,
        tools: [decideScenesTool],
        tool_choice: {
          type: "tool",
          name: "decide_spread_scenes",
        },
        system: `
You are a story illustrator planner.

For each spread:
- Decide which characters appear
- Choose ONE primary location (or null)
- Use ONLY provided character and location IDs
- Return structured decisions via the tool
- Do NOT write text outside the tool
        `.trim(),
        messages: [
          {
            role: "user",
            content: `
Characters:
${charList}

Locations:
${locList}

Story spreads:
${spreadText}
            `.trim(),
          },
        ],
      });

      const toolUse = res.content.find(
        (c) => c.type === "tool_use" && c.name === "decide_spread_scenes"
      ) as
        | { type: "tool_use"; input: { spreads: any[] } }
        | undefined;

      if (!toolUse?.input?.spreads) {
        throw new Error("Claude did not return spread decisions");
      }

      return toolUse.input;
    });

    /* --------------------------------------------------
       6. Persist presence
    -------------------------------------------------- */

    await step.run("save-spread-presence", async () => {
      for (const assignment of assignments.spreads) {
        const spread = spreadByIndex.get(assignment.spreadIndex);

        if (!spread) {
          throw new Error(
            `Invalid spreadIndex: ${assignment.spreadIndex}`
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
       7. Mark workflow complete
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
