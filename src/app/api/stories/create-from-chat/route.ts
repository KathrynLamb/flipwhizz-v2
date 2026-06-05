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
  dateOfBirth: string | null; // YYYY-MM-DD or null — never a partial date
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
// VALIDATION HELPERS
// ============================================================================

/**
 * Validates and sanitises a date-of-birth string from AI extraction.
 * Returns a clean YYYY-MM-DD string, or null if:
 *  - the value is missing or unparseable
 *  - the date is in the future
 *  - the date implies an age > 18 (not a child)
 *  - the date is suspiciously precise when only a month/year was mentioned
 *    (we can't detect this here, but the extraction prompt prevents it)
 */
function safeDateOfBirth(raw: string | null | undefined): string | null {
  if (!raw) return null;

  let d: Date;
  try {
    d = new Date(raw);
  } catch {
    return null;
  }

  if (isNaN(d.getTime())) return null;

  const now = new Date();
  // Must not be in the future
  if (d > now) return null;
  // Must be within the last 18 years
  const eighteenYearsAgo = new Date(
    now.getFullYear() - 18,
    now.getMonth(),
    now.getDate()
  );
  if (d < eighteenYearsAgo) return null;

  // Return clean ISO date only (YYYY-MM-DD) — no time, no timezone confusion
  return d.toISOString().split("T")[0];
}

/**
 * Validates an age integer from AI extraction.
 * Returns null if zero, negative, or > 17.
 * Newborns should be null, not 0.
 */
function safeAge(raw: number | null | undefined): number | null {
  if (raw == null) return null;
  if (typeof raw !== "number") return null;
  if (!Number.isInteger(raw)) return null;
  if (raw <= 0) return null; // newborns = null
  if (raw > 17) return null; // not a child
  return raw;
}

/**
 * Validates pronouns — only accepts known values.
 */
function safePronouns(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const allowed = ["she/her", "he/him", "they/them"];
  return allowed.includes(raw) ? raw : null;
}

/**
 * Validates gender — only accepts known values.
 */
function safeGender(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const allowed = ["girl", "boy", "non-binary"];
  return allowed.includes(raw) ? raw : null;
}

/**
 * Validates reading level — only accepts known values.
 */
function safeReadingLevel(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const allowed = ["pre-reader", "early reader", "confident reader", "independent reader"];
  return allowed.includes(raw) ? raw : null;
}

/**
 * Sanitises a string array from AI extraction — removes nulls, empties, non-strings.
 */
function safeStringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .map((item) => item.trim().slice(0, 200)); // cap each item length
}

/**
 * Sanitises a free-text string — trims, caps at length, returns null if empty.
 */
