// create-from-chat/route.ts
// REPLACES: src/app/api/stories/create-from-chat/route.ts
//
// KEY SCHEMA NOTES:
// - Your existing `readers` table (in schema.ts) is per-project with basic fields
// - The worlds `readers` table (in schema-worlds.ts) is the enriched version
// - This route uses the WORLDS readers table for the new reader profiles
// - Your users.id is TEXT not UUID — worlds schema must match
// - stories.readerId already exists and references readers.id
//
// DECISION: We use the existing `readers` table in schema.ts for backward compat,
// but we ADD the missing columns to it rather than having two readers tables.
// See MIGRATION NOTES at the bottom.

import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/db";
import {
  stories,
  storyPages,
  storyStyleGuide,
  chatSessions,
  chatMessages,
  storyProducts,
  projects,
  readers,
} from "@/db/schema";
import { eq, asc, and } from "drizzle-orm";
import { sql as rawSql } from "drizzle-orm";
import { v4 as uuid } from "uuid";

// Import worlds tables from your worlds schema
import { worlds, worldReaders } from "@/db/schema-worlds";

if (!process.env.ANTHROPIC_API_KEY) {
  throw new Error("Missing ANTHROPIC_API_KEY environment variable");
}

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const DEFAULT_PAGE_COUNT = 28;

// ============================================================================
// READER + WORLD EXTRACTION FROM CHAT
// ============================================================================

interface ExtractedReader {
  childName: string;
  age: number | null;
  pronouns: string | null;
  personalityNotes: string | null;
  interests: string[];
  fears: string[];
  readingLevel: string | null;
  gender: string | null;
}

interface ExtractedWorld {
  worldName: string;
  worldDescription: string;
  themes: string[];
  tonality: string | null;
  ageRange: string | null;
}

interface ChatExtraction {
  reader: ExtractedReader;
  world: ExtractedWorld;
}

