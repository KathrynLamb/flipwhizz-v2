// src/app/api/stories/[id]/rewrite-chat/route.ts
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/db";
import { storyEditSessions, storyEditMessages } from "@/db/schema";
import { eq } from "drizzle-orm";
import { v4 as uuid } from "uuid";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    const { id: storyId } = await context.params;

    const body = await request.json();
    const {
      message,
      conversationHistory,
      currentSpread,
      storyContext,
    }: {
      message: string;
      conversationHistory: any[];
      currentSpread: {
        pages: Array<{ pageNumber?: number; text?: string | null }>;
      };
      storyContext: {
        title: string;
        allPages?: Array<{ pageNumber: number; text: string }>;
      };
    } = body;

    // ── Persist: get or create edit session ──
    let session = await db
      .select()
      .from(storyEditSessions)
      .where(eq(storyEditSessions.storyId, storyId))
      .limit(1)
      .then((rows) => rows[0]);

    if (!session) {
      const sessionId = uuid();
      const now = new Date();
      await db.insert(storyEditSessions).values({
        id: sessionId,
        storyId,
        lastMessageAt: now,
        createdAt: now,
        updatedAt: now,
      });
      session = { id: sessionId, storyId, lastMessageAt: now, createdAt: now, updatedAt: now };
    }

    // ── Save user message ──
    await db.insert(storyEditMessages).values({
      id: uuid(),
      sessionId: session.id,
      role: "user",
      content: message,
      createdAt: new Date(),
    });

    // ── Build system prompt ──
    const spreadContext = currentSpread?.pages?.length
      ? `\nCURRENT SPREAD (Pages ${currentSpread.pages[0]?.pageNumber ?? "?"}–${currentSpread.pages[1]?.pageNumber ?? "?"}):\nLEFT: ${currentSpread.pages[0]?.text || "(blank)"}\nRIGHT: ${currentSpread.pages[1]?.text || "(blank)"}`
      : "";

    const systemPrompt = `You are a collaborative children's book co-author working with a parent on "${storyContext.title}".

You've already shared your initial thoughts on the draft. Now you're here to help refine it — whatever the parent needs.
${spreadContext}

YOUR ROLE:
- You can discuss ANY aspect of the story: a single word, a character name, the tone of the entire book, educational goals, pronouns, reading level, plot changes, pacing — anything.
- Follow the parent's lead. If they want to change one word, help with that. If they want to rebuild the story around phonics, help with that too.
- Ask clarifying questions when the request is broad. "Make it funnier" → "What kind of funny? Silly slapstick, or dry wit? More funny dialogue, or funny situations?"
- Be specific in your suggestions. Don't say "I could make it more engaging" — say "I could add a moment where Bodi accidentally sits on the map and everyone has to peel it off her fur."
- Keep responses conversational and brief. 2-3 sentences usually. Don't write essays.
- You're DISCUSSING changes, not making them. The parent clicks "Apply changes" when ready.

IMPORTANT:
- If the parent reveals something about their child (learning phonics, starting school, a fear, a preference), acknowledge it naturally. This information will help make this story — and future stories — better for their child.
- Never be precious about the draft. The parent's vision matters more than yours.
- If asked about something you're unsure of, be honest rather than confident.`;

    const messages = [
      ...conversationHistory,
      { role: "user", content: message },
    ];

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 600,
      system: systemPrompt,
      messages: messages as any,
    });

    const reply = response.content
      .filter((block) => block.type === "text")
      .map((block) => (block as any).text)
      .join("\n")
      .trim();

    // ── Save assistant reply ──
    await db.insert(storyEditMessages).values({
      id: uuid(),
      sessionId: session.id,
      role: "assistant",
      content: reply,
      createdAt: new Date(),
    });

    // ── Update session timestamp ──
    await db
      .update(storyEditSessions)
      .set({ lastMessageAt: new Date(), updatedAt: new Date() })
      .where(eq(storyEditSessions.id, session.id));

    const updatedHistory = [
      ...messages,
      { role: "assistant", content: reply },
    ];

    return NextResponse.json({
      reply,
      conversationHistory: updatedHistory,
    });
  } catch (error) {
    console.error("Rewrite chat error:", error);
    return NextResponse.json(
      { error: "Failed to process chat message" },
      { status: 500 }
    );
  }
}