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
const MAX_FEATURED_CHARACTERS_PER_SPREAD = 5;

/* -------------------------------------------------------------------------- */
/*                                   TYPES                                    */
/* -------------------------------------------------------------------------- */

type SpreadLocationRole =
  | "primary"
  | "secondary"
  | "background"
  | "referenced"
  | "memory";

type ClaudeSpreadLocationDecision = {
  locationId: string;
  role: SpreadLocationRole;
  reason: string;
};

type ClaudeSpreadDecision = {
  spreadIndex: number;
  featuredCharacterIds: string[];
  backgroundCharacterIds: string[];
  locations: ClaudeSpreadLocationDecision[];
};

type ClaudeToolInput = {
  spreads: ClaudeSpreadDecision[];
};

/* -------------------------------------------------------------------------- */
/*                         CLAUDE TOOL (HARD CONTRACT)                         */
/* -------------------------------------------------------------------------- */

const decideSpreadScenesTool: Anthropic.Tool = {
  name: "decide_spread_scenes",
  description:
    "Assign featured characters, background characters, and one or more locations to each spread in the story",
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
            "featuredCharacterIds",
            "backgroundCharacterIds",
            "locations",
          ],
          properties: {
            spreadIndex: {
              type: "number",
              description: "The spread number (1-based index)",
            },
            featuredCharacterIds: {
              type: "array",
              description:
                `Array of character IDs that are visually important and should be illustrated most clearly in this spread. Prefer no more than ${MAX_FEATURED_CHARACTERS_PER_SPREAD}.`,
              items: { type: "string" },
            },
            backgroundCharacterIds: {
              type: "array",
              description:
                "Array of character IDs that may appear as background or less important figures in this spread",
              items: { type: "string" },
            },
            locations: {
              type: "array",
              description:
                "Array of locations relevant to this spread. Use one primary location when there is a clear main visible setting. Add additional locations only if they are also relevant as referenced, memory, background, or secondary context.",
              items: {
                type: "object",
                required: ["locationId", "role", "reason"],
                properties: {
                  locationId: {
                    type: "string",
                    description: "A location ID from the provided list",
                  },
                  role: {
                    type: "string",
                    enum: [
                      "primary",
                      "secondary",
                      "background",
                      "referenced",
                      "memory",
                    ],
                    description:
                      "How this location functions in the spread",
                  },
                  reason: {
                    type: "string",
                    description:
                      "Short explanation of why this location is relevant",
                  },
                },
              },
            },
          },
        },
      },
    },
  },
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

