import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/db";
import { projects, chatSessions, chatMessages, readers, stories } from "@/db/schema";
import { worlds, worldReaders, worldNarrativeMemory } from "@/db/schema-worlds";
import { eq, and, asc } from "drizzle-orm";
import { v4 as uuid } from "uuid";

import type { InferSelectModel } from "drizzle-orm";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

// ============================================================================
// WORLD CONTEXT LOADER
// ============================================================================

interface WorldContextForChat {
  worldName: string;
  worldDescription: string | null;
  tonality: string | null;
  themes: string[];
  readerName: string | null;
  readerGender: string | null;
  readerAiSummary: string | null;
  bookNumber: number;
  previousBooks: Array<{
    bookNumber: number;
    title: string;
    summary: string;
  }>;
}

async function loadWorldContextForChat(
  worldId: string
): Promise<WorldContextForChat | null> {
  try {
    const world = await db
      .select()
      .from(worlds)
      .where(eq(worlds.id, worldId))
      .limit(1)
      .then((rows) => rows[0]);

    if (!world) return null;

    // Get the primary reader
    const readerLink = await db
      .select({ readerId: worldReaders.readerId })
      .from(worldReaders)
      .where(eq(worldReaders.worldId, worldId))
      .limit(1)
      .then((rows) => rows[0]);

    let readerName: string | null = null;
    let readerGender: string | null = null;
    let readerAiSummary: string | null = null;

    if (readerLink) {
      const reader = await db
        .select({
          name: readers.name,
          gender: readers.gender,
          aiSummary: readers.aiSummary,
        })
        .from(readers)
        .where(eq(readers.id, readerLink.readerId))
        .limit(1)
        .then((rows) => rows[0]);

      if (reader) {
        readerName = reader.name;
        readerGender = reader.gender;
        readerAiSummary = reader.aiSummary;
      }
    }

    // Get narrative memory from previous books
    const memory = await db
      .select({
        bookNumber: worldNarrativeMemory.bookNumber,
        summary: worldNarrativeMemory.summary,
        storyId: worldNarrativeMemory.storyId,
      })
      .from(worldNarrativeMemory)
      .where(eq(worldNarrativeMemory.worldId, worldId))
      .orderBy(asc(worldNarrativeMemory.bookNumber));

    // Get story titles for the memory entries
    const previousBooks = await Promise.all(
      memory.map(async (m) => {
        const story = await db
          .select({ title: stories.title })
          .from(stories)
          .where(eq(stories.id, m.storyId))
          .limit(1)
          .then((rows) => rows[0]);

        return {
          bookNumber: m.bookNumber,
          title: story?.title ?? `Book ${m.bookNumber}`,
          summary: m.summary,
        };
      })
    );

    // Calculate next book number
    const existingBooks = await db
      .select({ bookNumber: stories.bookNumber })
      .from(stories)
      .where(eq(stories.worldId, worldId));

    const maxBook = existingBooks.reduce(
      (max, b) => Math.max(max, b.bookNumber ?? 0),
      0
    );

    return {
      worldName: world.name,
      worldDescription: world.description,
      tonality: world.tonality,
      themes: (world.themes as string[]) ?? [],
      readerName,
      readerGender,
      readerAiSummary,
      bookNumber: maxBook + 1,
      previousBooks,
    };
  } catch (err) {
    console.warn("⚠️ Failed to load world context:", err);
    return null;
  }
}

// ============================================================================
// SYSTEM PROMPT BUILDER
// ============================================================================

function buildChatSystemPrompt(
  project: any,
  worldCtx: WorldContextForChat | null
) {
  const worldSection = worldCtx
    ? `
WORLD CONTEXT — THIS IS A SERIES BOOK:
You are helping create Book ${worldCtx.bookNumber} in the "${worldCtx.worldName}" series.
${worldCtx.worldDescription ? `World: ${worldCtx.worldDescription}` : ""}
${worldCtx.tonality ? `Tone: ${worldCtx.tonality}` : ""}
${worldCtx.themes.length > 0 ? `Themes: ${worldCtx.themes.join(", ")}` : ""}

THE READER:
${worldCtx.readerName ? `Name: ${worldCtx.readerName}` : "A child"}
${worldCtx.readerGender ? `Gender: ${worldCtx.readerGender}` : ""}
${worldCtx.readerAiSummary ? `What we know: ${worldCtx.readerAiSummary}` : ""}

${
  worldCtx.previousBooks.length > 0
    ? `PREVIOUS BOOKS IN THIS SERIES:
${worldCtx.previousBooks
  .map(
    (b) => `Book ${b.bookNumber} "${b.title}": ${b.summary}`
  )
  .join("\n")}

Use this history! Reference characters, events, and callbacks from previous books. The child should feel like they're returning to a world they know and love.`
    : "This is the FIRST book in a new series. Help the parent establish the world, characters, and tone."
}

