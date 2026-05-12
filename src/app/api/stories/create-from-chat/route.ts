// src/app/api/stories/create-from-chat/route.ts
export const maxDuration = 60;
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
  readerInsights,
} from "@/db/schema";
import { eq, asc, and } from "drizzle-orm";
import { sql as rawSql } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { worlds, worldReaders } from "@/db/schema-worlds";
import { captureServerEvent } from "@/lib/posthog-server";

if (!process.env.ANTHROPIC_API_KEY) {
  throw new Error("Missing ANTHROPIC_API_KEY environment variable");
}

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = "claude-sonnet-4-5-20250929";
const DEFAULT_PAGE_COUNT = 28;

// ============================================================================
// TYPES
// ============================================================================

interface ExtractedReader {
  childName: string;
  age: number | null;
  pronouns: string | null;
  gender: string | null;
  personalityNotes: string | null;
  interests: string[];
  fears: string[];
  readingLevel: string | null;
  dateOfBirth: string | null;
}

interface ExtractedWorld {
  worldName: string;
  worldDescription: string;
  themes: string[];
  tonality: string | null;
  ageRange: string | null;
}

interface ExtractedInsight {
  type: string;
  content: string;
  confidence: number;
}

interface ChatExtraction {
  reader: ExtractedReader;
  world: ExtractedWorld;
  insights: ExtractedInsight[];
}

// ============================================================================
// EXTRACT READER, WORLD & INSIGHTS FROM CHAT
// ============================================================================