function isValidLocationRole(value: unknown): value is SpreadLocationRole {
  return (
    value === "primary" ||
    value === "secondary" ||
    value === "background" ||
    value === "referenced" ||
    value === "memory"
  );
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function uniqueStrings(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return Array.from(
    new Set(values.filter((id): id is string => typeof id === "string" && id.trim().length > 0))
  );
}

function isValidClaudeToolInput(value: unknown): value is ClaudeToolInput {
  if (!value || typeof value !== "object") return false;

  const spreads = (value as { spreads?: unknown }).spreads;
  if (!Array.isArray(spreads)) return false;

  for (const spread of spreads) {
    if (!spread || typeof spread !== "object") return false;

    const s = spread as {
      spreadIndex?: unknown;
      featuredCharacterIds?: unknown;
      backgroundCharacterIds?: unknown;
      locations?: unknown;
    };

    if (typeof s.spreadIndex !== "number" || !Number.isFinite(s.spreadIndex)) {
      return false;
    }

    if (!isStringArray(s.featuredCharacterIds)) return false;
    if (!isStringArray(s.backgroundCharacterIds)) return false;
    if (!Array.isArray(s.locations)) return false;

    for (const loc of s.locations) {
      if (!loc || typeof loc !== "object") return false;

      const l = loc as {
        locationId?: unknown;
        role?: unknown;
        reason?: unknown;
      };

      if (typeof l.locationId !== "string") return false;
      if (!isValidLocationRole(l.role)) return false;
      if (typeof l.reason !== "string") return false;
    }
  }

  return true;
}

function normalizeClaudeToolInput(input: ClaudeToolInput): ClaudeToolInput {
  return {
    spreads: input.spreads.map((spread) => {
      const featuredCharacterIds = uniqueStrings(spread.featuredCharacterIds);
      const backgroundCharacterIds = uniqueStrings(spread.backgroundCharacterIds);

      const dedupedBackground = backgroundCharacterIds.filter(
        (id) => !featuredCharacterIds.includes(id)
      );

      const normalizedFeatured = featuredCharacterIds.slice(
        0,
        MAX_FEATURED_CHARACTERS_PER_SPREAD
      );

      const overflowFeatured = featuredCharacterIds.slice(
        MAX_FEATURED_CHARACTERS_PER_SPREAD
      );

      const normalizedBackground = Array.from(
        new Set([...dedupedBackground, ...overflowFeatured])
      ).filter((id) => !normalizedFeatured.includes(id));

      const seenLocationIds = new Set<string>();
      let normalizedLocations = (spread.locations ?? [])
        .filter(
          (loc) =>
            loc &&
            typeof loc.locationId === "string" &&
            loc.locationId.trim() &&
            isValidLocationRole(loc.role)
        )
        .filter((loc) => {
          const key = loc.locationId.trim();
          if (seenLocationIds.has(key)) return false;
          seenLocationIds.add(key);
          return true;
        })
        .map((loc) => ({
          locationId: loc.locationId.trim(),
          role: loc.role,
          reason:
            typeof loc.reason === "string" && loc.reason.trim()
              ? loc.reason.trim()
              : "Derived from spread text",
        }));

      const primaryCount = normalizedLocations.filter(
        (loc) => loc.role === "primary"
      ).length;

      if (normalizedLocations.length > 0 && primaryCount === 0) {
        normalizedLocations = normalizedLocations.map((loc, index) => ({
          ...loc,
          role: index === 0 ? ("primary" as const) : loc.role,
        }));
      }

      if (primaryCount > 1) {
        let firstPrimarySeen = false;
        normalizedLocations = normalizedLocations.map((loc) => {
          if (loc.role !== "primary") return loc;
          if (!firstPrimarySeen) {
            firstPrimarySeen = true;
            return loc;
          }
          return { ...loc, role: "secondary" as const };
        });
      }

      return {
        spreadIndex: spread.spreadIndex,
        featuredCharacterIds: normalizedFeatured,
        backgroundCharacterIds: normalizedBackground,
        locations: normalizedLocations,
      };
    }),
  };
}

/* -------------------------------------------------------------------------- */
/*                               INNGEST FUNCTION                             */
/* -------------------------------------------------------------------------- */

export const decideScenes = inngest.createFunction(
  {
    id: "decide-scenes-v5",
    retries: 2,
  },
  { event: "story/decide-spread-scenes" },
  async ({ event, step }) => {
    const { storyId } = event.data as { storyId: string };

    console.log("🟣 [decide-scenes-v5] Starting:", storyId);

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

    const validCharacterIds = new Set(chars.map((c) => c.id));
    const validLocationIds = new Set(locs.map((l) => l.id));

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
    /* Claude                                                              */
    /* ------------------------------------------------------------------ */

    const systemPrompt = `
You are performing a STRUCTURAL planning task for illustrated storybook spreads.

For each spread, decide:
1. which characters are FEATURED
2. which characters are BACKGROUND
3. which locations are relevant to the spread

You MUST return ONLY via the decide_spread_scenes tool.

A FEATURED character is visually important and should be illustrated clearly.
A BACKGROUND character may appear, but is less important, smaller, more distant, or less exact.

Illustration constraint:
- Prefer NO MORE THAN ${MAX_FEATURED_CHARACTERS_PER_SPREAD} featured characters in a single spread
- If more than ${MAX_FEATURED_CHARACTERS_PER_SPREAD} characters are narratively present, choose the most important ${MAX_FEATURED_CHARACTERS_PER_SPREAD} as featured
- Put less important, less visible, or more distant characters into backgroundCharacterIds
- Do not duplicate the same character in both featuredCharacterIds and backgroundCharacterIds

Prioritise as featured:
- protagonists
- named characters central to the action
- speakers
- characters doing something visually important
- characters whose identity most needs to be preserved

Use locations carefully:
- "primary" = the main visible setting of the spread
- "secondary" = another physically present but less dominant setting
- "background" = a weak environmental location signal
- "referenced" = a location mentioned in narration/dialogue but not the main visible setting
- "memory" = flashback, remembered, imagined, or non-present location context

Rules:
- Use ONLY the character and location IDs provided in the user message
- Do NOT invent or guess IDs
- If no featured characters appear, use empty array []
- If no background characters appear, use empty array []
- If no locations are relevant, use empty array []
- Every spreadIndex from the input must be included exactly once
- "spreads" must always be present
- "spreads" must always be an array
- Each spread must include: spreadIndex, featuredCharacterIds, backgroundCharacterIds, locations
- Prefer exactly one "primary" location when a clear main setting exists
- Do not mark a merely mentioned past location as "primary" if the visible action is happening somewhere else
- Do not add commentary outside the tool
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
        max_tokens: 2500,
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
          max_tokens: 1500,
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
      "featuredCharacterIds": ["id1", "id2"],
      "backgroundCharacterIds": ["id3"],
      "locations": [
        {
          "locationId": "location-id-1",
          "role": "primary",
          "reason": "Main visible setting"
        }
      ]
    }
  ]
}

Rules:
- spreads must be present
- spreads must be an array
- every spreadIndex from the input must appear exactly once
- use only IDs already provided
- every spread must include featuredCharacterIds, backgroundCharacterIds, and locations
- locations must be an array, not a string
- do not omit required fields
- do not add commentary
- featuredCharacterIds must contain no more than ${MAX_FEATURED_CHARACTERS_PER_SPREAD} IDs
- do not duplicate a character across featuredCharacterIds and backgroundCharacterIds
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

        const featuredCharacterPresence = (decision.featuredCharacterIds || [])
          .filter((characterId) => validCharacterIds.has(characterId))
          .map((characterId) => ({
            characterId,
            role: "primary" as const,
            confidence: 0.9,
            reason: "Featured character selected from spread text",
          }));

        const backgroundCharacterPresence = (decision.backgroundCharacterIds || [])
          .filter((characterId) => validCharacterIds.has(characterId))
          .filter(
            (characterId) =>
              !featuredCharacterPresence.some((c) => c.characterId === characterId)
          )
          .map((characterId) => ({
            characterId,
            role: "background" as const,
            confidence: 0.7,
            reason: "Background character selected from spread text",
          }));

        const characterPresence = [
          ...featuredCharacterPresence,
          ...backgroundCharacterPresence,
        ];

        const locationPresence = (decision.locations || [])
          .filter((loc) => validLocationIds.has(loc.locationId))
          .map((loc) => ({
            locationId: loc.locationId,
            role: loc.role,
            confidence: loc.role === "primary" ? 0.9 : 0.7,
            reason: loc.reason || "Derived from spread text",
          }));

        console.log(
          `✅ Spread ${decision.spreadIndex}: ${featuredCharacterPresence.length} featured, ${backgroundCharacterPresence.length} background, ${locationPresence.length} locations`
        );

        await db
          .insert(storySpreadPresence)
          .values({
            id: uuid(),
            spreadId: spread.id,
            characters: characterPresence,
            locations: locationPresence,
            source: "claude",
            locked: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: storySpreadPresence.spreadId,
            set: {
              characters: characterPresence,
              locations: locationPresence,
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

    console.log("✅ [decide-scenes-v5] Workflow complete!");

    return { ok: true, spreadsProcessed: toolInput.spreads.length };
  }
);