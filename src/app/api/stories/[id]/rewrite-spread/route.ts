import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/db";
import { storyPages } from "@/db/schema";
import { eq } from "drizzle-orm";

/* -------------------- CLIENT -------------------- */

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

/* -------------------- ROUTE -------------------- */

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    const { id: storyId } = await context.params;

    const body = await request.json();
    const {
      spreadIndex,
      conversationHistory,
      pages,
    }: {
      spreadIndex: number;
      conversationHistory: any[];
      pages: Array<{
        id: string;
        pageNumber: number;
        text: string | null;
      }>;
    } = body;

    /* -------------------- PROMPT -------------------- */

    const systemPrompt = `You are rewriting a children's book spread based on the author's feedback.

ORIGINAL SPREAD:
LEFT PAGE (${pages[0]?.pageNumber}): ${pages[0]?.text || "(blank)"}
RIGHT PAGE (${pages[1]?.pageNumber}): ${pages[1]?.text || "(blank)"}

Based on the conversation, rewrite these two pages.

CRITICAL: Output ONLY valid JSON in this exact format:
{
  "leftPage": "new text for left page",
  "rightPage": "new text for right page"
}

Do not include any preamble, explanation, or markdown code blocks.`;

    /* -------------------- CLAUDE -------------------- */

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system: systemPrompt,
      messages: [
        ...conversationHistory,
        {
          role: "user",
          content:
            "Please rewrite these two pages now based on our discussion.",
        },
      ] as any,
    });

    const rawText = response.content
      .filter((block) => block.type === "text")
      .map((block) => (block as any).text)
      .join("\n")
      .trim();

    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in Claude response");
    }

    const result: {
      leftPage?: string;
      rightPage?: string;
    } = JSON.parse(jsonMatch[0]);

    /* -------------------- DB UPDATE -------------------- */

    const updates: Promise<unknown>[] = [];

    if (pages[0]?.id && result.leftPage) {
        updates.push(
          db
            .update(storyPages)
            .set({ text: result.leftPage })
            .where(eq(storyPages.id, pages[0].id))
        );
      }
      
      if (pages[1]?.id && result.rightPage) {
        updates.push(
          db
            .update(storyPages)
            .set({ text: result.rightPage })
            .where(eq(storyPages.id, pages[1].id))
        );
      }
      

    await Promise.all(updates);

    /* -------------------- RESPONSE -------------------- */

    return NextResponse.json({
      success: true,
      updatedPages: {
        left: result.leftPage ?? null,
        right: result.rightPage ?? null,
      },
    });
  } catch (error) {
    console.error("Rewrite spread error:", error);
    return NextResponse.json(
      { error: "Failed to rewrite spread" },
      { status: 500 }
    );
  }
}
