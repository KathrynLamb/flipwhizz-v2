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
  characters,
  storyCharacters,
} from "@/db/schema";
import { worlds, worldReaders, worldNarrativeMemory } from "@/db/schema-worlds";
import { eq, and, asc, desc, inArray } from "drizzle-orm";
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
// WORLD CONTEXT LOADER
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
  characters: Array<{
    name: string;
    description: string | null;
    personalityTraits: string | null;
    role: string | null;
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

    // Load all characters that have appeared in any book in this world
    const worldStoryIds = await db
      .select({ id: stories.id })
      .from(stories)
      .where(eq(stories.worldId, worldId));

    const storyIdList = worldStoryIds.map((s) => s.id);

    let worldCharacters: WorldContextForChat["characters"] = [];

    if (storyIdList.length > 0) {
      const charRows = await db
        .select({
          characterId: characters.id,
          name: characters.name,
          description: characters.description,
          personalityTraits: characters.personalityTraits,
          role: storyCharacters.role,
        })
        .from(storyCharacters)
        .innerJoin(characters, eq(storyCharacters.characterId, characters.id))
        .where(inArray(storyCharacters.storyId, storyIdList));

      // Deduplicate by characterId — keep first occurrence (role from earliest book)
      const seen = new Set<string>();
      worldCharacters = charRows
        .filter((c) => {
          if (seen.has(c.characterId)) return false;
          seen.add(c.characterId);
          return true;
        })
        .map((c) => ({
          name: c.name,
          description: c.description,
          personalityTraits: c.personalityTraits,
          role: c.role,
        }));
    }

    

    console.log(`🟣 World characters loaded: ${worldCharacters.map((c) => c.name).join(", ") || "none"}`);

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
      characters: worldCharacters,
    };
  } catch (err) {
    console.warn("⚠️ Failed to load world context:", err);
    return null;
  }
}

// ============================================================================
// TOOL DEFINITION — start_writing
// ============================================================================

const START_WRITING_TOOL: Anthropic.Tool = {
  name: "start_writing",
  description:
    "Call this when the parent has confirmed they're ready for you to write the story. " +
    "This triggers the story generation pipeline. Only call this when the parent has clearly " +
    "agreed or asked you to go ahead — not when you're still asking questions or proposing ideas. " +
    "You must still provide a reply to the parent alongside this tool call.",
  input_schema: {
    type: "object" as const,
    properties: {
      summary: {
        type: "string",
        description:
          "A 1-2 sentence summary of the agreed story concept, for logging purposes.",
      },
    },
    required: ["summary"],
  },
};

// ============================================================================
// SYSTEM PROMPT BUILDER
// ============================================================================

function buildChatSystemPrompt(
  project: any,
  worldCtx: WorldContextForChat | null,
  standaloneReader: ReaderContext | null = null,
  lateConversation: boolean = false
) {
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

  const worldSection = worldCtx
    ? `
WORLD CONTEXT — THIS IS A SERIES BOOK:
You are helping create Book ${worldCtx.bookNumber} in the "${worldCtx.worldName}" series.
${worldCtx.worldDescription ? `World: ${worldCtx.worldDescription}` : ""}
${worldCtx.tonality ? `Tone: ${worldCtx.tonality}` : ""}
${worldCtx.themes.length > 0 ? `Themes: ${worldCtx.themes.join(", ")}` : ""}
${readerSection}
${worldCtx.characters.length > 0
  ? `
ESTABLISHED CAST:
${worldCtx.characters.map((c) =>
  `- ${c.name}${c.role ? ` (${c.role})` : ""}${c.description ? `: ${c.description}` : ""}${c.personalityTraits ? ` — ${c.personalityTraits}` : ""}`
).join("\n")}

You know these characters well. Reference them naturally — ask if the parent wants them to return, suggest how they might fit into the new story, or note if it'd make sense to introduce someone new alongside familiar faces.`
  : ""}
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
: standaloneReader?.name
? `
THE READER (you already know this child):
Name: ${standaloneReader.name}
${standaloneReader.age ? `Age: ${standaloneReader.age}` : ""}
${standaloneReader.pronouns ? `Pronouns: ${standaloneReader.pronouns}` : ""}
${standaloneReader.personalityNotes ? `Personality: ${standaloneReader.personalityNotes}` : ""}
${standaloneReader.interests.length > 0 ? `Loves: ${standaloneReader.interests.join(", ")}` : ""}
${standaloneReader.fears.length > 0 ? `Working through: ${standaloneReader.fears.join(", ")} — handle gently.` : ""}
${standaloneReader.readingLevel ? `Reading level: ${standaloneReader.readingLevel}` : ""}
${standaloneReader.activeInsights.length > 0 ? `
RECENT CONTEXT:
${standaloneReader.activeInsights.map((i) => `- [${i.type}] ${i.content}`).join("\n")}` : ""}
${standaloneReader.birthdayHint ? `\n${standaloneReader.birthdayHint}` : ""}

IMPORTANT: You already know ${standaloneReader.name}. Don't ask the parent their child's name or age — you have it. Jump straight into what story they want to create.`
: readerSection;

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