IMPORTANT: You already know about this world, the reader, and what happened before. Don't ask the parent to re-explain things you already know. Instead, build on them. For example:
- "Last time ${worldCtx.readerName || "they"} explored [X]. Where shall we go next?"
- "We've got [characters] ready to go. Shall we bring them all back, or introduce someone new?"
- "The themes of ${worldCtx.themes.slice(0, 2).join(" and ")} worked beautifully. Want to continue with those or try something different?"
`
    : "";

  return `You are a children's book author helping a parent create a story for their child.
${worldSection}
YOUR APPROACH:
You're having a genuine conversation to understand what story they want to create. This could be:
- A memory from a recent experience (holiday, playdate, special moment)
- A teaching moment (working through something difficult, learning a concept)
- A pure adventure in their child's existing character universe
- Just for fun

Have a natural conversation. Ask 1-2 questions at a time, maximum. Listen for what excites them.

DISCOVER NATURALLY:
${
  worldCtx
    ? `- You already know the child and the world. Start by asking what THIS book should be about.
- Reference previous adventures naturally to show you remember.
- Ask if they want to continue a thread or start something fresh.`
    : `- Start by understanding the PURPOSE: "What kind of story are we making today?"
- If it's a MEMORY: Ask about the experience, what made it special, key details
- If it's TEACHING: Ask what they want their child to understand/feel
- If it's FUN: Ask about the adventure, the characters involved`
}

As you talk, gently discover:
- Who's in this story (their child? existing characters? new friends?)
- What happens (the core moment or adventure)
- How it should feel (funny? gentle? exciting? cozy?)
- Any special details (inside jokes, real personality traits)

CRITICAL:
- Keep responses SHORT (2-3 sentences, max 2 questions)
- Sound like a person having a conversation, not following a script
- Build on what they say - don't ignore and move to the next question
- If they mention existing characters, ask about them naturally
- When they seem ready, offer to write the story

TONE:
Warm, collaborative, genuinely interested. Like chatting with a friend who's excited to help.

When they're ready to generate (they say "let's do it," "create it," "I'm ready," etc.), confirm briefly and signal readiness.

DO NOT write the actual story in this chat. That happens separately.`;
}

// ============================================================================
// MAIN ROUTE
// ============================================================================

export async function POST(req: Request) {
  try {
    const { message, history = [], projectId, worldId } = await req.json();

    if (!message || !projectId) {
      return NextResponse.json({ reply: "(invalid request)" });
    }

    const project = await db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId))
      .then((rows) => rows[0]);

    if (!project) {
      return NextResponse.json(
        { reply: "(project not found)" },
        { status: 404 }
      );
    }

    // Load world context if this is a series book
    const worldCtx = worldId
      ? await loadWorldContextForChat(worldId)
      : null;

    if (worldId && worldCtx) {
      console.log(
        `🔵 Chat: World context loaded — "${worldCtx.worldName}" Book ${worldCtx.bookNumber}, reader: ${worldCtx.readerName}`
      );
    }

    type ChatSessionRow = InferSelectModel<typeof chatSessions>;

    let session: ChatSessionRow | undefined = await db
      .select()
      .from(chatSessions)
      .where(eq(chatSessions.projectId, projectId))
      .then((rows) => rows[0]);

    if (!session) {
      const now = new Date();
      const sessionId = uuid();
      const userId = project.userId ?? null;

      await db.insert(chatSessions).values({
        id: sessionId,
        projectId,
        userId,
        readerId: null,
        status: "open",
        lastMessageAt: now,
        createdAt: now,
      });

      session = {
        id: sessionId,
        projectId,
        userId,
        readerId: null,
        status: "open",
        lastMessageAt: now,
        createdAt: now,
      };
    }

    await db.insert(chatMessages).values({
      id: uuid(),
      sessionId: session.id,
      role: "user",
      content: message,
      createdAt: new Date(),
    });

    const claudeMessages = history
      .filter((m: any) => m.role === "user" || m.role === "assistant")
      .map((m: any) => ({ role: m.role, content: m.content }));

    claudeMessages.push({ role: "user", content: message });

    const completion = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      system: buildChatSystemPrompt(project, worldCtx),
      max_tokens: 1500,
      messages: claudeMessages,
    });

    const reply =
      completion.content
        .map((b) => (b.type === "text" ? b.text : ""))
        .filter(Boolean)
        .join("\n")
        .trim() || "(no reply)";

    await db.insert(chatMessages).values({
      id: uuid(),
      sessionId: session.id,
      role: "assistant",
      content: reply,
      createdAt: new Date(),
    });

    // Detect if user is ready to generate the story
    const userMessage = message.toLowerCase();
    const readyToGenerate =
      userMessage.includes("generate") ||
      userMessage.includes("create the story") ||
      userMessage.includes("let's do it") ||
      userMessage.includes("i'm ready") ||
      userMessage.includes("go ahead") ||
      userMessage.includes("make it") ||
      (userMessage.includes("yes") && userMessage.includes("story"));

    return NextResponse.json({
      reply,
      sessionId: session.id,
      readyToGenerate,
    });
  } catch (err) {
    console.error("Claude API error:", err);
    return NextResponse.json(
      { reply: "(error calling Claude)" },
      { status: 500 }
    );
  }
}

// ============================================
// SEPARATE STORY GENERATION ENDPOINT (unchanged)
// ============================================

function buildStoryGenerationSystemPrompt(
  conversationHistory: string,
  pageCount: number
) {
  return `You are FlipWhizz, creating a children's story based on this conversation:

