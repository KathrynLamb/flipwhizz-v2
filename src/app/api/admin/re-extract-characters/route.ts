// src/app/api/admin/re-extract-characters/route.ts
//
// ONE-SHOT utility: POST { storyId } to re-extract characters from fullDraft.
// Skips characters that already exist (by name match).
// DELETE THIS FILE after use.

import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/db";
import { stories, projects, characters, storyCharacters } from "@/db/schema";
import { eq, and, ilike } from "drizzle-orm";
import { v4 as uuid } from "uuid";

export const dynamic = "force-dynamic";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

export async function POST(req: Request) {
  try {
    const { storyId } = await req.json();
    if (!storyId) return NextResponse.json({ error: "storyId required" }, { status: 400 });

    // Load story + project for userId
    const story = await db.query.stories.findFirst({ where: eq(stories.id, storyId) });
    if (!story) return NextResponse.json({ error: "Story not found" }, { status: 404 });
    if (!story.fullDraft) return NextResponse.json({ error: "No fullDraft on story" }, { status: 400 });

    const project = await db.query.projects.findFirst({ where: eq(projects.id, story.projectId) });
    if (!project?.userId) return NextResponse.json({ error: "No userId on project" }, { status: 400 });

    const userId = project.userId;

    // Get existing characters for this story
    const existingLinks = await db
      .select({ characterId: storyCharacters.characterId })
      .from(storyCharacters)
      .where(eq(storyCharacters.storyId, storyId));

    const existingChars = existingLinks.length > 0
      ? await db
          .select({ id: characters.id, name: characters.name })
          .from(characters)
          .where(eq(characters.userId, userId))
      : [];

    const existingNames = new Set(existingChars.map(c => c.name.toLowerCase().trim()));
    const linkedIds = new Set(existingLinks.map(l => l.characterId));

    // Parse the draft
    let draftText = story.fullDraft;
    try {
      const parsed = JSON.parse(story.fullDraft);
      if (parsed.pages) {
        draftText = parsed.pages.map((p: any) => `Page ${p.page}: ${p.text}`).join("\n\n");
      }
    } catch {
      // Already plain text
    }

    // Ask Claude to extract characters
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4000,
      system: `You extract characters from children's stories. Return ONLY valid JSON, no markdown fences, no preamble.`,
      messages: [{
        role: "user",
        content: `Extract ALL named characters from this children's story. For each character, provide:

- name: their full name as used in the story
- description: 1-2 sentences about who they are and their role
- appearance: physical description if mentioned (hair, clothing, distinguishing features)
- species: "human", "dog", "cat", "dinosaur", "bird", "rabbit", "horse", "fantasy", or "other"
- breed: specific breed/type if applicable (e.g. "Triceratops", "Stegosaurus", "Golden Retriever")
- role: "protagonist", "supporting", "minor", or "antagonist"
- personalityTraits: comma-separated personality traits

Characters that already exist (DO NOT include these): ${[...existingNames].join(", ") || "none"}

Return a JSON array of objects. Include EVERY named character that is NOT in the existing list above.

STORY:
${draftText.slice(0, 8000)}

Return ONLY the JSON array. No explanation, no markdown.`,
      }],
    });

    const text = response.content.find(b => b.type === "text")?.text || "[]";
    const cleaned = text.replace(/```json\s*/g, "").replace(/```/g, "").trim();
    
    let extracted: any[];
    try {
      extracted = JSON.parse(cleaned);
    } catch {
      return NextResponse.json({ error: "Failed to parse Claude response", raw: cleaned }, { status: 500 });
    }

    if (!Array.isArray(extracted) || extracted.length === 0) {
      return NextResponse.json({ message: "No new characters found", existing: [...existingNames] });
    }

    // Filter out any that somehow match existing names
    const newChars = extracted.filter(c => 
      c.name && !existingNames.has(c.name.toLowerCase().trim())
    );

    if (newChars.length === 0) {
      return NextResponse.json({ message: "All characters already exist", existing: [...existingNames] });
    }

    // Insert characters + link to story
    const inserted: any[] = [];

    for (const c of newChars) {
      // Check if character exists for this user but isn't linked to story
      const existingChar = existingChars.find(
        ec => ec.name.toLowerCase().trim() === c.name.toLowerCase().trim()
      );

      let charId: string;

      if (existingChar && !linkedIds.has(existingChar.id)) {
        // Character exists but not linked — just link it
        charId = existingChar.id;
        await db.insert(storyCharacters).values({
          storyId,
          characterId: charId,
          role: c.role || "supporting",
        });
        inserted.push({ name: c.name, id: charId, action: "linked" });
      } else if (!existingChar) {
        // Brand new character
        charId = uuid();
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

        await db.insert(storyCharacters).values({
          storyId,
          characterId: charId,
          role: c.role || "supporting",
        });

        inserted.push({ name: c.name, id: charId, action: "created", species: c.species, breed: c.breed });
      }
    }

    return NextResponse.json({
      success: true,
      storyId,
      existingCharacters: [...existingNames],
      newCharacters: inserted,
      totalExtracted: extracted.length,
      totalInserted: inserted.length,
    });
  } catch (err: any) {
    console.error("[Re-extract characters] error:", err);
    return NextResponse.json({ error: err?.message || "Failed" }, { status: 500 });
  }
}