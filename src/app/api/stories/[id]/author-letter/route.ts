import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

/* ======================================================
   TYPES (MATCH UI EXACTLY)
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
   PROMPT BUILDERS
====================================================== */

export function buildAuthorLetterSystemPrompt() {
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
    .map(p => `Page ${p.pageNumber}: ${p.text}`)
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
    const { title, pages } = await req.json();

    console.log("author-letter input:", { title, pageCount: pages?.length });

    if (!title || !Array.isArray(pages) || pages.length === 0) {
      return NextResponse.json(
        { error: "Missing required data" },
        { status: 400 }
      );
    }

    const completion = await client.messages.create({
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
      .map(b => (b.type === "text" ? b.text : ""))
      .join("")
      .trim();

    // Strip ```json fences defensively
    const cleaned = rawText
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```$/i, "")
      .trim();

    let parsed: ClaudeResponse;

    try {
      parsed = JSON.parse(cleaned);
    } catch {
      console.error("❌ Invalid JSON from Claude:", rawText);
      return NextResponse.json(
        { error: "Invalid author letter payload", debug: rawText.slice(0, 200) },
        { status: 400 }
      );
    }

    // Validate Claude's response shape
    if (
      typeof parsed.letter !== "string" ||
      !Array.isArray(parsed.whatICenteredOn) ||
      !Array.isArray(parsed.thingsYouMightTweak) ||
      typeof parsed.invitation !== "string"
    ) {
      console.error("❌ Malformed response from Claude:", parsed);
      return NextResponse.json(
        { error: "Malformed author letter payload" },
        { status: 400 }
      );
    }

    // Transform to client-expected shape
    const response: AuthorLetterResponse = {
      opening: parsed.letter,
      intention: parsed.whatICenteredOn,
      optionalTweaks: parsed.thingsYouMightTweak,
      invitation: parsed.invitation,
    };

    console.log("✅ Author letter generated successfully");

    return NextResponse.json(response);
  } catch (err) {
    console.error("[author-letter]", err);
    return NextResponse.json(
      { error: "Failed to generate author letter" },
      { status: 500 }
    );
  }
}