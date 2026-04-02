// src/app/api/stories/cover-chat/route.ts
//
// Staged cover design conversation.

import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/db";
import {
  stories,
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

    console.log("🎨 Cover chat request:", { stage, message: message?.substring?.(0, 50) });

    // ── Load story ──
    const storyData = await db
      .select()
      .from(stories)
      .where(eq(stories.id, storyId))
      .then((r) => r[0]);

    if (!storyData) {
      return NextResponse.json({ error: "Story not found" }, { status: 404 });
    }

    // ── Load style ──
    const styleData = await db.query.storyStyleGuide.findFirst({
      where: eq(storyStyleGuide.storyId, storyId),
    });

    // ── Characters + locations from frontend world data ──
    const chars = world?.characters ?? [];
    const locs = world?.locations ?? [];

    // ── Get or create session ──
    let session = await db
      .select()
      .from(coverChatSessions)
      .where(eq(coverChatSessions.storyId, storyId))
      .then((r) => r[0]);

    if (!session) {
      const [created] = await db
        .insert(coverChatSessions)
        .values({ id: uuid(), storyId, coverPlan: null, createdAt: new Date() })
        .returning();
      session = created;
    }

    // ── Save user message (skip __START__) ──
    if (message && message !== "__START__") {
      await db.insert(coverChatMessages).values({
        id: uuid(),
        sessionId: session.id,
        role: "user",
        content: message,
        createdAt: new Date(),
      });
    }

    // ── Build context strings ──
    const charNames = chars.map((c: any) => `${c.name}${c.role ? ` (${c.role})` : ""}`).join(", ");
    const locNames = locs.map((l: any) => l.name).join(", ");
    const protagonist = chars.find((c: any) => c.role === "protagonist" || c.role === "main");
    const protagonistName = protagonist?.name || chars[0]?.name || "the reader";
    const currentTitle = confirmedTitle || storyData.title;

    // ── Build system prompt ──
    const SYSTEM = buildSystemPrompt({
      stage: stage as CoverStage,
      title: currentTitle,
      summary: storyData.description || (storyData as any).storyBrief || "",
      fullDraft: storyData.fullDraft?.slice(0, 400) || "",
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

    console.log("🎨 Using stage:", stage);

    // ── Load conversation history from DB ──
    const dbHistory = await db
      .select({ role: coverChatMessages.role, content: coverChatMessages.content })
      .from(coverChatMessages)
      .where(eq(coverChatMessages.sessionId, session.id))
      .orderBy(asc(coverChatMessages.createdAt));

    const claudeMessages = dbHistory.length > 0
      ? dbHistory.map((m) => ({ role: m.role as "user" | "assistant", content: m.content }))
      : [{ role: "user" as const, content: message === "__START__"
          ? "Hi! I'm ready to design the cover for my book."
          : message }];

    // ── Call Claude with structured tool ──
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system: SYSTEM,
      tools: [
        {
          name: TOOL_NAME,
          description: "Respond to the parent with your message and any stage/data updates.",
          input_schema: {
            type: "object" as const,
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
                description: "Character IDs the parent wants on the front cover.",
              },
              coverLocationIds: {
                type: "array",
                items: { type: "string" },
                description: "Location IDs for the cover scene.",
              },
              backCoverContent: {
                type: "string",
                description: "The dedication, blurb, or character message for the back cover.",
              },
              authorCredit: {
                type: "string",
                description: "The author credit line.",
              },
            },
          },
        },
      ],
      tool_choice: { type: "tool" as const, name: TOOL_NAME },
      messages: claudeMessages,
    });

    // ── Extract response ──
    const toolBlock = response.content.find(
      (b): b is Anthropic.Messages.ToolUseBlock =>
        b.type === "tool_use" && b.name === TOOL_NAME
    );

    if (!toolBlock) {
      console.error("🎨 No tool block in response");
      return NextResponse.json({ message: "Sorry — I had trouble responding. Please try again." }, { status: 200 });
    }

    const payload = toolBlock.input as any;

    // ── FALLBACK: If advancing from image stage without IDs, inject them ──
    if (stage === "image" && payload.nextStage === "backcover") {
      if (!payload.coverCharacterIds?.length) {
        console.warn("⚠️ Image stage advanced without coverCharacterIds — injecting all characters");
        payload.coverCharacterIds = chars.map((c: any) => c.id);
      }
      if (!payload.coverLocationIds?.length) {
        const msgLower = (message || "").toLowerCase();
        const matchedLoc = locs.find((l: any) => msgLower.includes(l.name.toLowerCase()));
        if (matchedLoc) {
          console.warn("⚠️ Image stage advanced without coverLocationIds — matched from message:", matchedLoc.name);
          payload.coverLocationIds = [matchedLoc.id];
        }
      }
    }

    console.log("🎨 Claude response:", {
      message: payload.message?.substring(0, 80),
      nextStage: payload.nextStage,
      hasTitle: !!payload.confirmedTitle,
      charIds: payload.coverCharacterIds?.length ?? 0,
      locIds: payload.coverLocationIds?.length ?? 0,
      hasBackCover: !!payload.backCoverContent,
      hasAuthor: !!payload.authorCredit,
    });

    // ── Save assistant message ──
    if (payload.message) {
      await db.insert(coverChatMessages).values({
        id: uuid(),
        sessionId: session.id,
        role: "assistant",
        content: payload.message,
        createdAt: new Date(),
      });
    }

    // ── Update cover plan in session ──
    const planUpdate: any = {};
    if (payload.confirmedTitle) planUpdate.titleText = payload.confirmedTitle;
    if (payload.coverCharacterIds?.length) planUpdate.charactersShown = payload.coverCharacterIds;
    if (payload.coverLocationIds?.length) planUpdate.locationsShown = payload.coverLocationIds;
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
    console.error("🎨 Cover chat error:", err);
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
  fullDraft: string;
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
SUMMARY: ${ctx.summary || ctx.fullDraft || "A personalised children's story."}
CHARACTERS: ${ctx.charNames || "Not specified"}
LOCATIONS: ${ctx.locNames || "Not specified"}
ART STYLE: ${ctx.artStyle}