function safeText(raw: unknown, maxLen = 1000): string | null {
  if (!raw || typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  return trimmed.slice(0, maxLen);
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
   - age: integer or null. Listen for "she's 4", "he just turned 6", "nearly 5". For newborns or babies under 1 year old, ALWAYS use null — never 0.
   - pronouns: "she/her", "he/him", "they/them", or null. No other values allowed.
   - gender: "girl", "boy", "non-binary", or null. No other values allowed.
   - personalityNotes: 1-2 sentences capturing who this child IS. Specific, not generic.
   - interests: array of specific things they love. Not categories — specifics.
   - fears: array of things they're working through. ONLY include if the parent actually mentioned it.
   - readingLevel: one of exactly: "pre-reader", "early reader", "confident reader", "independent reader", or null.
   - dateOfBirth: STRICT RULE — only set this if the parent gives BOTH a specific day AND month AND year (e.g. "born on 3rd March 2022" → "2022-03-03"). If the parent only mentions a month ("born in May"), a year ("born in 2023"), or an age ("she's 4"), you MUST return null. Do not infer, estimate, or guess a day. Partial information = null.

2. WORLD — the story universe being created:
   - worldName: short, evocative, specific to THIS story.
   - worldDescription: 1-2 vivid sentences describing the world/setting.
   - themes: emotional/narrative themes as an array of strings.
   - tonality: how the story should FEEL in a few words.
   - ageRange: one of "2-4", "3-5", "4-6", "5-7", "6-8" based on context, or null.

3. INSIGHTS — developmental observations about the child, only from what the parent actually shared. Never infer or assume.
   Each insight: { type, content, confidence }
   type must be one of: "interest", "fear", "life_event", "milestone", "personality", "reading_progress", "emotional_need", "social", "preference"
   confidence: 60-100

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
    if (!raw) throw new Error("Empty response from extraction model");

    // Strip markdown fences if present
    if (raw.startsWith("```")) {
      raw = raw
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/, "")
        .replace(/\s*```$/, "");
    }

    const parsed = JSON.parse(raw);

    // Apply all validators at the boundary — nothing raw ever reaches the DB
    return {
      reader: {
        childName: safeText(parsed.reader?.childName, 120) || "Little One",
        age: safeAge(parsed.reader?.age),
        pronouns: safePronouns(parsed.reader?.pronouns),
        gender: safeGender(parsed.reader?.gender),
        personalityNotes: safeText(parsed.reader?.personalityNotes, 500),
        interests: safeStringArray(parsed.reader?.interests),
        fears: safeStringArray(parsed.reader?.fears),
        readingLevel: safeReadingLevel(parsed.reader?.readingLevel),
        dateOfBirth: safeDateOfBirth(parsed.reader?.dateOfBirth),
      },
      world: {
        worldName: safeText(parsed.world?.worldName, 200) || "Untitled World",
        worldDescription: safeText(parsed.world?.worldDescription, 500) || "",
        themes: safeStringArray(parsed.world?.themes),
        tonality: safeText(parsed.world?.tonality, 100),
        ageRange: safeText(parsed.world?.ageRange, 10),
      },
      insights: Array.isArray(parsed.insights)
        ? parsed.insights
            .filter(
              (i: any) =>
                i?.type &&
                typeof i.type === "string" &&
                i?.content &&
                typeof i.content === "string"
            )
            .map((i: any) => ({
              type: i.type.slice(0, 50),
              content: i.content.slice(0, 500),
              confidence: Math.min(100, Math.max(60, Number(i.confidence) || 80)),
            }))
        : [],
    };
  } catch (e) {
    console.warn("⚠️ Extraction failed, using safe defaults:", e);
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
        dateOfBirth: null,
      },
      world: {
        worldName: "Untitled World",
        worldDescription: "",
        themes: [],
        tonality: null,
        ageRange: null,
      },
      insights: [],
    };
  }
}

// ============================================================================
// FIND OR CREATE READER — fully hardened
// ============================================================================

async function findOrCreateReader(
  userId: string,
  projectId: string,
  extracted: ExtractedReader
): Promise<string> {
  // Step 1: Try to match an existing reader for this user by name
  let existing;
  try {
    existing = await db
      .select()
      .from(readers)
      .where(
        and(
          eq(readers.userId, userId),
          rawSql`LOWER(${readers.name}) = LOWER(${extracted.childName})`
        )
      )
      .limit(1);
  } catch (err) {
    console.error("🔴 [findOrCreateReader] Failed to query existing readers:", err);
    throw new Error(`Reader lookup failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  if (existing.length > 0) {
    const reader = existing[0];
    console.log(`🔵 Matched existing reader: ${reader.name} (${reader.id})`);

    // Build updates — never overwrite existing data, only fill gaps
    const updates: Record<string, any> = {};

    if (!reader.gender && extracted.gender) updates.gender = extracted.gender;
    if (!reader.pronouns && extracted.pronouns) updates.pronouns = extracted.pronouns;
    if (!reader.personalityNotes && extracted.personalityNotes)
      updates.personalityNotes = extracted.personalityNotes;
    if (!reader.readingLevel && extracted.readingLevel)
      updates.readingLevel = extracted.readingLevel;

    // age: only fill if missing AND new value is valid (safeAge already run)
    if (!reader.age && extracted.age != null) updates.age = extracted.age;

    // dateOfBirthDate: only fill if missing AND we have a clean YYYY-MM-DD string
    if (!reader.dateOfBirthDate && extracted.dateOfBirth) {
      updates.dateOfBirthDate = extracted.dateOfBirth; // Drizzle date column accepts YYYY-MM-DD string
    }

    // Merge interests (deduplicate)
    const existingInterests = (reader.interests as string[] | null) ?? [];
    const mergedInterests = [...new Set([...existingInterests, ...extracted.interests])];
    if (mergedInterests.length > existingInterests.length)
      updates.interests = mergedInterests;

    // Merge fears (deduplicate)
    const existingFears = (reader.fears as string[] | null) ?? [];
    const mergedFears = [...new Set([...existingFears, ...extracted.fears])];
    if (mergedFears.length > existingFears.length) updates.fears = mergedFears;

    // Append to personalityNotes if both old and new exist
    if (extracted.personalityNotes && reader.personalityNotes) {
      const combined = `${reader.personalityNotes} ${extracted.personalityNotes}`;
      if (combined.length <= 1000) updates.personalityNotes = combined;
    }

    if (Object.keys(updates).length > 0) {
      updates.updatedAt = new Date();
      try {
        await db.update(readers).set(updates).where(eq(readers.id, reader.id));
        console.log(
          `🔵 Enriched reader fields: ${Object.keys(updates)
            .filter((k) => k !== "updatedAt")
            .join(", ")}`
        );
      } catch (err) {
        // Non-fatal: log and continue — the reader exists, enrichment is a bonus
        console.warn("🟠 [findOrCreateReader] Reader enrichment failed (non-fatal):", err);
      }
    }

    return reader.id;
  }

  // Step 2: Create a new reader
  const readerId = uuid();

  // Build the insert values carefully — only include optional fields when valid
  const insertValues: Record<string, any> = {
    id: readerId,
    userId,
    projectId,
    name: extracted.childName,
    // Legacy aiSummary — still write for backward compat
    aiSummary: [
      extracted.personalityNotes,
      extracted.interests.length > 0
        ? `Interests: ${extracted.interests.join(", ")}`
        : null,
      extracted.fears.length > 0
        ? `Working through: ${extracted.fears.join(", ")}`
        : null,
      extracted.readingLevel ? `Reading level: ${extracted.readingLevel}` : null,
    ]
      .filter(Boolean)
      .join(" | ") || null,
  };

  // Only add optional fields when they have valid values
  if (extracted.gender) insertValues.gender = extracted.gender;
  if (extracted.pronouns) insertValues.pronouns = extracted.pronouns;
  if (extracted.personalityNotes)
    insertValues.personalityNotes = extracted.personalityNotes;
  if (extracted.readingLevel) insertValues.readingLevel = extracted.readingLevel;
  if (extracted.interests.length > 0) insertValues.interests = extracted.interests;
  if (extracted.fears.length > 0) insertValues.fears = extracted.fears;

  // age: only include if we have a valid positive integer
  if (extracted.age != null) insertValues.age = extracted.age;

  // dateOfBirthDate: only include if we have a clean YYYY-MM-DD string
  if (extracted.dateOfBirth) insertValues.dateOfBirthDate = extracted.dateOfBirth;

  try {
    await db.insert(readers).values(insertValues);
    console.log(`🟢 Created reader: ${extracted.childName} (${readerId})`);
  } catch (err) {
    console.error("🔴 [findOrCreateReader] Reader insert failed:", err);
    console.error("🔴 Insert values attempted:", JSON.stringify(insertValues, null, 2));
    throw new Error(
      `Reader creation failed: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  return readerId;
}

// ============================================================================
// SAVE READER INSIGHTS — non-fatal per insight
// ============================================================================

async function saveReaderInsights(
  readerId: string,
  storyId: string,
  insights: ExtractedInsight[]
): Promise<void> {
  if (insights.length === 0) return;

  let saved = 0;
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
      saved++;
    } catch (err) {
      // Individual insight failures are non-fatal — log and continue
      console.warn(`🟠 Failed to save insight "${insight.content.slice(0, 50)}...":`, err);
    }
  }

  console.log(`💡 Saved ${saved}/${insights.length} reader insights`);
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
  // If an explicit world ID was passed, try to use it
  if (explicitWorldId) {
    try {
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
          (max, b) => Math.max(max, b.bookNumber ?? 0),
          0
        );
        const nextBook = maxBook + 1;

        console.log(
          `🔵 Adding to existing world: "${existingWorld[0].name}" (Book ${nextBook})`
        );
        return { worldId: explicitWorldId, bookNumber: nextBook };
      }
    } catch (err) {
      console.warn("🟠 [findOrCreateWorld] Failed to look up explicit world, creating new:", err);
      // Fall through to create a new world
    }
  }

  // Create a new world
  const worldId = uuid();
  try {
    await db.insert(worlds).values({
      id: worldId,
      userId,
      name: extracted.worldName,
      description: extracted.worldDescription || null,
      tonality: extracted.tonality || null,
      ageRange: extracted.ageRange || null,
      themes: extracted.themes,
    });

    await db.insert(worldReaders).values({
      worldId,
      readerId,
      role: "protagonist",
    });

    console.log(`🟢 Created world: "${extracted.worldName}" (${worldId})`);
  } catch (err) {
    console.error("🔴 [findOrCreateWorld] World creation failed:", err);
    throw new Error(
      `World creation failed: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  return { worldId, bookNumber: 1 };
}

// ============================================================================
// AGE HELPER
// ============================================================================

function computeAge(dob: string | null, fallbackAge: number | null): number | null {
  if (!dob) return fallbackAge;
  const birth = new Date(dob);
  if (isNaN(birth.getTime())) return fallbackAge;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age >= 0 ? age : fallbackAge;
}

// ============================================================================
// MAIN ROUTE
// ============================================================================

export async function POST(req: Request) {
  console.log("🟢 [create-from-chat] Story creation request received");

  let projectId: string;
  let pageCount: number;
  let explicitWorldId: string | null;

  // ── Parse request body ──────────────────────────────────────────────────
  try {
    const body = await req.json();
    projectId = body.projectId;
    pageCount = Number(body.pageCount) || DEFAULT_PAGE_COUNT;
    explicitWorldId = body.worldId ?? null;
  } catch (err) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!projectId) {
    return NextResponse.json({ error: "Missing projectId" }, { status: 400 });
  }

  // ── Load project ─────────────────────────────────────────────────────────
  let project: { purchaseIntent: string | null; userId: string } | undefined;
  try {
    const rows = await db
      .select({ purchaseIntent: projects.purchaseIntent, userId: projects.userId })
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);
    project = rows[0];
  } catch (err) {
    console.error("🔴 [create-from-chat] Failed to load project:", err);
    return NextResponse.json({ error: "Failed to load project" }, { status: 500 });
  }

  if (!project?.userId) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const { purchaseIntent: intent, userId } = project;

  // ── Load chat history ────────────────────────────────────────────────────
  let claudeHistory: Array<{ role: "user" | "assistant"; content: string }>;
  try {
    const session = await db
      .select()
      .from(chatSessions)
      .where(eq(chatSessions.projectId, projectId))
      .then((r) => r[0]);

    if (!session) {
      return NextResponse.json(
        { error: "No chat session found for this project" },
        { status: 400 }
      );
    }

    const history = await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.sessionId, session.id))
      .orderBy(asc(chatMessages.createdAt));

    if (history.length === 0) {
      return NextResponse.json(
        { error: "Chat session exists but has no messages" },
        { status: 400 }
      );
    }

    claudeHistory = history.map((m) => ({
      role: m.role === "user" ? ("user" as const) : ("assistant" as const),
      content: m.content || "",
    }));

    console.log(`🔵 Loaded ${claudeHistory.length} chat messages`);
  } catch (err) {
    console.error("🔴 [create-from-chat] Failed to load chat history:", err);
    return NextResponse.json({ error: "Failed to load chat history" }, { status: 500 });
  }

  // ── Extract reader, world & insights ────────────────────────────────────
  let extraction: ChatExtraction;
  try {
    console.log("🔵 Extracting reader, world & insights...");
    extraction = await extractFromChat(claudeHistory);
    console.log(
      `🔵 Extracted: reader="${extraction.reader.childName}", age=${extraction.reader.age ?? "null (newborn/unknown)"}, dob=${extraction.reader.dateOfBirth ?? "null"}, world="${extraction.world.worldName}", insights=${extraction.insights.length}`
    );
  } catch (err) {
    console.error("🔴 [create-from-chat] Extraction failed:", err);
    return NextResponse.json({ error: "Failed to extract story details from chat" }, { status: 500 });
  }

  // ── Create reader ────────────────────────────────────────────────────────
  let readerId: string;
  try {
    readerId = await findOrCreateReader(userId, projectId, extraction.reader);
  } catch (err) {
    console.error("🔴 [create-from-chat] Reader step failed:", err);
    return NextResponse.json(
      {
        error: "Failed to create reader profile",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }

  // ── Create world ─────────────────────────────────────────────────────────
  let worldId: string;
  let bookNumber: number;
  try {
    ({ worldId, bookNumber } = await findOrCreateWorld(
      userId,
      readerId,
      extraction.world,
      explicitWorldId
    ));
  } catch (err) {
    console.error("🔴 [create-from-chat] World step failed:", err);
    return NextResponse.json(
      {
        error: "Failed to create story world",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }

  // ── Generate story ───────────────────────────────────────────────────────
  const readerAge = computeAge(extraction.reader.dateOfBirth, extraction.reader.age);

  const SYSTEM = `You are FlipWhizz — a children's story generator that creates SPECIFIC, VOICE-DRIVEN stories.

You've just had a conversation with a parent about a story for their child. Everything they told you matters. This story should feel like it could ONLY be about this specific child.

${readerAge != null ? `THE READER: ${extraction.reader.childName}, age ${readerAge}` : `THE READER: ${extraction.reader.childName}`}
${extraction.reader.pronouns ? `Pronouns: ${extraction.reader.pronouns}` : ""}
${extraction.reader.personalityNotes ? `Personality: ${extraction.reader.personalityNotes}` : ""}
${extraction.reader.interests.length > 0 ? `Loves: ${extraction.reader.interests.join(", ")}` : ""}
${extraction.reader.fears.length > 0 ? `Working through: ${extraction.reader.fears.join(", ")}` : ""}
${extraction.reader.readingLevel ? `Reading level: ${extraction.reader.readingLevel}` : ""}

${bookNumber > 1 ? `SERIES CONTEXT: This is Book ${bookNumber} in "${extraction.world.worldName}". The reader knows and loves these characters. Make it feel like coming home.` : ""}

ANTI-SLOP RULES — non-negotiable:
1. VOICE IS EVERYTHING. If a character "turns everything into a song," we hear the actual song.
2. SHOW, DON'T TELL. Never "she was brave" — show her doing the brave thing.
3. BANNED PHRASES. No "the most beautiful X she had ever seen", no "declared bravely", no "began to cry happy tears".
4. SPECIFIC DETAILS. Not "made up a funny rhyme" but THE ACTUAL RHYME.
5. DISTINCT VOICES. Every character sounds different.
6. UNEXPECTED MOMENTS. At least 2-3 moments that genuinely surprise.
7. EMOTIONAL TRUTH. One authentic moment beats ten generic descriptions.

STRUCTURE:
- Exactly ${pageCount} pages
- 1-3 sentences per page
- Each page = one illustratable moment
- Build tension properly. Don't solve problems instantly.
- The climax uses THIS character's specific traits, not generic determination.

${extraction.reader.readingLevel === "pre-reader" ? "LANGUAGE: Very simple sentences. Repetition is good. Rhyme and rhythm help. Max 15 words per page." : ""}
${extraction.reader.readingLevel === "early reader" ? "LANGUAGE: Short, clear sentences. 1-2 sentences per page." : ""}
${extraction.reader.readingLevel === "confident reader" ? "LANGUAGE: Richer vocabulary OK. 2-3 sentences per page." : ""}

JSON OUTPUT — no markdown, no preamble, ONLY this structure:
{
  "title": "A specific, intriguing title",
  "pages": [
    { "page": 1, "text": "..." }
  ],
  "styleGuide": {
    "summary": "Specific visual style description.",
    "negativePrompt": "What to avoid in illustrations"
  }
}`;

  let json: { title?: string; pages?: any[]; styleGuide?: any };
  try {
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
    if (!raw) throw new Error("Empty response from story generation model");

    if (raw.startsWith("```")) {
      raw = raw
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/, "")
        .replace(/\s*```$/, "");
    }

    json = JSON.parse(raw);
  } catch (err) {
    console.error("🔴 [create-from-chat] Story generation failed:", err);
    return NextResponse.json(
      {
        error: "Failed to generate story content",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }

  const { title, pages, styleGuide } = json;

  if (!title || !Array.isArray(pages) || pages.length === 0) {
    console.error("🔴 [create-from-chat] Story generation returned invalid structure:", json);
    return NextResponse.json(
      { error: "Story generation returned incomplete data" },
      { status: 500 }
    );
  }

  // ── Save story to DB ─────────────────────────────────────────────────────
  const storyId = uuid();
  console.log(`🔵 Saving story "${title}" — World: ${worldId}, Book #${bookNumber}`);

  try {
    await db.insert(stories).values({
      id: storyId,
      projectId,
      title: title || "Untitled Story",
      length: pageCount,
      fullDraft: JSON.stringify(json),
      status: "paged",
      readerId,
      worldId,
      bookNumber,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  } catch (err) {
    console.error("🔴 [create-from-chat] Story insert failed:", err);
    return NextResponse.json(
      {
        error: "Failed to save story",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }

  // ── Save pages ───────────────────────────────────────────────────────────
  try {
    await db.insert(storyPages).values(
      pages.map((p: any) => ({
        id: uuid(),
        storyId,
        pageNumber: Number(p.page),
        text: String(p.text || ""),
        illustrationPrompt: null,
        imageId: null,
        createdAt: new Date(),
      }))
    );
    console.log(`🔵 Saved ${pages.length} pages`);
  } catch (err) {
    console.error("🔴 [create-from-chat] Pages insert failed:", err);
    // Story exists but pages failed — return partial success so the user isn't left hanging
    return NextResponse.json(
      {
        error: "Story was created but pages failed to save. Please contact support.",
        storyId,
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }

  // ── Save product intent (non-fatal) ──────────────────────────────────────
  if (intent) {
    try {
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
    } catch (err) {
      console.warn("🟠 [create-from-chat] Product intent save failed (non-fatal):", err);
    }
  }

  // ── Save style guide (non-fatal) ─────────────────────────────────────────
  let styleGuideCreated = false;
  if (styleGuide) {
    try {
      await db.insert(storyStyleGuide).values({
        id: uuid(),
        storyId,
        summary: safeText(styleGuide.summary) ?? null,
        negativePrompt: safeText(styleGuide.negativePrompt) ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      styleGuideCreated = true;
    } catch (err) {
      console.warn("🟠 [create-from-chat] Style guide save failed (non-fatal):", err);
    }
  }

  // ── Save reader insights (non-fatal, fire-and-forget) ────────────────────
  saveReaderInsights(readerId, storyId, extraction.insights).catch((err) =>
    console.warn("🟠 [create-from-chat] Insight save failed (non-fatal):", err)
  );

  // ── PostHog event (non-fatal) ─────────────────────────────────────────────
  try {
    await captureServerEvent(userId, "story_created", {
      story_id: storyId,
      project_id: projectId,
      title,
      page_count: pages.length,
      reader_name: extraction.reader.childName,
      reader_age: readerAge,
      world_name: extraction.world.worldName,
      book_number: bookNumber,
      insights_count: extraction.insights.length,
      purchase_intent: intent || null,
    });
  } catch (err) {
    console.warn("🟠 [create-from-chat] PostHog event failed (non-fatal):", err);
  }

  console.log("🟢 [create-from-chat] Story creation complete!", {
    storyId,
    title,
    pages: pages.length,
    readerId,
    worldId,
    bookNumber,
  });

  return NextResponse.json({
    storyId,
    title,
    pagesCreated: pages.length,
    styleGuideCreated,
    readerId,
    worldId,
    worldName: extraction.world.worldName,
    bookNumber,
    readerName: extraction.reader.childName,
    insightsExtracted: extraction.insights.length,
  });
}