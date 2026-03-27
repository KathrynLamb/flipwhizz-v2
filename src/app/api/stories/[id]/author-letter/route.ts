import { NextResponse } from "next/server";
import { db } from "@/db";
import { stories } from "@/db/schema";
import { eq } from "drizzle-orm";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

/* ======================================================
   TYPES
====================================================== */

type AuthorLetterResponse = {
  opening: string;
  intention: string[];
  optionalTweaks: string[];
  invitation: string;
};

type ClaudeResponse = {
  letter: string;
  whatICenteredOn: string[];
  thingsYouMightTweak: string[];
  invitation: string;
};

/* ======================================================
   RETRY HELPER
====================================================== */

async function callClaudeWithRetry(
  params: {
    model: string;
    max_tokens: number;
    system?: string;
    messages: Array<{ role: string; content: string }>;
  },
  maxRetries: number = 3
): Promise<any> {
  let lastError: any;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await client.messages.create(params as any);
    } catch (err: any) {
      lastError = err;
      const status = err?.status;
      const shouldRetry =
        status === 529 || // overloaded
        status === 500 || // internal error
        status === 502 || // bad gateway
        status === 503;   // service unavailable

      if (!shouldRetry || attempt === maxRetries - 1) {
        throw err;
      }

      // Exponential backoff: 2s, 4s, 8s
      const delay = Math.pow(2, attempt + 1) * 1000;
      console.log(
        `⏳ Claude API ${status} — retrying in ${delay / 1000}s (attempt ${attempt + 1}/${maxRetries})`
      );
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  throw lastError;
}

/* ======================================================
   FALLBACK LETTER
====================================================== */

function generateFallbackLetter(title: string): AuthorLetterResponse {
  return {
    opening: `Here's your draft of "${title}". I've crafted each page to feel specific to your child — take a read through and see how it feels.`,
    intention: [
      "Built the story around the details you shared in our conversation",
      "Focused on showing character through action rather than description",
    ],
    optionalTweaks: [
      "If any character names or details need adjusting, those are easy changes",
      "Page pacing can be tweaked if any moment feels too rushed or too slow",
    ],
    invitation:
      "Have a read and let me know if it captures what you had in mind — happy to refine anything.",
  };
}

/* ======================================================
   PROMPT BUILDERS
====================================================== */

function buildAuthorLetterSystemPrompt() {
  return `
You are a professional children's book author delivering a FIRST DRAFT to a parent.

This is NOT an editorial critique.
This is a short, calm handover note.

TONE:
- Warm, confident, human
- Collaborative, never critical
- Assume the draft may be accepted as-is

STRICT RULES:
- Total response under 80 words
- No repetition
- No literary analysis
- No plot summary
- No marketing language
- No excessive praise

OUTPUT VALID JSON ONLY, EXACTLY THIS SHAPE:

{
  "letter": "1–2 short paragraphs reassuring the parent the draft works.",
  "whatICenteredOn": [
    "Max 2 bullets explaining deliberate writing choices."
  ],
  "thingsYouMightTweak": [
    "Max 2 very specific, optional, actionable tweaks."
  ],
  "invitation": "Single sentence inviting either acceptance or collaboration."
}

STYLE GUIDANCE:
- Plain language
- Concrete, not poetic
- Speak as a collaborator, not an AI
- The parent should feel comfortable proceeding without changes

OUTPUT JSON ONLY. No markdown. No explanation.
`;
}

function buildAuthorLetterMessage({
  title,
  pages,
}: {
  title: string;
  pages: { pageNumber: number; text: string }[];
}) {
  const excerpt = pages
    .slice(0, 6)
    .map((p) => `Page ${p.pageNumber}: ${p.text}`)
    .join("\n\n");

  return `
Story title:
${title}

Story excerpt:
${excerpt}
`;
}

/* ======================================================
   ROUTE
====================================================== */

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { title, pages, storyId } = body;

    console.log("author-letter input:", {
      title,
      pageCount: pages?.length,
      storyId,
    });

    if (!title || !Array.isArray(pages) || pages.length === 0) {
      return NextResponse.json(
        { error: "Missing required data" },
        { status: 400 }
      );
    }

    // 1. Check if author letter already exists in DB
    if (storyId) {
      const story = await db.query.stories.findFirst({
        where: eq(stories.id, storyId),
        columns: {
          id: true,
          authorLetter: true,
        },
      });

      if (story?.authorLetter) {
        console.log("📖 Returning cached author letter from database");
        return NextResponse.json(story.authorLetter);
      }
    }

    // 2. Generate new letter with retry
    console.log("✨ Generating new author letter...");

    let response: AuthorLetterResponse;

    try {
      const completion = await callClaudeWithRetry({
        model: "claude-sonnet-4-20250514",
        max_tokens: 800,
        system: buildAuthorLetterSystemPrompt(),
        messages: [
          {
            role: "user",
            content: buildAuthorLetterMessage({ title, pages }),
          },
        ],
      });

      const rawText = completion.content
        .map((b) => (b.type === "text" ? b.text : ""))
        .join("")
        .trim();

      const cleaned = rawText
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/```$/i, "")
        .trim();

      const parsed: ClaudeResponse = JSON.parse(cleaned);

      if (
        typeof parsed.letter !== "string" ||
        !Array.isArray(parsed.whatICenteredOn) ||
        !Array.isArray(parsed.thingsYouMightTweak) ||
        typeof parsed.invitation !== "string"
      ) {
        throw new Error("Malformed response shape");
      }

      response = {
        opening: parsed.letter,
        intention: parsed.whatICenteredOn,
        optionalTweaks: parsed.thingsYouMightTweak,
        invitation: parsed.invitation,
      };
    } catch (err: any) {
      console.warn(
        `⚠️ Author letter generation failed after retries: ${err?.status || err?.message}. Using fallback.`
      );
      response = generateFallbackLetter(title);
    }

    // 3. Save to database
    if (storyId) {
      try {
        await db
          .update(stories)
          .set({
            authorLetter: response,
            updatedAt: new Date(),
          })
          .where(eq(stories.id, storyId));
        console.log("💾 Saved author letter to database");
      } catch (dbErr) {
        console.warn("⚠️ Failed to save author letter to DB:", dbErr);
      }
    }

    console.log("✅ Author letter ready");
    return NextResponse.json(response);
  } catch (err) {
    console.error("[author-letter] Unexpected error:", err);

    // Even if everything fails, return a usable response
    const body = await req.json().catch(() => ({}));
    return NextResponse.json(
      generateFallbackLetter(body?.title || "your story")
    );
  }
}