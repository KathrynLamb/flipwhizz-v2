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
/*                              SYSTEM PROMPTS                                */
/* -------------------------------------------------------------------------- */

type WorldRef = {
  characters: { id: string; name: string; role: string | null }[];
  locations: { id: string; name: string }[];
};

function buildWorldBlock(world?: WorldRef) {
  const characterBlock = world?.characters?.length
    ? world.characters
        .map(
          (c) =>
            `  - ID: "${c.id}" | Name: "${c.name}"${c.role ? ` | Role: ${c.role}` : ""}`
        )
        .join("\n")
    : "  (no characters loaded)";

  const locationBlock = world?.locations?.length
    ? world.locations
        .map((l) => `  - ID: "${l.id}" | Name: "${l.name}"`)
        .join("\n")
    : "  (no locations loaded)";

  return { characterBlock, locationBlock };
}

function buildDesignSystemPrompt(story: any, world?: WorldRef) {
  const { characterBlock, locationBlock } = buildWorldBlock(world);

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

AVAILABLE CHARACTERS IN THIS STORY:
${characterBlock}

AVAILABLE LOCATIONS IN THIS STORY:
${locationBlock}

YOUR GOAL:
Reach a clear, final decision in 2–3 assistant turns MAX.

WHAT YOU NEED TO COLLECT:

FRONT COVER
- What should we SEE?
  (single character, group scene, symbolic image, moment from story)
- Which specific characters should appear? (use their names from the list above)

AUTHOR TEXT
- Exact author credit text (e.g. "By Sophie", "By Mum and Sophie", or none)

BACK COVER
- Should there be:
  - a short blurb
  - a dedication
  - both
  - or nothing
- Rough visual idea (continue front scene or simpler background)
- Which location if any should feature?

RULES:
- Be warm, direct, and efficient
- Ask grouped questions
- If vague, offer 2–3 concrete options using the actual character/location names
- DO NOT ask about fonts, colours, lighting, or layout
- When you have enough, clearly say you're ready

OUTPUT FORMAT — ALWAYS return valid JSON and nothing else:

{
  "message": "what you say to the user",
  "stage": "intro" | "exploring" | "ready",
  "summary": {
    "front": "one-line summary",
    "back": "one-line summary"
  },
  "mentionedCharacterIds": ["id1", "id2"],
  "mentionedLocationIds": ["id1"]
}

TAGGING RULES for mentionedCharacterIds and mentionedLocationIds:
- Include the ID of EVERY character you mention, suggest, or ask about in THIS message
- Include the ID of EVERY location you mention, suggest, or ask about in THIS message
- Use the EXACT IDs from the AVAILABLE CHARACTERS / AVAILABLE LOCATIONS lists
- If you say "Should Sophia be on the front cover?" → include Sophia's ID
- If you suggest a group of characters → include ALL their IDs
- If no characters or locations come up in a message → use empty arrays []
- These arrays control which reference images the user sees, so be thorough

When stage === "ready", your message MUST end with:
"Perfect — I have everything I need to create your cover."
`.trim();
}

function buildRevisionSystemPrompt(story: any, world?: WorldRef) {
  const { characterBlock, locationBlock } = buildWorldBlock(world);

  return `
You are helping a parent revise an EXISTING children's book cover. A cover has already been generated and the user wants changes.

IMPORTANT:
- You are helping refine an existing cover, NOT designing from scratch.
- Understand what the user wants to change before regenerating.
- Confirm which characters and locations should be included.
- The cover will be fully regenerated with updated instructions.

STORY CONTEXT:
Title: ${story.title}
Story excerpt:
${story.fullDraft?.slice(0, 400) || "No story text provided"}

AVAILABLE CHARACTERS IN THIS STORY:
${characterBlock}

AVAILABLE LOCATIONS IN THIS STORY:
${locationBlock}

YOUR GOAL:
Understand the user's feedback and confirm the changes in 1–2 turns MAX.

WHAT TO CLARIFY:
- What specifically is wrong? (characters don't look right, wrong scene, text issues, etc.)
- Which characters should appear on the cover? Confirm each one by name.
- Should the location/background change?
- Any changes to title text, author text, or back cover text?
- Once clear, confirm what you'll change and say you're ready.

RULES:
- Be warm, direct, and efficient
- If the user says "characters are wrong" — ask WHICH characters and WHAT's wrong
- If the user says "dogs don't look right" — confirm which specific dogs from the character list should appear and that their reference images will be used
- Always confirm the FINAL list of characters that should appear on the cover before saying you're ready
- DO NOT ask about fonts, colours, lighting, or layout details
- When you have enough info, clearly say you're ready to regenerate

OUTPUT FORMAT — ALWAYS return valid JSON and nothing else:

{
  "message": "what you say to the user",
  "stage": "exploring" | "ready",
  "summary": {
    "changes": "one-line summary of what's changing",
    "characters": "list of character names that should appear",
    "location": "location name or same as before"
  },
  "mentionedCharacterIds": ["id1", "id2"],
  "mentionedLocationIds": ["id1"]
}

TAGGING RULES for mentionedCharacterIds and mentionedLocationIds:
- Include the ID of EVERY character that should appear on the regenerated cover
- Include the ID of EVERY location that should appear on the regenerated cover
- This is CRITICAL — these IDs determine which reference images are sent to the image generator
- If the user says "all three dogs" — include ALL three dog character IDs
- If a character was discussed and should stay on the cover, include their ID
- Always be comprehensive — a missing ID means that character's reference image won't be used
- Use the EXACT IDs from the AVAILABLE CHARACTERS / AVAILABLE LOCATIONS lists

When stage === "ready", your message MUST end with:
"Perfect — I have everything I need to create your cover."
`.trim();
}

/* -------------------------------------------------------------------------- */
/*                                   ROUTE                                    */
/* -------------------------------------------------------------------------- */

export async function POST(req: Request) {
  try {
    const { message, history = [], storyId, world, mode } = await req.json();

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

    const worldRef: WorldRef | undefined = world
      ? {
          characters: (world.characters ?? []).map((c: any) => ({
            id: c.id,
            name: c.name,
            role: c.role ?? null,
          })),
          locations: (world.locations ?? []).map((l: any) => ({
            id: l.id,
            name: l.name,
          })),
        }
      : undefined;

    const systemPrompt = mode === "revision"
      ? buildRevisionSystemPrompt(story, worldRef)
      : buildDesignSystemPrompt(story, worldRef);

    const claudeMessages = history
      .filter((m: any) => m.role === "user" || m.role === "assistant")
      .map((m: any) => ({
        role: m.role,
        content: m.content,
      }));

    claudeMessages.push({ role: "user", content: message });

    const completion = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      system: systemPrompt,
      max_tokens: 800,
      messages: claudeMessages,
    });

    const raw =
      completion.content.find((b) => b.type === "text")?.text ?? "";

    let parsed: {
      message: string;
      stage: "intro" | "exploring" | "ready";
      summary?: any;
      mentionedCharacterIds?: string[];
      mentionedLocationIds?: string[];
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
        mentionedCharacterIds: [],
        mentionedLocationIds: [],
      };
    }

    // 🔒 Clamp stage
    if (!["intro", "exploring", "ready"].includes(parsed.stage)) {
      parsed.stage = "exploring";
    }

    // 🔒 Ensure arrays exist and contain only strings
    parsed.mentionedCharacterIds = Array.isArray(parsed.mentionedCharacterIds)
      ? parsed.mentionedCharacterIds.filter((id) => typeof id === "string")
      : [];
    parsed.mentionedLocationIds = Array.isArray(parsed.mentionedLocationIds)
      ? parsed.mentionedLocationIds.filter((id) => typeof id === "string")
      : [];

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
      mentionedCharacterIds: parsed.mentionedCharacterIds,
      mentionedLocationIds: parsed.mentionedLocationIds,
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