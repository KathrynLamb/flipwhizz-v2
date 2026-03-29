// app/api/stories/generate-cover-prompt/route.ts

import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/db";
import { stories } from "@/db/schema";
import { eq } from "drizzle-orm";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

/* -------------------------------------------------------------------------- */
/*                             CHARACTER/LOCATION BLOCK                       */
/* -------------------------------------------------------------------------- */

type WorldCharacter = {
  id: string;
  name: string;
  description?: string | null;
  appearance?: string | null;
  role?: string | null;
  outfits?: {
    outfitKey: string;
    outfitDescription: string;
    isDefault: boolean;
  }[];
};

type WorldLocation = {
  id: string;
  name: string;
  description?: string | null;
  significance?: string | null;
};

function buildWorldContext(
  chars: WorldCharacter[],
  locs: WorldLocation[]
): string {
  const lines: string[] = [];

  if (chars.length > 0) {
    lines.push("AVAILABLE CHARACTERS:");
    for (const c of chars) {
      lines.push(`- ${c.name} (${c.role ?? "character"}) [ID: ${c.id}]`);
      // Only include description for context, NOT appearance
      if (c.description) lines.push(`  Description: ${c.description}`);
    }
    lines.push("");
  }

  if (locs.length > 0) {
    lines.push("AVAILABLE LOCATIONS:");
    for (const l of locs) {
      lines.push(
        `- ${l.name}${l.significance ? ` (${l.significance})` : ""} [ID: ${l.id}]`
      );
      if (l.description) lines.push(`  ${l.description}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

/* -------------------------------------------------------------------------- */
/*                                SYSTEM PROMPTS                              */
/* -------------------------------------------------------------------------- */

function buildCoverPlanSystemPrompt(
  story: any,
  worldContext: string
) {
  return `
You are a book cover planning assistant.

You DO NOT generate image prompts. You DO NOT design typography.
You ONLY extract a STRUCTURED COVER PLAN.

This plan will be consumed by a separate image model that:
- Renders text directly into the image
- Obeys a strict wrap-around cover layout template
- Produces ONE image containing BACK + SPINE + FRONT
- Has VISUAL REFERENCE IMAGES for every character — it can see what they look like

STORY CONTEXT:
Title: ${story.title}
Story excerpt: ${story.fullDraft?.slice(0, 500) || "No story text provided"}

${worldContext}

YOUR TASK:
From the conversation history, extract a SINGLE, FINAL cover plan.

When the user refers to characters or locations by name, use the AVAILABLE CHARACTERS
and AVAILABLE LOCATIONS above to understand who/what they mean.

IMPORTANT: Include coverCharacterIds and coverLocationIds arrays with the EXACT IDs
of the characters and locations that should appear on the cover. These IDs are shown
in square brackets next to each character/location name above. Only include characters
and locations that were explicitly agreed upon in the conversation.

OUTPUT JSON ONLY. NO MARKDOWN. NO COMMENTS.

STRICT FORMAT:

{
  "format": "wrap-spread",

  "front": {
    "titleText": "exact title text to render",
    "authorText": "exact author credit text (optional)",
    "visualIntent": "SHORT scene description — who is doing what and where. Characters by NAME ONLY."
  },

  "spine": {
    "spineText": "text to appear on the spine (usually the title)"
  },

  "back": {
    "blurbText": "short back cover blurb (optional)",
    "dedicationText": "dedication text if requested (optional)",
    "visualIntent": "SHORT description of visual treatment on the BACK cover"
  },

  "coverCharacterIds": ["id-of-character-1", "id-of-character-2"],
  "coverLocationIds": ["id-of-location-1"],

  "constraints": {
    "noTextOutsideSafeZones": true
  },

  "reasoning": "brief explanation of choices (optional)"
}

CRITICAL RULES FOR visualIntent:
- Reference characters BY NAME ONLY — e.g. "Sophia and Katy standing by the river with Georgie and Bodi"
- DO NOT describe character appearances (hair colour, eye colour, skin tone, breed, fur colour, etc.)
- The image model has REFERENCE IMAGES for every character — it does not need text descriptions
- Text descriptions of appearance COMPETE with and OVERRIDE the visual references, causing wrong results
- Describe the SCENE, the ACTION, the MOOD — not what people look like
- Keep visualIntent under 40 words
- GOOD: "Sophia and Katy exploring the magical woods with Georgie and Bodi. River sprites dance above the water."
- BAD: "Sophia, a young girl with fair skin, dark blue-grey eyes, long light brown hair in pigtails..." (NEVER DO THIS)

OTHER RULES:
- Use ONLY information explicitly stated or clearly implied by the user
- Never invent names or text
- If author text is not specified, OMIT authorText
- If no back text was requested, OMIT blurbText and dedicationText
- coverCharacterIds MUST contain the IDs of ONLY the characters that should appear on the cover
- coverLocationIds MUST contain the IDs of ONLY the locations that should appear on the cover
- If no specific location was discussed, use an empty array for coverLocationIds

This JSON will be saved and LOCKED before image generation.
`.trim();
}

function buildChatGuidanceSystemPrompt(
  story: any,
  worldContext: string
) {
  return `
You are helping a parent quickly decide a children's book cover.

GOAL: Reach a final decision in 2–3 turns MAX.

${worldContext}

Use the character and location names above when suggesting cover ideas.
For example, suggest showing specific characters in specific locations.

ONLY ask about:
- What should be SEEN on the front cover (scene / character / symbolic)
- Author credit text (child, adult, both, or none)
- Whether anything should appear on the back (blurb / dedication / nothing)

DO NOT ask about:
- Fonts
- Colours
- Lighting
- Camera angles
- Typography styles
- Layout mechanics

If the user is vague, offer 2–3 concrete options using the actual character
and location names from this story.

When enough information is gathered:
- Respond naturally
- Clearly signal readiness

OUTPUT JSON ONLY:

{
  "message": "what you say to the user",
  "stage": "intro" | "exploring" | "ready",
  "summary": {
    "front": "one-line summary",
    "back": "one-line summary"
  }
}
`.trim();
}

/* -------------------------------------------------------------------------- */
/*                                   HANDLER                                  */
/* -------------------------------------------------------------------------- */

export async function POST(req: Request) {
  try {
    const {
      storyId,
      conversationHistory,
      mode,
      feedback,
      characters: chars,
      locations: locs,
      coverCharacterIds: clientCharIds,
      coverLocationIds: clientLocIds,
    } = await req.json();

    if (!storyId || !Array.isArray(conversationHistory)) {
      return NextResponse.json(
        { error: "storyId and conversationHistory are required" },
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
        { error: "Story not found" },
        { status: 404 }
      );
    }

    const worldContext = buildWorldContext(chars ?? [], locs ?? []);

    /* ----------------------------- FINALISE PLAN ---------------------------- */

    if (mode === "generate" || mode === "regenerate") {
      const userContent = mode === "regenerate"
        ? `Previous conversation:\n${JSON.stringify(conversationHistory)}\n\nUser feedback for regeneration: "${feedback ?? ""}"`
        : JSON.stringify(conversationHistory);

      const completion = await client.messages.create({
        model: "claude-sonnet-4-20250514",
        system: buildCoverPlanSystemPrompt(story, worldContext),
        max_tokens: 1200,
        messages: [{ role: "user", content: userContent }],
      });

      const raw =
        completion.content.find((b) => b.type === "text")?.text ?? "";

      let coverPlan: any;
      try {
        const match =
          raw.match(/```json\s*([\s\S]*?)\s*```/) ||
          raw.match(/\{[\s\S]*\}/);
        coverPlan = JSON.parse(match ? match[1] || match[0] : raw);
      } catch (err) {
        console.error("❌ Failed to parse cover plan:", raw);
        return NextResponse.json(
          { error: "Failed to parse cover plan" },
          { status: 500 }
        );
      }

      // Merge client-side IDs as fallback if Claude didn't include them
      if (!Array.isArray(coverPlan.coverCharacterIds) || coverPlan.coverCharacterIds.length === 0) {
        if (Array.isArray(clientCharIds) && clientCharIds.length > 0) {
          coverPlan.coverCharacterIds = clientCharIds;
          console.log("📌 Using client-provided coverCharacterIds:", clientCharIds);
        }
      } else {
        console.log("📌 Using Claude-extracted coverCharacterIds:", coverPlan.coverCharacterIds);
      }

      if (!Array.isArray(coverPlan.coverLocationIds) || coverPlan.coverLocationIds.length === 0) {
        if (Array.isArray(clientLocIds) && clientLocIds.length > 0) {
          coverPlan.coverLocationIds = clientLocIds;
          console.log("📌 Using client-provided coverLocationIds:", clientLocIds);
        }
      } else {
        console.log("📌 Using Claude-extracted coverLocationIds:", coverPlan.coverLocationIds);
      }

      console.log("📋 Final cover plan character IDs:", coverPlan.coverCharacterIds ?? []);
      console.log("📋 Final cover plan location IDs:", coverPlan.coverLocationIds ?? []);

      await db
        .update(stories)
        .set({
          coverPlan,
          coverPlanLocked: true,
          updatedAt: new Date(),
        })
        .where(eq(stories.id, storyId));

      return NextResponse.json({
        success: true,
        coverPlan,
      });
    }

    /* ------------------------------- CHAT MODE ------------------------------ */

    const lastMessage =
      conversationHistory[conversationHistory.length - 1];

    const completion = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      system: buildChatGuidanceSystemPrompt(story, worldContext),
      max_tokens: 600,
      messages: [
        {
          role: "user",
          content: `Conversation:\n${JSON.stringify(
            conversationHistory
          )}\n\nLatest message: "${lastMessage?.content ?? ""}"`,
        },
      ],
    });

    const raw =
      completion.content.find((b) => b.type === "text")?.text ?? "";

    let result: any;
    try {
      const match =
        raw.match(/```json\s*([\s\S]*?)\s*```/) ||
        raw.match(/\{[\s\S]*\}/);
      result = JSON.parse(match ? match[1] || match[0] : raw);
    } catch {
      result = {
        message: raw,
        stage: "exploring",
        summary: {},
      };
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error("Cover plan route error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}