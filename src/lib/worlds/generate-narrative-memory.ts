// generate-narrative-memory.ts
// Drop into: src/lib/worlds/generate-narrative-memory.ts
//
// Called by Inngest (or a post-completion hook) when a story belonging
// to a world is marked as complete. Generates the compressed memory
// that future books in the series will use.

import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/db";
import { worldNarrativeMemory } from "@/db/schema/worlds";
import { eq } from "drizzle-orm";

const anthropic = new Anthropic();

interface GenerateMemoryInput {
  worldId: string;
  storyId: string;
  bookNumber: number;
  storyTitle: string;
  storyText: string; // the full story text
  characterNames: string[]; // characters that appeared
}

interface NarrativeMemoryOutput {
  summary: string;
  characterDevelopments: Array<{
    characterId: string;
    development: string;
  }>;
  plotPoints: Array<{
    point: string;
    isOngoing: boolean;
  }>;
  callbacks: Array<{
    reference: string;
    context: string;
  }>;
  emotionalThemes: string[];
}

export async function generateNarrativeMemory(
  input: GenerateMemoryInput
): Promise<void> {
  const { worldId, storyId, bookNumber, storyTitle, storyText, characterNames } =
    input;

  const systemPrompt = `You are a children's book series continuity editor. Your job is to read a completed story and extract the essential details that future books in the series need to know.

Be concise but specific. The goal is to give a future story-writing AI everything it needs to maintain continuity without overwhelming it with detail.

Respond with ONLY valid JSON matching this schema:
{
  "summary": "2-3 sentence summary of what happened in this book",
  "characterDevelopments": [
    {
      "characterName": "character name",
      "development": "what this character learned, overcame, or how they changed"
    }
  ],
  "plotPoints": [
    {
      "point": "a significant plot event",
      "isOngoing": false // true if this is an unresolved thread for future books
    }
  ],
  "callbacks": [
    {
      "reference": "a memorable object, phrase, place, or event",
      "context": "why it's memorable and how a future book could reference it"
    }
  ],
  "emotionalThemes": ["theme1", "theme2"]
}`;

  const userPrompt = `Here is Book ${bookNumber} titled "${storyTitle}" from a children's book series.

Characters who appeared: ${characterNames.join(", ")}

Full story text:
${storyText}

Extract the narrative memory for this book. Focus on:
1. A clear, spoiler-friendly summary (parents will see this too)
2. How each character grew or changed
3. Plot points — mark as ongoing if they set up future adventures
4. Memorable callbacks — objects, phrases, or moments a child would love to see referenced again
5. The core emotional themes`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1500,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";

  let parsed: NarrativeMemoryOutput;
  try {
    // Strip markdown code fences if present
    const clean = text.replace(/```json\n?|```\n?/g, "").trim();
    parsed = JSON.parse(clean);
  } catch (err) {
    console.error("Failed to parse narrative memory response:", text);
    // Fall back to a basic summary
    parsed = {
      summary: `Book ${bookNumber}: "${storyTitle}" — details pending manual review.`,
      characterDevelopments: [],
      plotPoints: [],
      callbacks: [],
      emotionalThemes: [],
    };
  }

  // Upsert — in case this is re-run for the same book
  await db
    .insert(worldNarrativeMemory)
    .values({
      worldId,
      storyId,
      bookNumber,
      summary: parsed.summary,
      characterDevelopments: parsed.characterDevelopments,
      plotPoints: parsed.plotPoints,
      callbacks: parsed.callbacks,
      emotionalThemes: parsed.emotionalThemes,
    })
    .onConflictDoUpdate({
      target: [worldNarrativeMemory.worldId, worldNarrativeMemory.bookNumber],
      set: {
        summary: parsed.summary,
        characterDevelopments: parsed.characterDevelopments,
        plotPoints: parsed.plotPoints,
        callbacks: parsed.callbacks,
        emotionalThemes: parsed.emotionalThemes,
      },
    });
}