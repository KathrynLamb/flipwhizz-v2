// src/app/api/stories/cover-chat/route.ts
//
// Staged cover design conversation.
// Frontend sends: { storyId, message, stage, history, confirmedTitle,
//   backCoverContent, authorCredit, world, coverCharacterIds, coverLocationIds }
// Returns: { message, stage?, confirmedTitle?, coverCharacterIds?,
//   coverLocationIds?, backCoverContent?, authorCredit? }

import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/db";
import {
  stories,
  projects,
  storyCharacters,
  storyLocations,
  characters,
  locations,
  storyStyleGuide,
  coverChatSessions,
  coverChatMessages,
} from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { v4 as uuid } from "uuid";

export const dynamic = "force-dynamic";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const TOOL_NAME = "cover_chat_response";

type CoverStage = "greeting" | "title" | "image" | "backcover" | "author" | "ready";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      storyId,
      message,
      stage = "greeting",
      confirmedTitle,
      backCoverContent,
      authorCredit,
      world,
      coverCharacterIds = [],
      coverLocationIds = [],
    } = body;

    if (!storyId) {
      return NextResponse.json({ error: "Missing storyId" }, { status: 400 });
    }

    // ── Load story ──
    const storyData = await db
      .select({
        id: stories.id,
        title: stories.title,
        description: stories.description,
        projectId: stories.projectId,
        userId: projects.userId,
        storyBrief: projects.storyBrief,
      })
      .from(stories)
      .innerJoin(projects, eq(stories.projectId, projects.id))
      .where(eq(stories.id, storyId))
      .then((r) => r[0]);

    if (!storyData) {
      return NextResponse.json({ error: "Story not found" }, { status: 404 });
    }

    // ── Load characters + locations (story-scoped) ──
    const chars = world?.characters?.length > 0
      ? world.characters
      : await db
          .select({ id: characters.id, name: characters.name, role: storyCharacters.role })
          .from(storyCharacters)
          .innerJoin(characters, eq(storyCharacters.characterId, characters.id))
          .where(eq(storyCharacters.storyId, storyId));

    const locs = world?.locations?.length > 0
      ? world.locations
      : await db
          .select({ id: locations.id, name: locations.name })
          .from(storyLocations)
          .innerJoin(locations, eq(storyLocations.locationId, locations.id))
          .where(eq(storyLocations.storyId, storyId));

    // ── Load style ──
    const styleData = await db.query.storyStyleGuide.findFirst({
      where: eq(storyStyleGuide.storyId, storyId),
    });

    // ── Get or create session ──
    let session = await db.query.coverChatSessions.findFirst({
      where: eq(coverChatSessions.storyId, storyId),
      orderBy: (s, { desc }) => [desc(s.createdAt)],
    });

    if (!session) {
      [session] = await db
        .insert(coverChatSessions)
        .values({ id: uuid(), storyId, coverPlan: null, createdAt: new Date() })
        .returning();
    }

    // ── Save user message ──
    if (message && message !== "__START__") {
      await db.insert(coverChatMessages).values({
        id: uuid(),
        sessionId: session.id,
        role: "user",
        content: message,
        createdAt: new Date(),
      });
    }

    // ── Build character/location context ──
    const charNames = chars.map((c: any) => `${c.name}${c.role ? ` (${c.role})` : ""}`).join(", ");
    const locNames = locs.map((l: any) => l.name).join(", ");
    const protagonist = chars.find((c: any) => c.role === "protagonist" || c.role === "main");
    const protagonistName = protagonist?.name || chars[0]?.name || "the reader";

    // ── Build stage-specific system prompt ──
    const currentTitle = confirmedTitle || storyData.title;

    const SYSTEM = buildSystemPrompt({
      stage: stage as CoverStage,
      title: currentTitle,
      summary: storyData.description || storyData.storyBrief || "",
      charNames,
      locNames,
      protagonistName,
      artStyle: styleData?.artStyle || "Children's Book Illustration",
      confirmedTitle: confirmedTitle || null,
      backCoverContent: backCoverContent || null,
      authorCredit: authorCredit || null,
      characters: chars,
      locations: locs,
    });

    // ── Load conversation history from DB ──
    const dbHistory = await db
      .select({ role: coverChatMessages.role, content: coverChatMessages.content })
      .from(coverChatMessages)
      .where(eq(coverChatMessages.sessionId, session.id))
      .orderBy(asc(coverChatMessages.createdAt));

    // Build messages array for Claude
    const claudeMessages = dbHistory.length > 0
      ? dbHistory.map((m) => ({ role: m.role as "user" | "assistant", content: m.content }))
      : [{ role: "user" as const, content: message === "__START__"
          ? "Hi! I'm ready to design the cover for my book."
          : message }];

    // ── Call Claude with structured tool ──
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1000,
      system: SYSTEM,
      tools: [
        {
          name: TOOL_NAME,
          description: "Respond to the parent with your message and any stage/data updates.",
          input_schema: {
            type: "object",
            required: ["message"],
            properties: {
              message: {
                type: "string",
                description: "Your conversational response to the parent. Warm, encouraging, concise (3-5 sentences max).",
              },
              nextStage: {
                type: "string",
                enum: ["greeting", "title", "image", "backcover", "author", "ready"],
                description: "Only include if the conversation should advance to the next stage. Omit to stay in current stage.",
              },
              confirmedTitle: {
                type: "string",
                description: "Include ONLY when the parent has agreed on a final title. This will update the book title.",
              },
              coverCharacterIds: {
                type: "array",
                items: { type: "string" },
                description: "Character IDs the parent wants on the front cover. Include when discussed.",
              },
              coverLocationIds: {
                type: "array",
                items: { type: "string" },
                description: "Location IDs for the cover scene. Include when discussed.",
              },
              backCoverContent: {
                type: "string",
                description: "The dedication, blurb, or character message for the back cover.",
              },
              authorCredit: {
                type: "string",
                description: "The author credit line (e.g. 'Written by Mummy & FlipWhizz').",
              },
            },
          },
        },
      ],
      tool_choice: { type: "tool", name: TOOL_NAME },
      messages: claudeMessages,
    });

    // ── Extract response ──
    const toolBlock = response.content.find(
      (b): b is Anthropic.Messages.ToolUseBlock =>
        b.type === "tool_use" && b.name === TOOL_NAME
    );

    if (!toolBlock) {
      return NextResponse.json({ error: "AI failed to respond" }, { status: 500 });
    }

    const payload = toolBlock.input as any;

    // ── Save assistant message ──
    await db.insert(coverChatMessages).values({
      id: uuid(),
      sessionId: session.id,
      role: "assistant",
      content: payload.message,
      createdAt: new Date(),
    });

    // ── Update cover plan in session ──
    const planUpdate: any = {};
    if (payload.confirmedTitle) planUpdate.titleText = payload.confirmedTitle;
    if (payload.coverCharacterIds) planUpdate.charactersShown = payload.coverCharacterIds;
    if (payload.coverLocationIds) planUpdate.locationsShown = payload.coverLocationIds;
    if (payload.backCoverContent) planUpdate.backCoverText = payload.backCoverContent;
    if (payload.authorCredit) planUpdate.authorText = payload.authorCredit;

    if (Object.keys(planUpdate).length > 0) {
      const existing = (session.coverPlan as any) || {};
      await db
        .update(coverChatSessions)
        .set({
          coverPlan: { ...existing, ...planUpdate },
          planUpdatedAt: new Date(),
        })
        .where(eq(coverChatSessions.id, session.id));
    }

    // ── Return to frontend ──
    return NextResponse.json({
      message: payload.message,
      stage: payload.nextStage || undefined,
      confirmedTitle: payload.confirmedTitle || undefined,
      coverCharacterIds: payload.coverCharacterIds || undefined,
      coverLocationIds: payload.coverLocationIds || undefined,
      backCoverContent: payload.backCoverContent || undefined,
      authorCredit: payload.authorCredit || undefined,
      sessionId: session.id,
    });
  } catch (err: any) {
    console.error("Cover chat error:", err);
    return NextResponse.json(
      { error: "Cover chat failed", details: err.message },
      { status: 500 }
    );
  }
}