async function extractReaderAndWorldFromChat(
  chatHistory: Array<{ role: "user" | "assistant"; content: string }>
): Promise<ChatExtraction> {
  const extractionPrompt = `Analyze this conversation between a parent and a story-building AI. Extract two things:

1. READER (the child the story is being created for):
   - childName: the child's first name (required — if unclear, use "Little One")
   - age: their age as a number, or null if not mentioned
   - pronouns: "she/her", "he/him", "they/them", or null
   - gender: "girl", "boy", "non-binary", or null
   - personalityNotes: a brief description of the child's personality based on what the parent shared
   - interests: array of things they love (animals, space, dinosaurs, baking, etc.)
   - fears: array of things they're working through (dark, new school, new sibling, etc.) — only if mentioned
   - readingLevel: "early reader", "confident reader", "pre-reader", or null

2. WORLD (the story universe being created):
   - worldName: a short, evocative name for this story world (e.g. "The Whispering Woods", "Sophie's Space Station")
   - worldDescription: 1-2 sentences describing the world/setting
   - themes: array of emotional/narrative themes (courage, friendship, kindness, etc.)
   - tonality: the story's voice/feel in a few words (e.g. "warm and funny", "gentle and lyrical")
   - ageRange: estimated age range like "3-5" or "5-7" based on context

Respond with ONLY valid JSON, no markdown, no preamble:
{
  "reader": { "childName": "", "age": null, "pronouns": null, "gender": null, "personalityNotes": "", "interests": [], "fears": [], "readingLevel": null },
  "world": { "worldName": "", "worldDescription": "", "themes": [], "tonality": null, "ageRange": null }
}`;

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 1000,
      system: extractionPrompt,
      messages: [
        {
          role: "user",
          content:
            "Here is the conversation:\n\n" +
            chatHistory
              .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
              .join("\n\n"),
        },
      ],
    });

    let raw = (response.content[0] as any).text?.trim();
    if (raw.startsWith("```")) {
      raw = raw
        .replace(/^```json\s*/, "")
        .replace(/^```\s*/, "")
        .replace(/\s*```$/, "");
    }

    const parsed = JSON.parse(raw);
    return {
      reader: {
        childName: parsed.reader?.childName || "Little One",
        age: parsed.reader?.age ?? null,
        pronouns: parsed.reader?.pronouns ?? null,
        gender: parsed.reader?.gender ?? null,
        personalityNotes: parsed.reader?.personalityNotes ?? null,
        interests: Array.isArray(parsed.reader?.interests)
          ? parsed.reader.interests
          : [],
        fears: Array.isArray(parsed.reader?.fears)
          ? parsed.reader.fears
          : [],
        readingLevel: parsed.reader?.readingLevel ?? null,
      },
      world: {
        worldName: parsed.world?.worldName || "Untitled World",
        worldDescription: parsed.world?.worldDescription || "",
        themes: Array.isArray(parsed.world?.themes)
          ? parsed.world.themes
          : [],
        tonality: parsed.world?.tonality ?? null,
        ageRange: parsed.world?.ageRange ?? null,
      },
    };
  } catch (e) {
    console.warn("⚠️ Reader/world extraction failed, using defaults:", e);
    return {
      reader: {
        childName: "Little One",
        age: null,
        pronouns: null,
        gender: null,
        personalityNotes: null,
        interests: [],
        fears: [],
        readingLevel: null,
      },
      world: {
        worldName: "Untitled World",
        worldDescription: "",
        themes: [],
        tonality: null,
        ageRange: null,
      },
    };
  }
}

// ============================================================================
// FIND OR CREATE READER
// Uses your EXISTING readers table (schema.ts) — we match by name for this user
// and enrich with new fields from the chat extraction
// ============================================================================

async function findOrCreateReader(
  userId: string,
  projectId: string,
  extracted: ExtractedReader
): Promise<string> {
  // Try to find an existing reader for this user with the same name
  // (across any project — this is what makes readers persistent)
  const existing = await db
    .select()
    .from(readers)
    .where(
      and(
        eq(readers.userId, userId),
        rawSql`LOWER(${readers.name}) = LOWER(${extracted.childName})`
      )
    )
    .limit(1);

  if (existing.length > 0) {
    const reader = existing[0];
    console.log(`🔵 Matched existing reader: ${reader.name} (${reader.id})`);

    // Update with enriched data if the existing record has gaps
    // Your existing readers table has: name, dob, relationship, gender, aiSummary
    // We update gender and aiSummary with new info
    const updates: Record<string, any> = {};

    if (!reader.gender && extracted.gender) {
      updates.gender = extracted.gender;
    }

    if (extracted.personalityNotes) {
      // Append to aiSummary if it exists, replace if empty
      const newSummary = [reader.aiSummary, extracted.personalityNotes]
        .filter(Boolean)
        .join(" | ");
      if (newSummary !== reader.aiSummary) {
        updates.aiSummary = newSummary;
      }
    }

    if (Object.keys(updates).length > 0) {
      await db
        .update(readers)
        .set(updates)
        .where(eq(readers.id, reader.id));
      console.log(`🔵 Enriched reader with new chat data`);
    }

    return reader.id;
  }

  // Create new reader — using your existing readers table structure
  const readerId = uuid();
  await db.insert(readers).values({
    id: readerId,
    userId,
    projectId, // your existing table has this
    name: extracted.childName,
    gender: extracted.gender,
    aiSummary: [
      extracted.personalityNotes,
      extracted.interests.length > 0
        ? `Interests: ${extracted.interests.join(", ")}`
        : null,
      extracted.fears.length > 0
        ? `Working through: ${extracted.fears.join(", ")}`
        : null,
      extracted.readingLevel
        ? `Reading level: ${extracted.readingLevel}`
        : null,
    ]
      .filter(Boolean)
      .join(" | "),
  });

  console.log(
    `🟢 Created new reader: ${extracted.childName} (${readerId})`
  );
  return readerId;
}

// ============================================================================
// FIND OR CREATE WORLD
// ============================================================================

async function findOrCreateWorld(
  userId: string,
  readerId: string,
  extracted: ExtractedWorld,
  explicitWorldId: string | null
): Promise<{ worldId: string; bookNumber: number }> {
  // If continuing an existing series
  if (explicitWorldId) {
    const existingWorld = await db
      .select()
      .from(worlds)
      .where(and(eq(worlds.id, explicitWorldId), eq(worlds.userId, userId)))
      .limit(1);

    if (existingWorld.length > 0) {
      const bookCountResult = await db.execute(
        rawSql`SELECT COALESCE(MAX(book_number), 0) + 1 as next_book
               FROM stories WHERE world_id = ${explicitWorldId}`
      );
      const nextBook = Number(
        (bookCountResult.rows?.[0] as any)?.next_book ?? 1
      );

      console.log(
        `🔵 Adding to existing world: ${existingWorld[0].name} (Book ${nextBook})`
      );
      return { worldId: explicitWorldId, bookNumber: nextBook };
    }
  }

  // Create a new world
  const worldId = uuid();
  await db.insert(worlds).values({
    id: worldId,
    userId,
    name: extracted.worldName,
    description: extracted.worldDescription,
    tonality: extracted.tonality,
    ageRange: extracted.ageRange,
    themes: extracted.themes,
  });

  // Link reader to world
  await db.insert(worldReaders).values({
    worldId,
    readerId,
    role: "protagonist",
  });

  console.log(
    `🟢 Created new world: "${extracted.worldName}" (${worldId})`
  );
  return { worldId, bookNumber: 1 };
}

// ============================================================================
// MAIN ROUTE
// ============================================================================

export async function POST(req: Request) {
  console.log("🟢 API: Received story creation request");
  try {
    const {
      projectId,
      pageCount = DEFAULT_PAGE_COUNT,
      worldId: explicitWorldId = null,
    } = await req.json();

    if (!projectId) {
      console.error("🔴 API: Missing projectId");
      return NextResponse.json(
        { error: "Missing projectId" },
        { status: 400 }
      );
    }

    // Load project — userId is TEXT in your schema
    const [project] = await db
      .select({
        purchaseIntent: projects.purchaseIntent,
        userId: projects.userId,
      })
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    if (!project || !project.userId) {
      return NextResponse.json(
        { error: "Project not found or missing userId" },
        { status: 404 }
      );
    }

    const intent = project.purchaseIntent;
    const userId = project.userId;

    // 1. Load chat history
    const session = await db
      .select()
      .from(chatSessions)
      .where(eq(chatSessions.projectId, projectId))
      .then((r) => r[0]);

    if (!session) {
      console.error("🔴 API: No chat session found");
      return NextResponse.json(
        { error: "No chat session found for this project." },
        { status: 400 }
      );
    }

    const history = await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.sessionId, session.id))
      .orderBy(asc(chatMessages.createdAt));

    const claudeHistory = history.map((m) => ({
      role: m.role === "user" ? ("user" as const) : ("assistant" as const),
      content: m.content || "",
    }));

    console.log(
      `🔵 API: Processing ${claudeHistory.length} messages...`
    );

    // ================================================================
    // NEW: Extract reader + world from chat
    // ================================================================
    console.log("🔵 API: Extracting reader and world from chat...");
    const extraction = await extractReaderAndWorldFromChat(claudeHistory);
    console.log(
      `🔵 API: Extracted reader "${extraction.reader.childName}", world "${extraction.world.worldName}"`
    );

    // Find or create reader (uses existing readers table)
    const readerId = await findOrCreateReader(
      userId,
      projectId,
      extraction.reader
    );

    // Find or create world (uses worlds schema)
    const { worldId, bookNumber } = await findOrCreateWorld(
      userId,
      readerId,
      extraction.world,
      explicitWorldId
    );

    // ================================================================
    // Generate the story — same as before, with series awareness
    // ================================================================

    const SYSTEM = `You are FlipWhizz — a children's story generator that creates SPECIFIC, VOICE-DRIVEN stories, not generic AI content.

You've just had a conversation with the user about their story. Use EVERYTHING they told you about the characters, setting, tone, and personality. This story should feel like it could ONLY be about this specific child, not any child.

${bookNumber > 1 ? `This is Book ${bookNumber} in a series. The reader already knows and loves these characters. Make it feel like coming home — familiar but with new surprises.` : ""}

CRITICAL ANTI-SLOP RULES:
1. VOICE IS EVERYTHING: If the character "turns everything into a song," we need to HEAR actual songs/rhymes, not "she sang a song about X"
2. SHOW, DON'T TELL: Never write "she was brave" - show her doing something brave in a specific way
3. NO STOCK PHRASES: Ban these phrases and anything like them:
   - "the most beautiful [X] she had ever seen"
   - "declared in her bravest voice"  
   - "began to cry happy tears"
   - "the best [X] ever"
   - Any phrase you've seen in 100 other children's books
4. SPECIFIC DETAILS: Not "made up a funny rhyme" but the ACTUAL rhyme. Not "did gymnastics" but the exact move and how it felt
5. REAL CHARACTER VOICES: Each character should speak/act in a distinct way. Wise Georgie sounds different from silly Bodi
6. UNEXPECTED MOMENTS: Include at least 2-3 genuinely surprising or funny moments that feel true to THIS child
7. LANGUAGE PLAY: If the child loves wordplay, include actual puns, made-up words, rhymes, or verbal creativity
8. EMOTIONAL TRUTH: One real moment of feeling (wonder, fear, joy, frustration) beats ten generic "happy" descriptions

STORY STRUCTURE REQUIREMENTS:
- Exactly ${pageCount} pages
- 1-3 sentences per page (can be one long sentence if that's more interesting)
- Each page should have a clear image-able moment
- Build tension properly: don't solve problems instantly
- The climax should use the character's SPECIFIC skills (not just "tried hard")
- Resolution should feel earned, not convenient

JSON OUTPUT FORMAT:
{
  "title": "A specific, intriguing title (not 'The Adventure of X' or 'X's Journey')",
  "pages": [
    { "page": 1, "text": "..." },
    { "page": 2, "text": "..." }
    // ... ${pageCount} pages total
  ],
  "styleGuide": {
    "summary": "Detailed visual style description for illustrations - be specific about mood, color palette, artistic style (NOT generic 'whimsical storybook')",
    "negativePrompt": "Things to avoid in illustrations"
  }
}

BEFORE WRITING EACH PAGE, ASK YOURSELF:
- Could this sentence appear in any other children's book? If yes, rewrite it.
- Am I SHOWING this character's personality, or just describing it?
- Would a 5-year-old find this surprising, funny, or emotionally true?
- Have I included specific sensory details, not vague descriptions?

Remember: The user specifically said they DON'T want AI slop. They want something that feels handcrafted for their specific child. Use everything from your conversation. Make it THEIRS.

Output ONLY valid JSON, no markdown formatting, no preamble.`;

    const completion = await client.messages.create({
      model: "claude-sonnet-4-5-20250929",
      system: SYSTEM,
      messages: [
        ...claudeHistory,
        {
          role: "user",
          content:
            "Generate the complete story now as JSON with exactly " +
            pageCount +
            " pages. Output ONLY the JSON.",
        },
      ],
      max_tokens: 4096,
    });

    let raw = (completion.content[0] as any).text?.trim();
    console.log("🔵 API: Claude responded. Parsing JSON...");

    if (raw.startsWith("```")) {
      raw = raw
        .replace(/^```json\s*/, "")
        .replace(/^```\s*/, "")
        .replace(/\s*```$/, "");
    }

    let json;
    try {
      json = JSON.parse(raw);
    } catch (e) {
      console.error("🔴 API: JSON Parse Error", raw);
      return NextResponse.json(
        { error: "Invalid JSON returned by AI", raw },
        { status: 500 }
      );
    }

    const { title, pages, styleGuide } = json;

    // 4. Create Story — with reader, world, and book number
    const storyId = uuid();
    console.log(
      `🔵 API: Creating story ${storyId} ("${title}") — World: ${worldId}, Book #${bookNumber}`
    );

    await db.insert(stories).values({
      id: storyId,
      projectId,
      title: title || "Untitled Story",
      length: pageCount,
      fullDraft: raw,
      status: "paged",
      readerId,   // links to existing readers table
      worldId,    // links to worlds table
      bookNumber, // position in series
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // 5. Insert pages
    if (Array.isArray(pages) && pages.length > 0) {
      const pageRows = pages.map((p: any) => ({
        id: uuid(),
        storyId,
        pageNumber: Number(p.page),
        text: p.text,
        illustrationPrompt: null,
        imageId: null,
        createdAt: new Date(),
      }));
      await db.insert(storyPages).values(pageRows);
    }

    // 6. Product intent
    if (intent) {
      const existing = await db.query.storyProducts.findFirst({
        where: eq(storyProducts.storyId, storyId),
      });

      if (!existing) {
        await db.insert(storyProducts).values({
          storyId,
          productType: intent,
          requiresShipping: intent !== "digital",
          requiresPdf: true,
        });
      }
    }

    // 7. Style Guide
    let styleGuideCreated = false;
    try {
      if (styleGuide && storyStyleGuide) {
        await db.insert(storyStyleGuide).values({
          id: uuid(),
          storyId,
          summary: styleGuide?.summary ?? null,
          negativePrompt: styleGuide?.negativePrompt ?? null,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        styleGuideCreated = true;
      }
    } catch (sgError) {
      console.warn(
        "🟠 API: Warning - Could not save style guide:",
        sgError
      );
    }

    console.log("🟢 API: Success!");
    return NextResponse.json({
      storyId,
      title,
      pagesCreated: pages?.length || 0,
      styleGuideCreated,
      // New fields for frontend
      readerId,
      worldId,
      worldName: extraction.world.worldName,
      bookNumber,
      readerName: extraction.reader.childName,
    });
  } catch (err: any) {
    console.error("🔴 API: Critical Error:", err);
    return NextResponse.json(
      { error: "Story creation failed", details: err.message || String(err) },
      { status: 500 }
    );
  }
}