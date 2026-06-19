//api/chat/demo/route.ts


import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

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

    if (!message) {
      return NextResponse.json({ error: "Missing message." }, { status: 400 });
    }

    if (!isValidMessageArray(history)) {
      return NextResponse.json({ error: "Invalid history." }, { status: 400 });
    }

    const trimmedHistory = history
      .filter((m) => m.role === "user" || m.role === "assistant")
      .slice(-8)
      .map((m) => ({
        role: m.role,
        content: m.content,
      }));

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
      "That already feels like the start of something lovely. What’s one more detail you’d want in the story?";

    return NextResponse.json({ reply });
  } catch (error) {
    console.error("[demo chat] error:", error);

    return NextResponse.json(
      { error: "Demo chat failed." },
      { status: 500 }
    );
  }
}