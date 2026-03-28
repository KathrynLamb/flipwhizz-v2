// src/app/api/chat/route.ts

import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/db";
import {
  projects,
  chatSessions,
  chatMessages,
  readers,
  stories,
  readerInsights,
} from "@/db/schema";
import { worlds, worldReaders, worldNarrativeMemory } from "@/db/schema-worlds";
import { eq, and, asc, desc } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import type { InferSelectModel } from "drizzle-orm";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

// ============================================================================
// AGE + BIRTHDAY HELPERS
// ============================================================================

function computeAge(dob: Date | string | null, fallbackAge: number | null): number | null {
  if (!dob) return fallbackAge;
  const birth = new Date(dob);
  if (isNaN(birth.getTime())) return fallbackAge;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

function getBirthdayContext(
  dob: Date | string | null,
  name: string | null,
  currentAge: number | null
): string | null {
  if (!dob) return null;
  const birth = new Date(dob);
  if (isNaN(birth.getTime())) return null;

  const today = new Date();
  const thisYearBday = new Date(today.getFullYear(), birth.getMonth(), birth.getDate());
  const diffMs = thisYearBday.getTime() - today.getTime();
  const daysUntil = Math.floor(diffMs / 86400000);

  const childName = name || "the reader";
  const nextAge = (currentAge ?? 0) + 1;

  if (daysUntil >= 1 && daysUntil <= 14) {
    return `🎂 ${childName}'s birthday is in ${daysUntil} day${daysUntil === 1 ? "" : "s"} — they'll be turning ${nextAge}! If it feels natural in conversation, you could warmly mention this and offer to create a birthday-themed adventure. Don't force it — only if the moment is right.`;
  }
  if (daysUntil === 0) {
    return `🎂 It's ${childName}'s birthday TODAY — they're turning ${nextAge}! You could acknowledge this warmly and suggest a special birthday story.`;
  }
  if (daysUntil >= -3 && daysUntil < 0) {
    return `🎂 ${childName} just turned ${currentAge} ${Math.abs(daysUntil)} day${Math.abs(daysUntil) === 1 ? "" : "s"} ago! You could warmly acknowledge their recent birthday if it comes up.`;
  }

  return null;
}

// ============================================================================
// WORLD CONTEXT LOADER — now with structured reader fields
// ============================================================================

interface ReaderContext {
  name: string | null;
  age: number | null;
  gender: string | null;
  pronouns: string | null;
  personalityNotes: string | null;
  interests: string[];
  fears: string[];
  readingLevel: string | null;
  birthdayHint: string | null;
  activeInsights: Array<{ type: string; content: string }>;
}

interface WorldContextForChat {
  worldName: string;
  worldDescription: string | null;
  tonality: string | null;
  themes: string[];
  reader: ReaderContext;
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

    // Get the primary reader with full structured fields
    const readerLink = await db
      .select({ readerId: worldReaders.readerId })
      .from(worldReaders)
      .where(eq(worldReaders.worldId, worldId))
      .limit(1)
      .then((rows) => rows[0]);

    let readerCtx: ReaderContext = {
      name: null, age: null, gender: null, pronouns: null,
      personalityNotes: null, interests: [], fears: [],
      readingLevel: null, birthdayHint: null, activeInsights: [],
    };

    if (readerLink) {
      const reader = await db
        .select({
          name: readers.name,
          age: readers.age,
          gender: readers.gender,
          pronouns: readers.pronouns,
          personalityNotes: readers.personalityNotes,
          interests: readers.interests,
          fears: readers.fears,
          readingLevel: readers.readingLevel,
          dateOfBirth: readers.dateOfBirthDate,
        })
        .from(readers)
        .where(eq(readers.id, readerLink.readerId))
        .limit(1)
        .then((rows) => rows[0]);

      if (reader) {
        const age = computeAge(reader.dateOfBirth, reader.age);
        const birthdayHint = getBirthdayContext(reader.dateOfBirth, reader.name, age);

        // Load active insights (most recent 10)
        const insights = await db
          .select({ insightType: readerInsights.insightType, content: readerInsights.content })
          .from(readerInsights)
          .where(
            and(
              eq(readerInsights.readerId, readerLink.readerId),
              eq(readerInsights.isActive, true)
            )
          )
          .orderBy(desc(readerInsights.createdAt))
          .limit(10);

        readerCtx = {
          name: reader.name,
          age,
          gender: reader.gender,
          pronouns: reader.pronouns,
          personalityNotes: reader.personalityNotes,
          interests: (reader.interests as string[]) ?? [],
          fears: (reader.fears as string[]) ?? [],
          readingLevel: reader.readingLevel,
          birthdayHint,
          activeInsights: insights.map((i) => ({ type: i.insightType, content: i.content })),
        };
      }
    }

    // Get narrative memory
    const memory = await db
      .select({
        bookNumber: worldNarrativeMemory.bookNumber,
        summary: worldNarrativeMemory.summary,
        storyId: worldNarrativeMemory.storyId,
      })
      .from(worldNarrativeMemory)
      .where(eq(worldNarrativeMemory.worldId, worldId))
      .orderBy(asc(worldNarrativeMemory.bookNumber));

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

    const existingBooks = await db
      .select({ bookNumber: stories.bookNumber })
      .from(stories)
      .where(eq(stories.worldId, worldId));

    const maxBook = existingBooks.reduce((max, b) => Math.max(max, b.bookNumber ?? 0), 0);

    return {
      worldName: world.name,
      worldDescription: world.description,
      tonality: world.tonality,
      themes: (world.themes as string[]) ?? [],
      reader: readerCtx,
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
  // Build the reader section — used for both world and standalone stories
  const r = worldCtx?.reader;

  const readerSection = r?.name
    ? `
THE READER:
Name: ${r.name}
${r.age ? `Age: ${r.age}` : ""}
${r.pronouns ? `Pronouns: ${r.pronouns}` : ""}
${r.personalityNotes ? `Personality: ${r.personalityNotes}` : ""}
${r.interests.length > 0 ? `Loves: ${r.interests.join(", ")}` : ""}
${r.fears.length > 0 ? `Working through: ${r.fears.join(", ")} — these are sensitive topics the parent shared. You can gently weave them into story themes if appropriate, but NEVER mention them bluntly or make the child feel called out.` : ""}
${r.readingLevel ? `Reading level: ${r.readingLevel}` : ""}
${r.activeInsights.length > 0 ? `
RECENT CONTEXT (from previous conversations):
${r.activeInsights.map((i) => `- [${i.type}] ${i.content}`).join("\n")}
Use these naturally — they show what's going on in this child's life right now. Don't list them back to the parent. Just let them inform your suggestions.` : ""}
${r.birthdayHint ? `\n${r.birthdayHint}` : ""}`
    : "";

  // World section — only for series books
  const worldSection = worldCtx
    ? `
WORLD CONTEXT — THIS IS A SERIES BOOK:
You are helping create Book ${worldCtx.bookNumber} in the "${worldCtx.worldName}" series.
${worldCtx.worldDescription ? `World: ${worldCtx.worldDescription}` : ""}
${worldCtx.tonality ? `Tone: ${worldCtx.tonality}` : ""}
${worldCtx.themes.length > 0 ? `Themes: ${worldCtx.themes.join(", ")}` : ""}
${readerSection}
${worldCtx.previousBooks.length > 0
  ? `
PREVIOUS BOOKS:
${worldCtx.previousBooks.map((b) => `Book ${b.bookNumber} "${b.title}": ${b.summary}`).join("\n")}

You remember all of this. Reference characters, events, and callbacks from previous books naturally — the child should feel like they're returning to a world they know. But don't recite the plot summaries. Let them emerge in conversation.`
  : "This is the FIRST book in a new series. Help the parent establish the world, characters, and tone."}

IMPORTANT: You already know this child and this world. Don't ask the parent to re-explain things. Build on what you know:
- Reference previous adventures: "Last time ${r?.name || "they"} explored [X] — where shall we go next?"
- Acknowledge the cast: "We've got [characters] ready to go. Everyone returning, or shall we introduce someone new?"
- Build on themes: "The ${worldCtx.themes.slice(0, 2).join(" and ")} themes worked beautifully. Continue those or try something different?"
`
    : readerSection; // For standalone stories, still include reader context if we have it

  return `You are a children's book author helping a parent create a story for their child. You are warm, genuinely interested, and collaborative — like a friend who's excited to help make something special.
${worldSection}

YOUR APPROACH:
${worldCtx
  ? `You already know the child and the world. Start by asking what THIS book should be about. Reference previous adventures naturally. Ask if they want to continue a thread or start fresh.`
  : `Have a natural conversation to understand what story they want to create. This could be:
- A memory from a recent experience (holiday, playdate, special moment)
- A teaching moment (working through something, learning a concept)
- A pure adventure in their child's universe
- Just for fun`
}

As you talk, gently discover:
- Who's in this story (their child? existing characters? new friends?)
- What happens (the core moment or adventure)
- How it should feel (funny? gentle? exciting? cozy?)
- Any special details (inside jokes, real personality traits, things they said)

CRITICAL RULES:
- Keep responses SHORT. 2-3 sentences, max 2 questions. This is a chat, not an interview.
- Sound like a person, not a script. Build on what they say — don't ignore and jump ahead.
- Listen for what EXCITES them. When their energy picks up, follow that thread.
- If they mention something the child is going through (new school, sibling rivalry, fear), acknowledge it naturally. Don't turn it into a therapy session.
- When they seem ready, offer to create the story. Don't push — read the room.
- NEVER write the actual story in this chat. That happens separately.
- NEVER use bullet points or formatted lists. This is a conversation.

TONE: Warm, collaborative, genuinely interested. You're building something together.`;
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
      return NextResponse.json({ reply: "(project not found)" }, { status: 404 });
    }

    // Load world context (includes structured reader data + insights + birthday)
    const worldCtx = worldId ? await loadWorldContextForChat(worldId) : null;

    if (worldId && worldCtx) {
      console.log(
        `🔵 Chat: "${worldCtx.worldName}" Book ${worldCtx.bookNumber}, reader: ${worldCtx.reader.name}, insights: ${worldCtx.reader.activeInsights.length}${worldCtx.reader.birthdayHint ? ", 🎂 birthday detected" : ""}`
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

// ============================================================================
// STORY GENERATION PROMPT (unchanged — used by separate endpoint)
// ============================================================================

function buildStoryGenerationSystemPrompt(conversationHistory: string, pageCount: number) {
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
1. Be specific, not generic — use real details they mentioned
2. Match their tone — if they said "funny," make it actually funny
3. Authentic voice — characters sound different from each other
4. Real emotions — show, don't tell
5. Story structure — setup 30%, complication 40%, resolution 30%

BANNED: "the most [adjective] ever", "declared bravely", "magical wonder filled", "began to cry happy tears", "the best X ever"

OUTPUT FORMAT:
{
  "title": "Specific, interesting title",
  "pages": [{ "page": 1, "text": "..." }],
  "styleGuide": {
    "summary": "Visual style — mood, palette, approach",
    "negativePrompt": "What to avoid"
  }
}

Output ONLY valid JSON. No markdown, no preamble.`;
}

export function prepareStoryGenerationPrompt(
  conversationHistory: Array<{ role: string; content: string }>,
  pageCount: number
): { system: string; message: string } {
  const fullConversation = conversationHistory
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join("\n\n");

  return {
    system: buildStoryGenerationSystemPrompt(fullConversation, pageCount),
    message: `Generate the complete ${pageCount}-page story now as valid JSON. Output ONLY the JSON.`,
  };
}