// app/api/stories/[id]/rewrite-chat/route.ts
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

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
        pages: Array<{
          pageNumber?: number;
          text?: string | null;
        }>;
      };
      storyContext: {
        title: string;
      };
    } = body;

    // Build context-aware system prompt
    const systemPrompt = `You are a collaborative children's book author working with a writer on their story "${storyContext.title}".

You've already introduced yourself and shared your initial thoughts about the draft. Now you're here to help refine it through conversation.

CURRENT SPREAD (Pages ${currentSpread.pages[0]?.pageNumber ?? "?"}-${currentSpread.pages[1]?.pageNumber ?? "?"}):
LEFT PAGE: ${currentSpread.pages[0]?.text || "(blank)"}
RIGHT PAGE: ${currentSpread.pages[1]?.text || "(blank)"}

Your role:
- Help the writer refine their story through conversation
- Ask clarifying questions about their vision
- Suggest specific improvements when asked
- Be encouraging and collaborative
- Keep responses conversational and brief (2-3 sentences)
- Focus on the current spread unless they ask about other pages

Remember: You're discussing edits, not making them yet. The writer will click "Apply Edits" when ready.`;

    const messages = [
      ...conversationHistory,
      { role: "user", content: message },
    ];

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 500,
      system: systemPrompt,
      messages: messages as any,
    });

    const reply = response.content
      .filter((block) => block.type === "text")
      .map((block) => (block as any).text)
      .join("\n")
      .trim();

    const updatedHistory = [
      ...messages,
      { role: "assistant", content: reply },
    ];

    return NextResponse.json({
      reply,
      conversationHistory: updatedHistory,
    });
  } catch (error) {
    console.error("Chat error:", error);
    return NextResponse.json(
      { error: "Failed to process chat message" },
      { status: 500 }
    );
  }
}