${conversationHistory}

UNDERSTAND THE PURPOSE:
Read this conversation carefully. What kind of story is this?
- Memory preservation? (capturing a real experience)
- Teaching moment? (helping the child learn/process something)
- Pure fun? (adventure in their universe)

Extract from the conversation:
- Characters (names, personalities, how they act)
- What happens (the core story)
- How it should feel (tone, style)
- Special details (inside jokes, real traits, specific moments)

WRITE THE STORY:
${pageCount} pages. Each page = 1-3 sentences, one illustratable moment.

KEY PRINCIPLES:

1. **Be specific, not generic**
   - Use real details they mentioned
   - If a character has a quirk, show it multiple times
   - If the child does something specific (gymnastics, makes up songs), SHOW it with actual examples

2. **Match their tone**
   - If they said "funny," make it actually funny
   - If they said "gentle," keep it soft
   - If they mentioned favorite books/authors, channel that style

3. **Authentic voice**
   - Characters should sound different from each other
   - Kids should talk/think like real kids, not mini-adults
   - No generic fairy tale language

4. **Real emotions**
   - Include actual feelings, not just described feelings
   - Small challenges are good - kids relate to obstacles
   - Show, don't tell

5. **Story structure**
   - First 30%: Setup
   - Middle 40%: Complication/adventure
   - Final 30%: Resolution
   - Make the resolution feel earned

BANNED PHRASES (avoid anything similar):
- "the most [adjective] ever"
- "declared bravely"
- "magical wonder filled"
- "began to cry happy tears"
- "the best X ever"

FOR TEACHING STORIES:
- Wrap the lesson in adventure, don't preach
- Let the character discover it naturally
- Use their existing characters if mentioned
- Keep it subtle and age-appropriate

FOR MEMORY STORIES:
- Include specific details from the real experience
- Weave in the child's actual personality
- Mix reality with imagination if that was discussed

OUTPUT FORMAT:
{
  "title": "Specific, interesting title (not 'X's Adventure')",
  "pages": [
    { "page": 1, "text": "..." }
  ],
  "styleGuide": {
    "summary": "Visual style matching the story's mood. Be specific about tone, color palette, artistic approach.",
    "negativePrompt": "Things to avoid in illustrations"
  }
}

Before writing each page, ask yourself:
- Does this feel handcrafted for THIS child?
- Am I showing character through action?
- Would this surprise or delight them?
- Have I honored what the parent wanted?

Output ONLY valid JSON. No markdown, no preamble, no explanation.`;
}

export function prepareStoryGenerationPrompt(
  conversationHistory: Array<{ role: string; content: string }>,
  pageCount: number
): { system: string; message: string } {
  const fullConversation = conversationHistory
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join("\n\n");

  const system = buildStoryGenerationSystemPrompt(fullConversation, pageCount);

  const message = `Generate the complete ${pageCount}-page story now as valid JSON.

Remember:
- Honor all the details from the conversation
- Every character should have a distinct voice and behavior
- NO generic children's book phrases - make it specific to THIS child
- Show character traits through actions, not descriptions
- Include the specific details they mentioned

Output ONLY the JSON structure. No markdown, no preamble, no explanation.`;

  return { system, message };
}