async function extractFromChat(
  chatHistory: Array<{ role: "user" | "assistant"; content: string }>
): Promise<ChatExtraction> {
  const prompt = `You are analyzing a conversation between a parent and a children's book creation AI. Extract three things with care and precision.

1. READER — the child this story is for:
   - childName: their first name. If genuinely unclear, use "Little One"
   - age: integer or null. Listen for "she's 4", "he just turned 6", "nearly 5"
   - pronouns: "she/her", "he/him", "they/them", or null
   - gender: "girl", "boy", "non-binary", or null
   - personalityNotes: 1-2 sentences capturing who this child IS based on what the parent revealed. Not generic — specific. "Shy at first but fiercely brave once she trusts someone. Turns everything into a song."
   - interests: array of specific things they love. Not categories — specifics. Not "animals" but "dogs, especially golden retrievers". Not "science" but "volcanoes and space rockets"
   - fears: array of things they're working through. ONLY include if the parent actually mentioned it. "starting school", "sleeping alone", "new baby sister taking attention"
   - readingLevel: "pre-reader" (0-3), "early reader" (3-5), "confident reader" (5-7), "independent reader" (7+), or null
   - dateOfBirth: if the parent mentions a specific birthday ("her birthday is March 15th", "she was born in June 2021"), extract as ISO date string "YYYY-MM-DD". Use null if only age is mentioned.

2. WORLD — the story universe being created:
   - worldName: short, evocative, specific to THIS story. Not "Adventure Land" — something that captures the actual setting. "The Whispering Woodland" or "Sophia's Secret River"
   - worldDescription: 1-2 vivid sentences. Not a summary — a sense of place.
   - themes: emotional/narrative themes. Be specific: not just "friendship" but "learning that being different is what makes friendships interesting"
   - tonality: how the story should FEEL in a few words. "warm and gently funny" or "wild, silly, and a bit chaotic"
   - ageRange: "2-4", "3-5", "4-6", "5-7", or "6-8" based on the child's age and reading level

3. INSIGHTS — developmental observations about the child, extracted from what the parent revealed naturally. These help future stories be even more attuned to the child. Only extract insights the parent actually shared — never infer or assume.

Each insight has:
   - type: one of "interest", "fear", "life_event", "milestone", "personality", "reading_progress", "emotional_need", "social", "preference"
   - content: the specific observation in plain language
   - confidence: 60-100, how clearly the parent expressed this

Examples of good insights:
   - { type: "life_event", content: "Just started Reception, nervous about making friends", confidence: 90 }
   - { type: "personality", content: "Turns everything into a song — even brushing teeth", confidence: 85 }
   - { type: "social", content: "Has been arguing with older brother a lot lately", confidence: 75 }
   - { type: "preference", content: "Loves stories where animals can talk but finds robots scary", confidence: 80 }

Respond with ONLY valid JSON, no markdown, no preamble:
{
  "reader": { "childName": "", "age": null, "pronouns": null, "gender": null, "personalityNotes": "", "interests": [], "fears": [], "readingLevel": null, "dateOfBirth": null },
  "world": { "worldName": "", "worldDescription": "", "themes": [], "tonality": null, "ageRange": null },
  "insights": []
}`;

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1500,
      system: prompt,
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
      raw = raw.replace(/^```json\s*/, "").replace(/^```\s*/, "").replace(/\s*```$/, "");
    }

    const parsed = JSON.parse(raw);

    return {
      reader: {
        childName: parsed.reader?.childName || "Little One",
        age: parsed.reader?.age ?? null,
        pronouns: parsed.reader?.pronouns ?? null,
        gender: parsed.reader?.gender ?? null,
        personalityNotes: parsed.reader?.personalityNotes ?? null,
        interests: Array.isArray(parsed.reader?.interests) ? parsed.reader.interests : [],
        fears: Array.isArray(parsed.reader?.fears) ? parsed.reader.fears : [],
        readingLevel: parsed.reader?.readingLevel ?? null,
        dateOfBirth: parsed.reader?.dateOfBirth ?? null,
      },
      world: {
        worldName: parsed.world?.worldName || "Untitled World",
        worldDescription: parsed.world?.worldDescription || "",
        themes: Array.isArray(parsed.world?.themes) ? parsed.world.themes : [],
        tonality: parsed.world?.tonality ?? null,
        ageRange: parsed.world?.ageRange ?? null,
      },
      insights: Array.isArray(parsed.insights)
        ? parsed.insights.filter((i: any) => i?.type && i?.content)
        : [],
    };
  } catch (e) {
    console.warn("⚠️ Extraction failed, using defaults:", e);
    return {
      reader: {
        childName: "Little One", age: null, pronouns: null, gender: null,
        personalityNotes: null, interests: [], fears: [], readingLevel: null,
        dateOfBirth: null,
      },
      world: {
        worldName: "Untitled World", worldDescription: "", themes: [],
        tonality: null, ageRange: null,
      },
      insights: [],
    };
  }
}

// ============================================================================
// FIND OR CREATE READER — structured fields, merge logic
// ============================================================================

async function findOrCreateReader(
  userId: string,
  projectId: string,
  extracted: ExtractedReader
): Promise<string> {
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

    const updates: Record<string, any> = {};

    // Fill gaps — never overwrite existing data
    if (!reader.gender && extracted.gender) updates.gender = extracted.gender;
    if (!reader.pronouns && extracted.pronouns) updates.pronouns = extracted.pronouns;
    if (!reader.personalityNotes && extracted.personalityNotes) updates.personalityNotes = extracted.personalityNotes;
    if (!reader.readingLevel && extracted.readingLevel) updates.readingLevel = extracted.readingLevel;
    if (!(reader as any).age && extracted.age) updates.age = extracted.age;

    // DOB — only set if we don't have one and extraction found one
    if (!(reader as any).dateOfBirthDate && extracted.dateOfBirth) {
      try {
        updates.dateOfBirthDate = new Date(extracted.dateOfBirth);
      } catch {}
    }

    // Merge interests (deduplicate)
    const existingInterests = ((reader as any).interests as string[]) || [];
    const merged = [...new Set([...existingInterests, ...extracted.interests])];
    if (merged.length > existingInterests.length) updates.interests = merged;

    // Merge fears
    const existingFears = ((reader as any).fears as string[]) || [];
    const mergedFears = [...new Set([...existingFears, ...extracted.fears])];
    if (mergedFears.length > existingFears.length) updates.fears = mergedFears;

    // Append personality notes if we have new info
    if (extracted.personalityNotes && reader.personalityNotes) {
      const combined = reader.personalityNotes + " " + extracted.personalityNotes;
      if (combined.length <= 1000 && combined !== reader.personalityNotes) {
        updates.personalityNotes = combined;
      }
    }

    if (Object.keys(updates).length > 0) {
      updates.updatedAt = new Date();
      await db.update(readers).set(updates).where(eq(readers.id, reader.id));
      console.log(`🔵 Enriched reader: ${Object.keys(updates).filter(k => k !== "updatedAt").join(", ")}`);
    }

    return reader.id;
  }

  // Create new reader with structured fields
  const readerId = uuid();
  await db.insert(readers).values({
    id: readerId,
    userId,
    projectId,
    name: extracted.childName,
    gender: extracted.gender,
    pronouns: extracted.pronouns,
    personalityNotes: extracted.personalityNotes,
    interests: extracted.interests,
    fears: extracted.fears,
    readingLevel: extracted.readingLevel,
    ...(extracted.age != null && { age: extracted.age }),
    ...(extracted.dateOfBirth && {
      dateOfBirthDate: new Date(extracted.dateOfBirth),
    }),
    // Legacy field — still write for backward compat
    aiSummary: [
      extracted.personalityNotes,
      extracted.interests.length > 0 ? `Interests: ${extracted.interests.join(", ")}` : null,
      extracted.fears.length > 0 ? `Working through: ${extracted.fears.join(", ")}` : null,
      extracted.readingLevel ? `Reading level: ${extracted.readingLevel}` : null,
    ].filter(Boolean).join(" | "),
  });

  console.log(`🟢 Created reader: ${extracted.childName} (${readerId})`);
  return readerId;
}

// ============================================================================
// SAVE READER INSIGHTS
// ============================================================================

async function saveReaderInsights(
  readerId: string,
  storyId: string,
  insights: ExtractedInsight[]
): Promise<void> {
  if (insights.length === 0) return;

  for (const insight of insights) {
    try {
      await db.insert(readerInsights).values({
        readerId,
        insightType: insight.type,
        content: insight.content,
        confidence: Math.min(100, Math.max(0, insight.confidence || 80)),
        isActive: true,
        sourceType: "chat",
        sourceStoryId: storyId,
      });
    } catch (err) {
      console.warn(`⚠️ Failed to save insight: ${insight.content}`, err);
    }
  }

  console.log(`💡 Saved ${insights.length} reader insights`);
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
  if (explicitWorldId) {
    const existingWorld = await db
      .select()
      .from(worlds)
      .where(and(eq(worlds.id, explicitWorldId), eq(worlds.userId, userId)))
      .limit(1);

    if (existingWorld.length > 0) {
      const existingBooks = await db
        .select({ bookNumber: stories.bookNumber })
        .from(stories)
        .where(eq(stories.worldId, explicitWorldId));

      const maxBook = existingBooks.reduce(
        (max, b) => Math.max(max, b.bookNumber ?? 0), 0
      );
      const nextBook = maxBook + 1;

      console.log(`🔵 Adding to world: ${existingWorld[0].name} (Book ${nextBook})`);
      return { worldId: explicitWorldId, bookNumber: nextBook };
    }
  }

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

  await db.insert(worldReaders).values({
    worldId,
    readerId,
    role: "protagonist",
  });

  console.log(`🟢 Created world: "${extracted.worldName}" (${worldId})`);
  return { worldId, bookNumber: 1 };
}

// ============================================================================
// AGE HELPER
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

// ============================================================================
// MAIN ROUTE
// ============================================================================

export async function POST(req: Request) {
  console.log("🟢 API: Story creation request received");
  try {
    const {
      projectId,
      pageCount = DEFAULT_PAGE_COUNT,
      worldId: explicitWorldId = null,
    } = await req.json();

    if (!projectId) {
      return NextResponse.json({ error: "Missing projectId" }, { status: 400 });
    }

    const [project] = await db
      .select({ purchaseIntent: projects.purchaseIntent, userId: projects.userId })
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    if (!project?.userId) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const { purchaseIntent: intent, userId } = project;

    // Load chat history
    const session = await db
      .select()
      .from(chatSessions)
      .where(eq(chatSessions.projectId, projectId))
      .then((r) => r[0]);

    if (!session) {
      return NextResponse.json({ error: "No chat session found." }, { status: 400 });
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

    // ================================================================
    // EXTRACT: reader, world, and insights from the conversation
    // ================================================================

    console.log("🔵 Extracting reader, world & insights...");
    const extraction = await extractFromChat(claudeHistory);
    console.log(
      `🔵 Extracted: reader="${extraction.reader.childName}", world="${extraction.world.worldName}", insights=${extraction.insights.length}`
    );

    const readerId = await findOrCreateReader(userId, projectId, extraction.reader);
    const { worldId, bookNumber } = await findOrCreateWorld(userId, readerId, extraction.world, explicitWorldId);

    // ================================================================
    // GENERATE THE STORY
    // ================================================================

    const readerAge = computeAge(extraction.reader.dateOfBirth, extraction.reader.age);

    const SYSTEM = `You are FlipWhizz — a children's story generator that creates SPECIFIC, VOICE-DRIVEN stories.

You've just had a conversation with a parent about a story for their child. Everything they told you matters. This story should feel like it could ONLY be about this specific child.

${readerAge ? `THE READER: ${extraction.reader.childName}, age ${readerAge}` : `THE READER: ${extraction.reader.childName}`}
${extraction.reader.pronouns ? `Pronouns: ${extraction.reader.pronouns}` : ""}
${extraction.reader.personalityNotes ? `Personality: ${extraction.reader.personalityNotes}` : ""}
${extraction.reader.interests.length > 0 ? `Loves: ${extraction.reader.interests.join(", ")}` : ""}
${extraction.reader.fears.length > 0 ? `Working through: ${extraction.reader.fears.join(", ")}` : ""}
${extraction.reader.readingLevel ? `Reading level: ${extraction.reader.readingLevel}` : ""}

${bookNumber > 1 ? `SERIES CONTEXT: This is Book ${bookNumber} in "${extraction.world.worldName}". The reader knows and loves these characters. Make it feel like coming home — familiar but with new surprises. Reference previous adventures naturally.` : ""}

ANTI-SLOP RULES — these are non-negotiable:
1. VOICE IS EVERYTHING. If a character "turns everything into a song," we hear the actual song. If they're "funny," we laugh at something specific they say.
2. SHOW, DON'T TELL. Never "she was brave" — show her doing the brave thing. Never "he felt sad" — show what sadness looks like for THIS child.
3. BANNED PHRASES. If you've read it in 100 children's books, don't write it. No "the most beautiful X she had ever seen", no "declared bravely", no "began to cry happy tears", no "the best X ever".
4. SPECIFIC DETAILS. Not "made up a funny rhyme" but THE ACTUAL RHYME. Not "did a cool trick" but the exact move. The parent gave you specifics — use every single one.
5. DISTINCT VOICES. Every character sounds different. A wise old dog doesn't talk like an excited child. Dialogue reveals personality.
6. UNEXPECTED MOMENTS. At least 2-3 moments that genuinely surprise. Real humour, real wonder, real tension — not paint-by-numbers plot.
7. EMOTIONAL TRUTH. One authentic moment of feeling beats ten generic descriptions. Let the child feel something real.

STRUCTURE:
- Exactly ${pageCount} pages
- 1-3 sentences per page — quality over quantity
- Each page = one illustratable moment
- Build tension properly. Don't solve problems instantly.
- The climax uses THIS character's specific skills, not generic determination
- The resolution feels earned

${extraction.reader.readingLevel === "pre-reader" ? "LANGUAGE: Very simple sentences. Repetition is good. Rhyme and rhythm help. Max 15 words per page." : ""}
${extraction.reader.readingLevel === "early reader" ? "LANGUAGE: Short, clear sentences. Some new vocabulary is fine if context makes meaning obvious. 1-2 sentences per page." : ""}
${extraction.reader.readingLevel === "confident reader" ? "LANGUAGE: Richer vocabulary, longer sentences OK. Can handle more complex emotions and plot. 2-3 sentences per page." : ""}

JSON OUTPUT — no markdown, no preamble, ONLY this:
{
  "title": "A specific, intriguing title",
  "pages": [
    { "page": 1, "text": "..." }
  ],
  "styleGuide": {
    "summary": "Specific visual style — mood, palette, artistic approach. NOT 'whimsical storybook illustration'.",
    "negativePrompt": "What to avoid in illustrations"
  }
}`;

    const completion = await client.messages.create({
      model: MODEL,
      system: SYSTEM,
      messages: [
        ...claudeHistory,
        {
          role: "user",
          content: `Generate the complete story now as JSON with exactly ${pageCount} pages. Output ONLY the JSON.`,
        },
      ],
      max_tokens: 4096,
    });

    let raw = (completion.content[0] as any).text?.trim();
    if (raw.startsWith("```")) {
      raw = raw.replace(/^```json\s*/, "").replace(/^```\s*/, "").replace(/\s*```$/, "");
    }

    let json;
    try {
      json = JSON.parse(raw);
    } catch {
      console.error("🔴 JSON parse error:", raw?.slice(0, 200));
      return NextResponse.json({ error: "Invalid JSON from AI", raw }, { status: 500 });
    }

    const { title, pages, styleGuide } = json;

    // ================================================================
    // SAVE: Story, pages, products, style guide, insights
    // ================================================================

    const storyId = uuid();
    console.log(`🔵 Creating story "${title}" — World: ${worldId}, Book #${bookNumber}`);

    await db.insert(stories).values({
      id: storyId,
      projectId,
      title: title || "Untitled Story",
      length: pageCount,
      fullDraft: raw,
      status: "paged",
      readerId,
      worldId,
      bookNumber,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    if (Array.isArray(pages) && pages.length > 0) {
      await db.insert(storyPages).values(
        pages.map((p: any) => ({
          id: uuid(),
          storyId,
          pageNumber: Number(p.page),
          text: p.text,
          illustrationPrompt: null,
          imageId: null,
          createdAt: new Date(),
        }))
      );
    }

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

    let styleGuideCreated = false;
    try {
      if (styleGuide) {
        await db.insert(storyStyleGuide).values({
          id: uuid(),
          storyId,
          summary: styleGuide.summary ?? null,
          negativePrompt: styleGuide.negativePrompt ?? null,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        styleGuideCreated = true;
      }
    } catch (err) {
      console.warn("🟠 Style guide save failed:", err);
    }

    // Save reader insights (non-blocking — don't fail the request)
    saveReaderInsights(readerId, storyId, extraction.insights).catch((err) =>
      console.warn("⚠️ Insight save failed:", err)
    );

    console.log("🟢 Story creation complete!");



    await captureServerEvent(userId, "story_created", {
      story_id: storyId,
      project_id: projectId,
      title,
      page_count: pages?.length || 0,
      reader_name: extraction.reader.childName,
      reader_age: extraction.reader.age,
      world_name: extraction.world.worldName,
      book_number: bookNumber,
      insights_count: extraction.insights.length,
      purchase_intent: intent || null,
    });

    return NextResponse.json({
      storyId,
      title,
      pagesCreated: pages?.length || 0,
      styleGuideCreated,
      readerId,
      worldId,
      worldName: extraction.world.worldName,
      bookNumber,
      readerName: extraction.reader.childName,
      insightsExtracted: extraction.insights.length,
    });
  } catch (err: any) {
    console.error("🔴 Critical error:", err);
    return NextResponse.json(
      { error: "Story creation failed", details: err.message || String(err) },
      { status: 500 }
    );
  }
}