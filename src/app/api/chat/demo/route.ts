// /api/chat/demo/route.ts
// Fixed version with proper sessionId handling

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/db";
import { chatMessages, chatSessions } from "@/db/schema";
import { eq } from "drizzle-orm";

type DemoMsg = {
  role: "user" | "assistant";
  content: string;
};

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

function isValidMessageArray(value: unknown): value is DemoMsg[] {
  return (
    Array.isArray(value) &&
    value.every(
      (msg) =>
        msg &&
        (msg.role === "user" || msg.role === "assistant") &&
        typeof msg.content === "string"
    )
  );
}

function buildDemoSystemPrompt() {
  return `You are FlipWhizz, a warm and imaginative children's story creation guide.

This is a PUBLIC DEMO, not the full project workspace.

Your job:
- Help the user shape a story idea in a delightful, conversational way
- Keep replies short: 2-3 sentences, max 2 short paragraphs
- Reflect back the most vivid details they shared
- Add one small imaginative twist
- Ask exactly one helpful follow-up question
- Do NOT write the full story
- Do NOT sound corporate, scripted, or technical

Tone:
Warm, playful, collaborative, specific, child-centred.`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const message =
      typeof body?.message === "string" ? body.message.trim() : "";
    const history = body?.history;
    const sessionId = typeof body?.sessionId === "string" ? body.sessionId : "";

    if (!message) {
      return NextResponse.json({ error: "Missing message." }, { status: 400 });
    }

    if (!sessionId) {
      return NextResponse.json({ error: "Missing sessionId." }, { status: 400 });
    }

    if (!isValidMessageArray(history)) {
      return NextResponse.json({ error: "Invalid history." }, { status: 400 });
    }

    // Ensure the demo session exists before inserting messages
    try {
      const existingSession = await db
        .select({ id: chatSessions.id })
        .from(chatSessions)
        .where(eq(chatSessions.id, sessionId as any))
        .limit(1)
        .then((rows) => rows[0]);

      if (!existingSession) {
        // Create a new demo session with userId=null, projectId=null
        await db.insert(chatSessions).values({
          id: sessionId as any, // UUID from frontend
          userId: null,
          projectId: null,
          status: "open",
          lastMessageAt: new Date(),
        });
      }
    } catch (sessionErr) {
      console.error("[demo chat] session creation/lookup error:", sessionErr);
      throw new Error("Failed to initialize chat session");
    }

    const trimmedHistory = history
      .filter((m) => m.role === "user" || m.role === "assistant")
      .slice(-8)
      .map((m) => ({
        role: m.role,
        content: m.content,
      }));

    // Call Claude
    const completion = await client.messages.create({
      model: "claude-sonnet-4-6",
      system: buildDemoSystemPrompt(),
      max_tokens: 300,
      messages: [
        ...trimmedHistory,
        { role: "user", content: message },
      ],
    });

    const reply =
      completion.content
        .map((block) => (block.type === "text" ? block.text : ""))
        .filter(Boolean)
        .join("\n")
        .trim() ||
      "That already feels like the start of something lovely. What's one more detail you'd want in the story?";

    // Persist both user message and assistant reply to DB
    const now = new Date();
    try {
      await db.insert(chatMessages).values([
        {
          sessionId: sessionId as any,
          role: "user",
          content: message,
          createdAt: now,
        },
        {
          sessionId: sessionId as any,
          role: "assistant",
          content: reply,
          createdAt: new Date(now.getTime() + 1), // slight delay so reply comes after
        },
      ]);
    } catch (msgErr) {
      console.error("[demo chat] message insert error:", msgErr);
      throw new Error("Failed to save messages");
    }

    // Update the session's lastMessageAt
    try {
      await db
        .update(chatSessions)
        .set({ lastMessageAt: new Date() })
        .where(eq(chatSessions.id, sessionId as any));
    } catch (updateErr) {
      console.warn("[demo chat] session update error (non-critical):", updateErr);
      // Don't throw—this is just a timestamp update
    }

    return NextResponse.json({ reply });
  } catch (error) {
    console.error("[demo chat] error:", error);

    const message =
      error instanceof Error ? error.message : "Demo chat failed.";

    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}