TOOL — start_writing:
You have a tool called start_writing. Call it when the parent has clearly confirmed they want you to go ahead and create the story. Signs the parent is ready:
- They say "yes", "go for it", "sounds great", "let's do it", "perfect", etc. in response to your story proposal
- They explicitly ask you to start writing or creating
- They confirm they're happy with the direction

CRITICAL: If your message contains a question asking whether to proceed, do NOT call start_writing in the same response. The question and the tool call are mutually exclusive. Ask first, wait for their reply, then call the tool in the next turn when they confirm.

When you do call start_writing (after confirmation), end your reply with something like "I'm on it — writing the first draft now!" not a question.

Do NOT call start_writing:
- While you're still gathering information
- When proposing an idea and waiting for confirmation
- If the parent seems unsure or wants to change something

CRITICAL RULES:
- ${lateConversation
  ? `BREVITY MODE — the parent knows the process. Max 2 sentences. One question only. No preamble, no affirmations. If you have a proposal ready, make it.`
  : `Keep responses short. 2-3 sentences, one question at a time.`}
- Never open with an affirmation ("Great!", "That sounds lovely!", "Perfect!"). Just respond.
- Sound like a person, not a script. Build on what they say.
- Listen for what EXCITES them and follow that thread.
- NEVER write the actual story in this chat.
- NEVER use bullet points or formatted lists.

TONE: Warm, collaborative, genuinely interested. You're building something together.`;
}

// ============================================================================
// MAIN ROUTE
// ============================================================================

export async function POST(req: Request) {
  try {
    const { message, history = [], projectId, worldId, readerId } = await req.json();

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

    const worldCtx = worldId ? await loadWorldContextForChat(worldId) : null;

    // Load reader directly if no world context but readerId is provided
    let standaloneReaderCtx: ReaderContext | null = null;
    if (!worldCtx && readerId) {
      try {
        const reader = await db.query.readers.findFirst({
          where: eq(readers.id, readerId),
        });

        if (reader) {
          const age = computeAge(reader.dateOfBirthDate, reader.age);
          const birthdayHint = getBirthdayContext(reader.dateOfBirthDate, reader.name, age);

          const insights = await db
            .select({ insightType: readerInsights.insightType, content: readerInsights.content })
            .from(readerInsights)
            .where(
              and(
                eq(readerInsights.readerId, readerId),
                eq(readerInsights.isActive, true)
              )
            )
            .orderBy(desc(readerInsights.createdAt))
            .limit(10);

          standaloneReaderCtx = {
            name: reader.name ?? null,
            age,
            gender: reader.gender ?? null,
            pronouns: reader.pronouns ?? null,
            personalityNotes: reader.personalityNotes ?? null,
            interests: (reader.interests as string[]) ?? [],
            fears: (reader.fears as string[]) ?? [],
            readingLevel: reader.readingLevel ?? null,
            birthdayHint,
            activeInsights: insights.map((i) => ({ type: i.insightType, content: i.content })),
          };

          console.log(`🟢 Chat: standalone reader "${reader.name}", age ${age}, insights: ${insights.length}`);
        }
      } catch (err) {
        console.warn("⚠️ Failed to load standalone reader:", err);
      }
    }

    if (worldId && worldCtx) {
      console.log(
        `🔵 Chat: "${worldCtx.worldName}" Book ${worldCtx.bookNumber}, reader: ${worldCtx.reader.name}, insights: ${worldCtx.reader.activeInsights.length}, characters: ${worldCtx.characters.length}${worldCtx.reader.birthdayHint ? ", 🎂 birthday detected" : ""}`
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

    const messageCount = claudeMessages.length;
    const lateConversation = messageCount >= 6; // 3+ exchanges in


    const completion = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      system: buildChatSystemPrompt(project, worldCtx, standaloneReaderCtx, lateConversation),
            max_tokens: 1200,
      tools: [START_WRITING_TOOL],
      messages: claudeMessages,
    });

    // Extract text reply and check for tool use
    let reply = "";
    let readyToGenerate = false;
    let storySummary: string | null = null;

    for (const block of completion.content) {
      if (block.type === "text") {
        reply += block.text;
      } else if (block.type === "tool_use" && block.name === "start_writing") {
        readyToGenerate = true;
        storySummary = (block.input as any)?.summary ?? null;
      }
    }

    reply =
      reply.trim() ||
      (readyToGenerate
        ? "Lovely — I'm on it! Give me a moment to write something special."
        : "(no reply)");

    if (readyToGenerate && storySummary) {
      console.log(`✍️ start_writing triggered: "${storySummary}"`);
    }

    await db.insert(chatMessages).values({
      id: uuid(),
      sessionId: session.id,
      role: "assistant",
      content: reply,
      createdAt: new Date(),
    });

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