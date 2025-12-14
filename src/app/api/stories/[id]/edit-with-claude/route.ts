// src/app/api/stories/[id]/edit-with-claude/route.ts
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

function extractClaudeText(content: any[]): string {
  return (content ?? [])
    .map((b) => (b?.type === "text" ? String(b.text ?? "") : ""))
    .filter((t) => t.trim().length > 0)
    .join("\n")
    .trim();
}

export async function POST(req: Request) {
  try {
    const { storyId, page, history = [] } = await req.json();

    if (!storyId || !page?.text) {
      return NextResponse.json(
        { error: "Missing storyId or page.text" },
        { status: 400 }
      );
    }

    const SYSTEM = `
You are FlipWhizz, an expert children's story editor.

RULES:
- Only edit the text for the CURRENT PAGE.
- Do not change the meaning drastically—keep the tone warm, simple, age 3–8.
- Keep the length similar (1–4 sentences).
- Return ONLY the improved page text, no markdown, no explanations.
`;

    const claudeMessages = (history as any[])
      .filter((m) => m?.role === "user" || m?.role === "assistant")
      .map((m) => ({
        role: m.role,
        content: String(m.content ?? ""),
      }));

    // IMPORTANT: the instruction + page text should be a USER message
    claudeMessages.push({
      role: "user",
      content: `Improve ONLY this page text:\n\n${page.text}`,
    });

    const completion = await client.messages.create({
      // Use your exact model id if you want; keep consistent with the rest of your app
      model: "claude-sonnet-4-5-20250929",
      system: SYSTEM,
      max_tokens: 800,
      messages: claudeMessages,
    });

    const updatedText = extractClaudeText(completion.content as any[]);
    if (!updatedText) {
      return NextResponse.json(
        { error: "Claude returned empty response" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      reply: updatedText,
      updatedText,
    });
  } catch (err) {
    console.error("[edit-with-claude] error:", err);
    return NextResponse.json(
      { error: "Failed to edit page" },
      { status: 500 }
    );
  }
}