RULES:
- You MUST call the tool "cover_chat_response"
- Keep responses to 3-5 sentences. Warm but concise.
- Be specific — suggest concrete options, don't be vague.
- Use the child's name (${ctx.protagonistName}) naturally.
- When the parent agrees on something, include the relevant data field AND set nextStage.
- Only set nextStage when the current topic is fully resolved.
- Do NOT use markdown bold (**text**). Write in plain text.
`.trim();

  const stageInstructions: Record<CoverStage, string> = {
    greeting: `
CURRENT STAGE: GREETING
This is the very first message. Your ONLY job is:
1. Give a warm 2-sentence greeting mentioning ${ctx.protagonistName} by name. Say something specific that shows you know this story.
2. Then ask ONLY about the title: "The title is currently '${ctx.title}' — do you love it, or would you like to change it?"

Do NOT ask about the cover image.
Do NOT ask about the author credit.
Do NOT ask about the back cover.
Do NOT offer numbered options A/B/C.
ONLY greet warmly and ask about the title.
Set nextStage to "title".
`,
    title: `
CURRENT STAGE: TITLE
You are ONLY discussing the book title. Nothing else.
Current title: "${ctx.title}".

If the parent says they like it / love it / yes / keep it / it's fine / it's great:
→ Confirm warmly in one sentence, set confirmedTitle to "${ctx.title}", set nextStage to "image".
→ End with: "Now, who should be on the front cover?"

If they want to change it:
→ Suggest 2-3 fun alternatives that fit the story. Stay in this stage (do NOT set nextStage).

If they pick a new title:
→ Confirm it, set confirmedTitle to their choice, set nextStage to "image".
→ End with: "Now, who should be on the front cover?"

Do NOT discuss the cover image, back cover, or author credit yet.
Do NOT offer numbered options for anything other than title alternatives.
`,
    image: `
CURRENT STAGE: COVER IMAGE
You are ONLY discussing the front cover illustration. Nothing else.

Available characters — you MUST use these EXACT IDs when setting coverCharacterIds:
${ctx.characters.map((c: any) => `  - "${c.name}" → ID: "${c.id}"`).join("\n")}

Available locations — you MUST use these EXACT IDs when setting coverLocationIds:
${ctx.locations.map((l: any) => `  - "${l.name}" → ID: "${l.id}"`).join("\n")}

ALL character IDs for convenience: ${ctx.characters.map((c: any) => `"${c.id}"`).join(", ")}

Guide them through:
1. Which characters on the front? Suggest the protagonist + 1-2 key characters.
2. What scene or setting? Suggest a location from the list above.
3. What mood? (funny, adventurous, cozy)

You can ask these as one grouped question.

CRITICAL RULES:
- Do NOT set nextStage to "backcover" until you have confirmed BOTH characters AND location.
- If the parent picks characters but not a location, ask about the location. Stay in this stage.
- If the parent picks a location but not characters, ask about characters. Stay in this stage.
- If the parent says "all of them" or "everyone", set coverCharacterIds to ALL IDs: ${ctx.characters.map((c: any) => `"${c.id}"`).join(", ")}
- You MUST include coverCharacterIds in your response when advancing. This is REQUIRED — without it the cover will have no characters.
- You MUST include coverLocationIds in your response when advancing.

When BOTH characters and location are confirmed:
→ Set coverCharacterIds with EVERY character ID that should appear.
→ Set coverLocationIds with the location ID.
→ Set nextStage to "backcover".
→ End with: "Now for the back cover — would you like a dedication, a character message, or a short blurb?"

Do NOT discuss the title (already confirmed) or author credit yet.
`,
    backcover: `
CURRENT STAGE: BACK COVER
You are ONLY discussing the back cover content. Nothing else.

Help the parent decide. Offer these options naturally:
- A dedication from the parent (e.g. "For ${ctx.protagonistName}, the bravest adventurer I know")
- A funny message from a character (e.g. "Love and slobbery kisses, Naverly")
- A short blurb about the story
- Keep it simple / skip

When they decide:
→ Set backCoverContent to the text they chose or you helped write.
→ Set nextStage to "author".
→ End with: "Last thing — who should we credit as the author?"

Do NOT discuss title, cover image, or author credit.
`,
    author: `
CURRENT STAGE: AUTHOR CREDIT
You are ONLY discussing the author credit. Nothing else.

Suggest fun options:
- Their name (ask what name they'd like)
- "Written by Mummy & FlipWhizz" or similar
- "A ${ctx.protagonistName} Adventure, by [name]"
- The child as author
- No author credit

When they decide:
→ Set authorCredit to the credit line.
→ Set nextStage to "ready".
→ Say something like: "We've got everything! Hit Generate Cover whenever you're ready."

Do NOT discuss anything else.
`,
    ready: `
CURRENT STAGE: READY
The cover plan is complete:
- Title: ${ctx.confirmedTitle || ctx.title}
- Back cover: ${ctx.backCoverContent || "Not set"}
- Author: ${ctx.authorCredit || "Not set"}

If the parent wants to change something, help them and update the relevant field.
If they're happy, encourage them to hit the Generate button.
Do NOT set nextStage unless going back to fix something.
`,
  };

  return `${base}\n\n${stageInstructions[ctx.stage]}`;
} 