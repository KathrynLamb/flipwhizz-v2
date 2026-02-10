// src/app/api/stories/cover-chat/route.ts
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/db";
import { stories, coverConversations } from "@/db/schema";
import { eq } from "drizzle-orm";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(req: Request) {
  try {
    const { storyId, message, history } = await req.json();

    if (!storyId || !message) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Load story for context
    const story = await db.query.stories.findFirst({
      where: eq(stories.id, storyId),
    });

    if (!story) {
      return NextResponse.json({ error: "Story not found" }, { status: 404 });
    }

    // Build conversation for Claude
    const messages = [
      ...history.map((h: any) => ({
        role: h.role,
        content: h.content,
      })),
      {
        role: "user",
        content: message,
      },
    ];

    // Call Claude
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      system: `You are a children's book cover designer helping to create a wrap-around cover (back, spine, front) for the story "${story.title}".

Guide the conversation to understand:
- What should be on the front cover (main visual, characters, setting)
- What should be on the back cover (blurb, dedication, or simple visual)
- How the spine should look (vertical title text)
- Author credit preference (by name, or something else)
- Overall visual style preferences

Be friendly, ask one question at a time, and help them visualize the final cover.`,
      messages,
    });

    const reply = response.content[0].type === "text" 
      ? response.content[0].text 
      : "I apologize, I couldn't generate a response.";

    // ✅ Save user message to database
    await db.insert(coverConversations).values({
      storyId,
      role: "user",
      content: message,
    });

    // ✅ Save assistant response to database
    await db.insert(coverConversations).values({
      storyId,
      role: "assistant",
      content: reply,
    });

    return NextResponse.json({ reply });
  } catch (err: any) {
    console.error("❌ [cover-chat]", err);
    return NextResponse.json(
      { error: err.message || "Failed to process chat" },
      { status: 500 }
    );
  }
}