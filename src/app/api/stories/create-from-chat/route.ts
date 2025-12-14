
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/db";
import {
  stories,
  storyPages,
  storyStyleGuide,
  chatSessions,
  chatMessages,
} from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { v4 as uuid } from "uuid";

// Check for API Key
if (!process.env.ANTHROPIC_API_KEY) {
  throw new Error("Missing ANTHROPIC_API_KEY environment variable");
}

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const DEFAULT_PAGE_COUNT = 28;

export async function POST(req: Request) {
  console.log("🟢 API: Received story creation request");
  try {
    const { projectId, pageCount = DEFAULT_PAGE_COUNT } = await req.json();

    if (!projectId) {
      console.error("🔴 API: Missing projectId");
      return NextResponse.json({ error: "Missing projectId" }, { status: 400 });
    }

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

    console.log(`🔵 API: Generating story with ${claudeHistory.length} history messages...`);

    // 2. Claude SYSTEM PROMPT
// Replace your SYSTEM constant with this:

const SYSTEM = `You are FlipWhizz — a children's story generator that creates SPECIFIC, VOICE-DRIVEN stories, not generic AI content.

You've just had a conversation with the user about their story. Use EVERYTHING they told you about the characters, setting, tone, and personality. This story should feel like it could ONLY be about this specific child, not any child.

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

    // 3. Claude request
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

    // === FIX START: CLEAN UP MARKDOWN ===
    // If Claude wraps the response in ```json ... ```, strip it.
    if (raw.startsWith("```")) {
      raw = raw.replace(/^```json\s*/, "").replace(/^```\s*/, "").replace(/\s*```$/, "");
    }
    // === FIX END ===

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

    // 4. Create Story
    const storyId = uuid();
    console.log(`🔵 API: Creating story ${storyId} ("${title}")`);

    await db.insert(stories).values({
      id: storyId,
      projectId,
      title: title || "Untitled Story",
      length: pageCount,
      fullDraft: raw, // Saving raw JSON just in case
      status: "paged",
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

    // 6. Create Style Guide (Safe Mode)
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
      console.warn("🟠 API: Warning - Could not save style guide (Table might be missing):", sgError);
    }

    console.log("🟢 API: Success!");
    return NextResponse.json({
      storyId,
      title,
      pagesCreated: pages?.length || 0,
      styleGuideCreated,
    });

  } catch (err: any) {
    console.error("🔴 API: Critical Error:", err);
    return NextResponse.json(
      { error: "Story creation failed", details: err.message || String(err) },
      { status: 500 }
    );
  }
}