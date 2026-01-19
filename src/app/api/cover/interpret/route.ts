import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type { ToolUseBlock } from "@anthropic-ai/sdk/resources/messages";

import { db } from "@/db";
import {
  stories,
  storyIntent,
  storyStyleGuide,
  coverChatSessions,
  characters,
  locations,
  storyCharacters,
  storyLocations,
  projects,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import { v4 as uuid } from "uuid";

export const dynamic = "force-dynamic";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

const TOOL_NAME = "emit_cover_plan";

/* ======================================================
   TOOL INPUT TYPE (AUTHORITATIVE)
====================================================== */

type EmitCoverPlanInput = {
  coverPlan: {
    frontVisual: string;
    backVisual: string;
    spineVisual: string;

    titleText: string;
    subtitleText?: string | null;
    authorText: string;
    backCoverText: string;
    tagline?: string | null;

    charactersShown: string[];
    locationsShown: string[];

    styleSnapshot: {
      artStyle?: string;
      colorPalette?: string[];
      mood?: string;
    };

    layoutNotes: string[];
  };
};

/* ======================================================
   ROUTE — INTERPRET
====================================================== */

export async function POST(req: Request) {
  try {
    const { storyId } = await req.json();

    if (!storyId) {
      return NextResponse.json({ error: "Missing storyId" }, { status: 400 });
    }

    /* --------------------------------------------------
       1. Load story (project-scoped fields)
    -------------------------------------------------- */

    const story = await db
      .select({
        id: stories.id,
        title: stories.title,
        description: stories.description,
        fullDraft: stories.fullDraft,
        storyBrief: projects.storyBrief,
      })
      .from(stories)
      .innerJoin(projects, eq(stories.projectId, projects.id))
      .where(eq(stories.id, storyId))
      .then((r) => r[0]);

    if (!story) {
      return NextResponse.json({ error: "Story not found" }, { status: 404 });
    }

    /* --------------------------------------------------
       2. Load world data (story-scoped)
    -------------------------------------------------- */

    const [intent, styleGuide] = await Promise.all([
      db.query.storyIntent.findFirst({
        where: eq(storyIntent.storyId, storyId),
      }),
      db.query.storyStyleGuide.findFirst({
        where: eq(storyStyleGuide.storyId, storyId),
      }),
    ]);

    const chars = await db
      .select({
        name: characters.name,
        description: characters.description,
        appearance: characters.appearance,
      })
      .from(characters)
      .innerJoin(
        storyCharacters,
        eq(storyCharacters.characterId, characters.id)
      )
      .where(eq(storyCharacters.storyId, storyId));

    const locs = await db
      .select({
        name: locations.name,
        description: locations.description,
      })
      .from(locations)
      .innerJoin(
        storyLocations,
        eq(storyLocations.locationId, locations.id)
      )
      .where(eq(storyLocations.storyId, storyId));

    /* --------------------------------------------------
       3. Reuse existing cover session if present
    -------------------------------------------------- */

    const existing = await db.query.coverChatSessions.findFirst({
      where: eq(coverChatSessions.storyId, storyId),
      orderBy: (s, { desc }) => [desc(s.planUpdatedAt)],
    });

    if (existing?.coverPlan) {
      return NextResponse.json({
        sessionId: existing.id,
        coverPlan: existing.coverPlan,
        message:
          "I've loaded your existing wrap-around cover plan. You can keep refining it.",
      });
    }

    /* --------------------------------------------------
       4. Create fresh cover session
    -------------------------------------------------- */

    const [session] = await db
      .insert(coverChatSessions)
      .values({
        id: uuid(),
        storyId,
        coverPlan: null,
        planUpdatedAt: null,
        createdAt: new Date(),
      })
      .returning();

    /* --------------------------------------------------
       5. Claude — compiler mode
    -------------------------------------------------- */

    const SYSTEM = `
You are a compiler.

Your task is to interpret an EXISTING children's story into a COMPLETE
wrap-around illustrated book cover plan.

You are NOT brainstorming.
You are NOT asking preferences.
You are NOT discovering the story.

Everything you need is provided.
Return a FULL, illustrator-ready cover plan.
`.trim();

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1500,
      system: SYSTEM,
      tools: [
        {
          name: TOOL_NAME,
          description: "Emit a complete wrap-around book cover plan.",
          input_schema: {
            type: "object",
            required: ["coverPlan"],
            properties: {
              coverPlan: {
                type: "object",
                required: [
                  "frontVisual",
                  "backVisual",
                  "spineVisual",
                  "titleText",
                  "authorText",
                  "backCoverText",
                  "charactersShown",
                  "locationsShown",
                  "styleSnapshot",
                  "layoutNotes",
                ],
                properties: {
                  frontVisual: { type: "string" },
                  backVisual: { type: "string" },
                  spineVisual: { type: "string" },
                  titleText: { type: "string" },
                  subtitleText: { anyOf: [{ type: "string" }, { type: "null" }] },
                  authorText: { type: "string" },
                  backCoverText: { type: "string" },
                  tagline: { anyOf: [{ type: "string" }, { type: "null" }] },
                  charactersShown: { type: "array", items: { type: "string" } },
                  locationsShown: { type: "array", items: { type: "string" } },
                  styleSnapshot: {
                    type: "object",
                    properties: {
                      artStyle: { type: "string" },
                      colorPalette: {
                        type: "array",
                        items: { type: "string" },
                      },
                      mood: { type: "string" },
                    },
                  },
                  layoutNotes: {
                    type: "array",
                    items: { type: "string" },
                  },
                },
              },
            },
          },
        },
      ],
      tool_choice: { type: "tool", name: TOOL_NAME },
      messages: [
        {
          role: "user",
          content: `
TITLE:
${story.title}

SUMMARY:
${story.description || story.storyBrief || story.fullDraft}

INTENT:
${intent ? JSON.stringify(intent) : "None"}

CHARACTERS:
${chars.map((c) => `${c.name}: ${c.appearance || c.description}`).join("\n")}

LOCATIONS:
${locs.map((l) => `${l.name}: ${l.description}`).join("\n")}

STYLE GUIDE:
${styleGuide ? JSON.stringify(styleGuide) : "None"}
`,
        },
      ],
    });

    /* --------------------------------------------------
       6. Extract tool payload (THE IMPORTANT PART)
    -------------------------------------------------- */

    const toolBlock = response.content.find(
      (b): b is ToolUseBlock =>
        b.type === "tool_use" && b.name === TOOL_NAME
    );

    const input = toolBlock?.input as EmitCoverPlanInput | undefined;

    if (!input?.coverPlan) {
      return NextResponse.json(
        { error: "Model failed to emit cover plan" },
        { status: 500 }
      );
    }

    /* --------------------------------------------------
       7. Persist canonical plan
    -------------------------------------------------- */

    await db
      .update(coverChatSessions)
      .set({
        coverPlan: input.coverPlan,
        planUpdatedAt: new Date(),
      })
      .where(eq(coverChatSessions.id, session.id));

    return NextResponse.json({
      sessionId: session.id,
      coverPlan: input.coverPlan,
      message:
        "I've created a complete wrap-around cover plan based on your story. You can now tweak anything you like.",
    });
  } catch (err: any) {
    console.error("Cover interpret error", err);
    return NextResponse.json(
      { error: "Cover interpret failed", detail: err.message },
      { status: 500 }
    );
  }
}