/* -------------------------------------------------------------------------- */
/*  STAGE-SPECIFIC SYSTEM PROMPTS                                              */
/* -------------------------------------------------------------------------- */

function buildSystemPrompt(ctx: {
  stage: CoverStage;
  title: string;
  summary: string;
  charNames: string;
  locNames: string;
  protagonistName: string;
  artStyle: string;
  confirmedTitle: string | null;
  backCoverContent: string | null;
  authorCredit: string | null;
  characters: any[];
  locations: any[];
}): string {
  const base = `
You are FlipWhizz's cover designer — warm, encouraging, and decisive.
You're helping a parent create the perfect cover for their child's personalised storybook.

STORY: "${ctx.title}"
SUMMARY: ${ctx.summary || "A personalised children's story."}
CHARACTERS: ${ctx.charNames || "Not specified"}
LOCATIONS: ${ctx.locNames || "Not specified"}
ART STYLE: ${ctx.artStyle}

RULES:
- You MUST call the tool "cover_chat_response"
- Keep responses to 3-5 sentences. Warm but concise.
- Be specific and decisive — suggest concrete options, don't be vague.
- Use the child's name (${ctx.protagonistName}) naturally.
- When the parent agrees on something, include the relevant data field AND set nextStage to advance.
- Only set nextStage when the current topic is resolved.
`.trim();

  const stageInstructions: Record<CoverStage, string> = {
    greeting: `
    CURRENT STAGE: GREETING
    This is the very first message. Your ONLY job is:
    1. Give a warm, specific 2-sentence greeting mentioning ${ctx.protagonistName} by name
    2. Then ask ONLY about the title: "The title is currently '${ctx.title}' — do you love it, or would you like to change it?"
    
    Do NOT ask about the cover image.
    Do NOT ask about the author credit.
    Do NOT ask about the back cover.
    Do NOT offer options A/B/C for anything.
    ONLY greet and ask about the title.
    Set nextStage to "title".
    `,
    title: `
    CURRENT STAGE: TITLE
    You are ONLY discussing the book title. Nothing else.
    Current title: "${ctx.title}".
    
    If the parent says they like it / love it / it's fine / yes / keep it:
    → Confirm warmly, set confirmedTitle to "${ctx.title}", set nextStage to "image"
    → Then ask: "Brilliant! Now, who should be on the front cover?"
    
    If they want to change it:
    → Suggest 2-3 fun alternatives that fit the story
    → Do NOT set nextStage — stay here until they pick one
    
    If they pick a new title:
    → Confirm it, set confirmedTitle to their choice, set nextStage to "image"
    
    Do NOT discuss the cover image, back cover, or author credit yet.
    `,
    image: `
CURRENT STAGE: COVER IMAGE
Ask about the front cover illustration. The available characters are: ${ctx.charNames}.
The available locations are: ${ctx.locNames}.

Guide them through:
1. Which characters on the front? (suggest the protagonist + 1-2 key characters)
2. What scene or setting?
3. What mood? (funny, adventurous, cozy)

When they've described their vision, set coverCharacterIds to the relevant character IDs
(available: ${ctx.characters.map((c: any) => `${c.name}=${c.id}`).join(", ")}),
set coverLocationIds if a location was chosen
(available: ${ctx.locations.map((l: any) => `${l.name}=${l.id}`).join(", ")}),
and set nextStage to "backcover".

When transitioning, ask about the back cover: "Now for the back — would you like a dedication, a character message, or a short blurb?"
`,
    backcover: `
CURRENT STAGE: BACK COVER
Help the parent decide what goes on the back cover. Offer options:
- A dedication from the parent (e.g. "For ${ctx.protagonistName}, the bravest adventurer I know")
- A funny message from a character
- A short blurb about the story
- Skip / keep it simple

When decided, set backCoverContent to the text and set nextStage to "author".
When transitioning, ask: "Last thing — who should we credit as the author?"
`,
    author: `
CURRENT STAGE: AUTHOR CREDIT
Help decide the author credit. Suggest fun options:
- Their name
- "Written by Mummy & FlipWhizz" (or similar)
- "A ${ctx.protagonistName} Adventure, by [parent name]"
- The child as author

When decided, set authorCredit to the credit line and set nextStage to "ready".
When transitioning, say something like: "We've got everything we need! Hit 'Generate Cover' whenever you're ready."
`,
    ready: `
CURRENT STAGE: READY
The cover plan is complete:
- Title: ${ctx.confirmedTitle || ctx.title}
- Back cover: ${ctx.backCoverContent || "Not set"}
- Author: ${ctx.authorCredit || "Not set"}

If the parent wants to change something, help them and update the relevant field.
If they're happy, encourage them to hit the Generate button.
`,
  };

  return `${base}\n\n${stageInstructions[ctx.stage]}`;
}