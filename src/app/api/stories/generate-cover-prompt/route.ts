// app/api/stories/generate-cover-prompt/route.ts

import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/db";
import { stories } from "@/db/schema";
import { eq } from "drizzle-orm";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

/* -------------------------------------------------------------------------- */
/*                                SYSTEM PROMPTS                              */
/* -------------------------------------------------------------------------- */

function buildCoverPlanSystemPrompt(story: any) {
  return `
You are a book cover planning assistant.

You DO NOT generate image prompts.
You DO NOT design typography.
You ONLY extract a STRUCTURED COVER PLAN.

This plan will be consumed by a separate image model that:
- Renders text directly into the image
- Obeys a strict wrap-around cover layout template
- Produces ONE image containing BACK + SPINE + FRONT

STORY CONTEXT:
Title: ${story.title}
Story excerpt:
${story.fullDraft?.slice(0, 500) || "No story text provided"}

YOUR TASK:
From the conversation history, extract a SINGLE, FINAL cover plan.

OUTPUT JSON ONLY.
NO MARKDOWN.
NO COMMENTS.

STRICT FORMAT:

{
  "format": "wrap-spread",

  "front": {
    "titleText": "exact title text to render",
    "authorText": "exact author credit text (optional)",
    "visualIntent": "short, concrete description of what should appear visually on the FRONT cover"
  },

  "spine": {
    "spineText": "text to appear on the spine (usually the title)"
  },

  "back": {
    "blurbText": "short back cover blurb (optional)",
    "dedicationText": "dedication text if requested (optional)",
    "visualIntent": "short description of visual treatment on the BACK cover"
  },

  "constraints": {
    "noTextOutsideSafeZones": true,
    "keepBarcodeAreaClear": true
  },

  "reasoning": "brief explanation of choices (optional)"
}

RULES:
- Use ONLY information explicitly stated or clearly implied by the user
- Never invent names or text
- If author text is not specified, OMIT authorText
- If no back text was requested, OMIT blurbText and dedicationText
- visualIntent describes imagery ONLY — not layout, typography, or positioning

This JSON will be saved and LOCKED before image generation.
`.trim();
}

function buildChatGuidanceSystemPrompt(story: any) {
  return `
You are helping a parent quickly decide a children's book cover.

GOAL:
Reach a final decision in 2–3 turns MAX.

ONLY ask about:
- What should be SEEN on the front cover (scene / character / symbolic)
- Author credit text (child, adult, both, or none)
- Whether anything should appear on the back (blurb / dedication / nothing)

DO NOT ask about:
- Fonts
- Colours
- Lighting
- Camera angles
- Typography styles
- Layout mechanics

If the user is vague, offer 2–3 concrete options.

When enough information is gathered:
- Respond naturally
- Clearly signal readiness

OUTPUT JSON ONLY:

{
  "message": "what you say to the user",
  "stage": "intro" | "exploring" | "ready",
  "summary": {
    "front": "one-line summary",
    "back": "one-line summary"
  }
}
`.trim();
}

/* -------------------------------------------------------------------------- */
/*                                   HANDLER                                  */
/* -------------------------------------------------------------------------- */

export async function POST(req: Request) {
  try {
    const { storyId, conversationHistory, mode } = await req.json();

    if (!storyId || !Array.isArray(conversationHistory)) {
      return NextResponse.json(
        { error: "storyId and conversationHistory are required" },
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
        { error: "Story not found" },
        { status: 404 }
      );
    }

    /* ----------------------------- FINALISE PLAN ---------------------------- */

    if (mode === "generate") {
      const completion = await client.messages.create({
        model: "claude-sonnet-4-20250514",
        system: buildCoverPlanSystemPrompt(story),
        max_tokens: 1200,
        messages: [
          {
            role: "user",
            content: JSON.stringify(conversationHistory),
          },
        ],
      });

      const raw =
        completion.content.find((b) => b.type === "text")?.text ?? "";

      let coverPlan: any;
      try {
        const match =
          raw.match(/```json\s*([\s\S]*?)\s*```/) ||
          raw.match(/\{[\s\S]*\}/);
        coverPlan = JSON.parse(match ? match[1] || match[0] : raw);
      } catch (err) {
        console.error("❌ Failed to parse cover plan:", raw);
        return NextResponse.json(
          { error: "Failed to parse cover plan" },
          { status: 500 }
        );
      }

      await db
        .update(stories)
        .set({
          coverPlan,
          coverPlanLocked: true,
          updatedAt: new Date(),
        })
        .where(eq(stories.id, storyId));

      return NextResponse.json({
        success: true,
        coverPlan,
      });
    }

    /* ------------------------------- CHAT MODE ------------------------------ */

    const lastMessage =
      conversationHistory[conversationHistory.length - 1];

    const completion = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      system: buildChatGuidanceSystemPrompt(story),
      max_tokens: 600,
      messages: [
        {
          role: "user",
          content: `Conversation:\n${JSON.stringify(
            conversationHistory
          )}\n\nLatest message: "${lastMessage?.content ?? ""}"`,
        },
      ],
    });

    const raw =
      completion.content.find((b) => b.type === "text")?.text ?? "";

    let result: any;
    try {
      const match =
        raw.match(/```json\s*([\s\S]*?)\s*```/) ||
        raw.match(/\{[\s\S]*\}/);
      result = JSON.parse(match ? match[1] || match[0] : raw);
    } catch {
      result = {
        message: raw,
        stage: "exploring",
        summary: {},
      };
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error("Cover plan route error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
