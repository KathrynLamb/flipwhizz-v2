// src/app/api/admin/re-extract-characters/route.ts
//
// ONE-SHOT: POST { storyId } to re-extract missing characters.
// Only skips characters already LINKED to this story.
// Characters that exist for the user but aren't linked get linked.
// Truly new characters get created.
// DELETE THIS FILE after use.

import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/db";
import { stories, projects, characters, storyCharacters } from "@/db/schema";
import { eq } from "drizzle-orm";
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

    // Get characters LINKED TO THIS STORY (not all user characters)
    const linkedRows = await db
      .select({ characterId: storyCharacters.characterId })
      .from(storyCharacters)
      .where(eq(storyCharacters.storyId, storyId));

    const linkedIds = new Set(linkedRows.map(r => r.characterId));

    // Get the names of linked characters
    const linkedChars = linkedIds.size > 0
      ? await db.select({ id: characters.id, name: characters.name }).from(characters).where(eq(characters.userId, userId))
          .then(all => all.filter(c => linkedIds.has(c.id)))
      : [];

    const linkedNames = new Set(linkedChars.map(c => c.name.toLowerCase().trim()));

    // Get ALL user characters (for matching existing unlinked ones)
    const allUserChars = await db
      .select({ id: characters.id, name: characters.name })
      .from(characters)
      .where(eq(characters.userId, userId));

    // Parse the draft
    let draftText = story.fullDraft;
    try {
      const parsed = JSON.parse(story.fullDraft);
      if (parsed.pages) {
        draftText = parsed.pages.map((p: any) => `Page ${p.page}: ${p.text}`).join("\n\n");
      }
    } catch {}

    // Ask Claude to extract characters — only skip those linked to THIS story
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4000,
      system: `You extract characters from children's stories. Return ONLY valid JSON, no markdown fences, no preamble.`,
      messages: [{
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
      return NextResponse.json({
        message: "No new characters found",
        linkedToStory: [...linkedNames],
      });
    }

    // Filter out any that are already linked
    const newChars = extracted.filter(c =>
      c.name && !linkedNames.has(c.name.toLowerCase().trim())
    );

    if (newChars.length === 0) {
      return NextResponse.json({
        message: "All extracted characters are already linked to this story",
        linkedToStory: [...linkedNames],
        extracted: extracted.map(c => c.name),
      });
    }

    // Process each character
    const results: any[] = [];

    for (const c of newChars) {
      const nameLower = c.name.toLowerCase().trim();

      // Check if character exists for this user (but isn't linked to this story)
      const existingChar = allUserChars.find(
        ec => ec.name.toLowerCase().trim() === nameLower
      );

      if (existingChar) {
        // Link existing character to this story
        await db.insert(storyCharacters).values({
          storyId,
          characterId: existingChar.id,
          role: c.role || "supporting",
        });
        results.push({ name: c.name, id: existingChar.id, action: "linked_existing" });
      } else {
        // Create new character + link
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

        await db.insert(storyCharacters).values({
          storyId,
          characterId: charId,
          role: c.role || "supporting",
        });

        results.push({ name: c.name, id: charId, action: "created_new", species: c.species, breed: c.breed });
      }
    }

    return NextResponse.json({
      success: true,
      storyId,
      alreadyLinked: [...linkedNames],
      results,
      totalExtracted: extracted.length,
      totalProcessed: results.length,
      linked: results.filter(r => r.action === "linked_existing").length,
      created: results.filter(r => r.action === "created_new").length,
    });
  } catch (err: any) {
    console.error("[Re-extract characters] error:", err);
    return NextResponse.json({ error: err?.message || "Failed" }, { status: 500 });
  }
}