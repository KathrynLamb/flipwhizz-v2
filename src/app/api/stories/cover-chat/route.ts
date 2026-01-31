// app/api/stories/cover-chat/route.ts

import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/db";
import {
  stories,
  coverChatSessions,
  coverChatMessages,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import { v4 as uuid } from "uuid";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

/* -------------------------------------------------------------------------- */
/*                              SYSTEM PROMPT                                 */
/* -------------------------------------------------------------------------- */

function buildCoverChatSystemPrompt(story: any) {
  return `
You are helping a parent quickly decide a children's book cover.

IMPORTANT:
- This conversation feeds a STRUCTURED COVER PLAN.
- You are NOT designing images.
- You are NOT writing prompts.
- You are collecting DECISIONS ONLY.

STORY CONTEXT:
Title: ${story.title}
Story excerpt:
${story.fullDraft?.slice(0, 400) || "No story text provided"}

YOUR GOAL:
Reach a clear, final decision in 2–3 assistant turns MAX.

WHAT YOU NEED TO COLLECT:

FRONT COVER
- What should we SEE?
  (single character, group scene, symbolic image, moment from story)

AUTHOR TEXT
- Exact author credit text (e.g. "By Sophie", "By Mum and Sophie", or none)

BACK COVER
- Should there be:
  - a short blurb
  - a dedication
  - both
  - or nothing
- Rough visual idea (continue front scene or simpler background)

RULES:
- Be warm, direct, and efficient
- Ask grouped questions
- If vague, offer 2–3 concrete options
- DO NOT ask about fonts, colours, lighting, or layout
- When you have enough, clearly say you're ready

OUTPUT JSON ONLY:

{
  "message": "what you say to the user",
  "stage": "intro" | "exploring" | "ready",
  "summary": {
    "front": "one-line summary",
    "back": "one-line summary"
  }
}

When stage === "ready", your message MUST end with:
"Perfect — I have everything I need to create your cover."
`.trim();
}

/* -------------------------------------------------------------------------- */
/*                                   ROUTE                                    */
/* -------------------------------------------------------------------------- */

export async function POST(req: Request) {
  try {
    const { message, history = [], storyId } = await req.json();

    if (!message || !storyId) {
      return NextResponse.json(
        { reply: "(invalid request)" },
        { status: 400 }
      );
    }

    const story = await db
      .select()
      .from(stories)
      .where(eq(stories.id, storyId))
      .then((r) => r[0]);

    if (!story) {
      return NextResponse.json(
        { reply: "(story not found)" },
        { status: 404 }
      );
    }

    /* ----------------------------- SESSION SETUP ---------------------------- */

    let session = await db
      .select()
      .from(coverChatSessions)
      .where(eq(coverChatSessions.storyId, storyId))
      .then((r) => r[0]);

    if (!session) {
      const [created] = await db
        .insert(coverChatSessions)
        .values({
          id: uuid(),
          storyId,
          createdAt: new Date(),
        })
        .returning();
      session = created;
    }

    await db.insert(coverChatMessages).values({
      id: uuid(),
      sessionId: session.id,
      role: "user",
      content: message,
      createdAt: new Date(),
    });

    /* ------------------------------ CLAUDE INPUT ---------------------------- */

    const claudeMessages = history
      .filter((m: any) => m.role === "user" || m.role === "assistant")
      .map((m: any) => ({
        role: m.role,
        content: m.content,
      }));

    claudeMessages.push({ role: "user", content: message });

    const completion = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      system: buildCoverChatSystemPrompt(story),
      max_tokens: 600,
      messages: claudeMessages,
    });

    const raw =
      completion.content.find((b) => b.type === "text")?.text ?? "";

    let parsed: {
      message: string;
      stage: "intro" | "exploring" | "ready";
      summary?: any;
    };

    try {
      const match =
        raw.match(/```json\s*([\s\S]*?)\s*```/) ||
        raw.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(match ? match[1] || match[0] : raw);
    } catch {
      parsed = {
        message: raw,
        stage: "exploring",
        summary: {},
      };
    }

    // 🔒 Clamp stage
    if (!["intro", "exploring", "ready"].includes(parsed.stage)) {
      parsed.stage = "exploring";
    }

    // 🔒 Enforce ready termination
    if (
      parsed.stage === "ready" &&
      !parsed.message.endsWith(
        "Perfect — I have everything I need to create your cover."
      )
    ) {
      parsed.message +=
        "\n\nPerfect — I have everything I need to create your cover.";
    }

    await db.insert(coverChatMessages).values({
      id: uuid(),
      sessionId: session.id,
      role: "assistant",
      content: parsed.message,
      createdAt: new Date(),
    });

    return NextResponse.json({
      reply: parsed.message,
      stage: parsed.stage,
      summary: parsed.summary ?? {},
      sessionId: session.id,
    });
  } catch (err) {
    console.error("Cover chat error:", err);
    return NextResponse.json(
      { reply: "(error)" },
      { status: 500 }
    );
  }
}
