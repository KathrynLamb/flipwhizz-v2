// src/lib/admin/reExtract.ts
//
// Re-read a story's text and add any named character missing from the book.
// Characters already linked to this story are left alone; a character the
// owner already has (by name) is linked rather than duplicated.

import Anthropic from "@anthropic-ai/sdk";
import { v4 as uuid } from "uuid";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { stories, projects, characters, storyCharacters } from "@/db/schema";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

export async function reExtractCharacters(storyId: string): Promise<{ message: string; added: string[]; linked: string[] }> {
  const story = await db.query.stories.findFirst({ where: eq(stories.id, storyId) });
  if (!story) throw new Error("Story not found");
  if (!story.fullDraft) throw new Error("This story has no text to read yet");

  const project = await db.query.projects.findFirst({ where: eq(projects.id, story.projectId) });
  if (!project?.userId) throw new Error("This story's project has no owner");
  const userId = project.userId;

  const linkedRows = await db
    .select({ characterId: storyCharacters.characterId })
    .from(storyCharacters)
    .where(eq(storyCharacters.storyId, storyId));
  const linkedIds = new Set(linkedRows.map((r) => r.characterId));

  const allUserChars = await db.select({ id: characters.id, name: characters.name }).from(characters).where(eq(characters.userId, userId));
  const linkedNames = new Set(allUserChars.filter((c) => linkedIds.has(c.id)).map((c) => c.name.toLowerCase().trim()));

  let draftText = story.fullDraft;
  try {
    const parsed = JSON.parse(story.fullDraft);
    if (parsed.pages) draftText = parsed.pages.map((p: any) => `Page ${p.page}: ${p.text}`).join("\n\n");
  } catch {
    /* plain text draft */
  }

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4000,
    system: `You extract characters from children's stories. Return ONLY valid JSON, no markdown fences, no preamble.`,
    messages: [
      {
        role: "user",
        content: `Extract ALL named characters from this children's story. For each character, provide:

- name: their full name as used in the story
- description: 1-2 sentences about who they are and their role
- appearance: physical description if mentioned
- species: "human", "dog", "cat", "dinosaur", "bird", "rabbit", "horse", "fantasy", or "other"
- breed: specific breed/type if applicable
- role: "protagonist", "supporting", "minor", or "antagonist"
- personalityTraits: comma-separated personality traits

Characters ALREADY on this story (skip these): ${[...linkedNames].join(", ") || "none"}

IMPORTANT: Only skip the names listed above. Include ALL other named characters even if they might exist elsewhere.

STORY:
${draftText.slice(0, 8000)}

Return ONLY the JSON array.`,
      },
    ],
  });

  const text = response.content.find((b) => b.type === "text")?.text || "[]";
  const cleaned = text.replace(/```json\s*/g, "").replace(/```/g, "").trim();
  let extracted: any[];
  try {
    extracted = JSON.parse(cleaned);
  } catch {
    throw new Error("Couldn't read the character list Claude sent back. Try again.");
  }
  const fresh = (Array.isArray(extracted) ? extracted : []).filter((c) => c?.name && !linkedNames.has(String(c.name).toLowerCase().trim()));
  if (fresh.length === 0) return { message: "No missing characters found.", added: [], linked: [] };

  const added: string[] = [];
  const linked: string[] = [];
  for (const c of fresh) {
    const nameLower = String(c.name).toLowerCase().trim();
    const existing = allUserChars.find((ec) => ec.name.toLowerCase().trim() === nameLower);
    if (existing) {
      await db.insert(storyCharacters).values({ storyId, characterId: existing.id, role: c.role || "supporting" });
      linked.push(c.name);
    } else {
      const charId = uuid();
      await db.insert(characters).values({
        id: charId,
        userId,
        name: c.name,
        description: c.description || null,
        appearance: c.appearance || null,
        species: c.species || "human",
        breed: c.breed || null,
        personalityTraits: c.personalityTraits || null,
        locked: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      await db.insert(storyCharacters).values({ storyId, characterId: charId, role: c.role || "supporting" });
      added.push(c.name);
    }
  }
  const parts = [added.length ? `added ${added.join(", ")}` : null, linked.length ? `linked ${linked.join(", ")}` : null].filter(Boolean);
  return { message: `Re-extracted: ${parts.join("; ")}.`, added, linked };
}
