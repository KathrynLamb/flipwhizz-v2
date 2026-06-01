// src/app/api/stories/[id]/style-guide/chat/route.ts
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/db";
import { stories } from "@/db/schema";
import { eq } from "drizzle-orm";

export const maxDuration = 30;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
const MODEL = "claude-sonnet-4-6";

type Message = { role: "user" | "assistant"; content: string };

const SYSTEM_PROMPT = `You are a children's book art director helping a parent find the perfect illustration style for their story.

YOUR GOAL: Through friendly conversation, gather enough information to produce a complete style specification. Once you have enough, output a JSON style object instead of a chat reply.

CONVERSATION RULES:
- Maximum 2-3 sentences per reply. Never more.
- Ask ONE question at a time.
- Be warm, enthusiastic, and encouraging.
- Reference specific books, artists, or shows if the parent mentions them — this helps enormously.
- Never use technical AI jargon with the parent.
- After 2-4 exchanges, you should have enough to resolve. Don't keep asking.

WHAT YOU NEED TO RESOLVE:
- Overall mood/feel (cosy/bold/magical/playful/etc.)
- Colour energy (warm/cool/bright/muted/etc.)
- Line quality (soft/sharp/sketchy/clean/etc.)
- Any strong references (books, shows, artists they love)
- Anything to avoid

WHEN TO RESOLVE:
You have enough when you understand: the mood, the colour direction, and the line/rendering style. You don't need perfect answers — make smart inferences from context clues.

TO RESOLVE: Output ONLY a JSON object with NO surrounding text, NO markdown, NO preamble. Start your response with { when resolving.

RESOLVED JSON SHAPE:
{
  "resolved": true,
  "summary": "2-3 warm parent-friendly sentences describing how the book will look and feel. Start with 'Every page of your book will...' or similar.",
  "artStyle": "Short 2-5 word label e.g. 'Bold graphic illustration' or 'Soft watercolour & ink'",
  "visualThemes": "3-5 mood keywords e.g. 'Cosmic adventure, bold colours, playful energy'",
  "colorPalette": {
    "primary": "e.g. 'deep space navy'",
    "secondary": "e.g. 'neon green'",
    "accent": "e.g. 'electric pink'",
    "mood": "e.g. 'bold and electric'",
    "hex": ["#1a1a2e", "#39ff14", "#ff0090"]
  },
  "promptBase": "10-15 comma-separated Gemini image generation keywords. Be specific: art medium, rendering style, lighting, texture, quality tags, palette. E.g. 'bold graphic novel illustration, clean ink outlines, flat cel shading, vibrant neon palette, cosmic space setting, children's book quality, dynamic composition, energetic linework, alien technology aesthetic, glitch effects, mission briefing style'",
  "negativePrompt": "8-12 comma-separated exclusions. E.g. 'photorealism, watercolour wash, soft painterly, muted tones, cosy cottage aesthetic, 3D render, CGI'"
}

IMPORTANT: The promptBase for this alien-device story concept should emphasise: bold graphic style, tech/screen aesthetic, alien UI elements, NOT soft watercolour or traditional storybook warmth — unless the parent specifically wants that contrast.`;

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: storyId } = await context.params;
    const { message, conversationHistory = [] }: {
      message: string;
      conversationHistory: Message[];
    } = await request.json();

    if (!message?.trim()) {
      return NextResponse.json({ error: "Missing message" }, { status: 400 });
    }

    // Load story title for context
    let storyTitle = "your story";
    try {
      const story = await db
        .select({ title: stories.title })
        .from(stories)
        .where(eq(stories.id, storyId))
        .limit(1)
        .then(r => r[0]);
      if (story?.title) storyTitle = story.title;
    } catch { /* non-fatal */ }

    const systemWithContext = SYSTEM_PROMPT + `\n\nSTORY TITLE: "${storyTitle}" — use this for context when inferring style.`;

    const messages: Message[] = [
      ...conversationHistory.map(({ role, content }) => ({ role, content })),
      { role: "user", content: message },
    ];

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 600,
      system: systemWithContext,
      messages,
    });

    const rawReply = response.content
      .filter(b => b.type === "text")
      .map(b => (b as any).text)
      .join("\n")
      .trim();

    // Check if Claude resolved
    if (rawReply.startsWith("{")) {
      try {
        // Strip any trailing text after the JSON
        const jsonEnd = rawReply.lastIndexOf("}") + 1;
        const jsonStr = rawReply.slice(0, jsonEnd);
        const parsed = JSON.parse(jsonStr);

        if (parsed.resolved) {
          return NextResponse.json({
            resolved: true,
            styleGuide: parsed,
            conversationHistory: [
              ...messages,
              { role: "assistant", content: rawReply },
            ],
          });
        }
      } catch {
        // Fall through to treat as chat reply
      }
    }

    return NextResponse.json({
      resolved: false,
      reply: rawReply,
      conversationHistory: [
        ...messages,
        { role: "assistant", content: rawReply },
      ],
    });
  } catch (error) {
    console.error("[style-guide/chat]", error);
    return NextResponse.json({ error: "Chat failed" }, { status: 500 });
  }
}