// src/app/api/stories/[id]/extract-world/route.ts
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/db";
import {
  stories,
  storyPages,
  characters,
  storyCharacters,
  locations,
  storyLocations,
  projects,
  storyPageCharacters,
  storyPageLocations,
  storyStyleGuide, // ✅ use this (no stories.meta)
} from "@/db/schema";
import { eq, asc, inArray } from "drizzle-orm";
import { v4 as uuid } from "uuid";

export const runtime = "nodejs";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

const SYSTEM = `
You are FlipWhizz, a world and scene extractor for children's stories.

You are given a fully confirmed story, split into numbered pages.

Output ONLY valid JSON in this shape:

{
  "characters": [{ "name": "...", "description": "..." }],
  "locations": [{ "name": "...", "description": "..." }],
  "pagePresence": {
    "1": { "characters": ["Name"], "locations": ["Place"] }
  },
  "style": {
    "summary": "...",
    "negativePrompt": "...",
    "lighting": "...",
    "palette": "...",
    "render": "..."
  }
}

DEFINITIONS:
- A character/location is present if it should appear visually on that page.
- Presence may be implied by continuity even if not named.
- Locations persist until a scene change.

RULES:
- Page numbers must match exactly.
- Use exact character/location names from the characters/locations lists.
- Do not invent names.
- Output ONLY valid JSON.
- No markdown, no backticks, no commentary.
`;

// ✅ safely extract Claude text blocks (ignores thinking blocks)
function extractClaudeText(content: any): string {
  return (Array.isArray(content) ? content : [])
    .map((b) => (b?.type === "text" ? String(b.text ?? "") : ""))
    .filter((t) => t.trim().length > 0)
    .join("\n")
    .trim();
}

// ✅ strips ```json fences if Claude still returns them
function extractJson(raw: string): string {
  if (!raw) return raw;

  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) return fenced[1].trim();

  const first = raw.indexOf("{");
  const last = raw.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) {
    return raw.slice(first, last + 1).trim();
  }

  return raw.trim();
}

// ✅ LLM-driven repair (but still TS-safe content extraction)
async function repairJsonWithClaude(raw: string) {
  const completion = await client.messages.create({
    model: "claude-sonnet-4-5-20250929",
    system: `
Return ONLY valid JSON for this exact shape:
{
  "characters": [{ "name": "...", "description": "..." }],
  "locations": [{ "name": "...", "description": "..." }],
  "pagePresence": {
    "1": { "characters": ["Name"], "locations": ["Place"] }
  },
  "style": {
    "summary": "...",
    "negativePrompt": "...",
    "lighting": "...",
    "palette": "...",
    "render": "..."
  }
}

Rules:
- No markdown fences, no backticks, no commentary.
- Preserve meaning; just fix formatting/shape if needed.
`,
    max_tokens: 2000,
    messages: [
      {
        role: "user",
        content:
          "Fix this into valid JSON ONLY (no markdown):\n\n" + String(raw ?? ""),
      },
    ],
  });

  return extractClaudeText(completion.content);
}

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: storyId } = await context.params;
    if (!storyId) {
      return NextResponse.json({ error: "Missing story ID" }, { status: 400 });
    }

    await db
    .update(stories)
    .set({
      storyConfirmed: true,       // ✅ Marks the boolean as true
      status:  'extracting',     // ✅ Updates status to track progress
      updatedAt: new Date(),      // ✅ Keeps timestamps fresh
    })
    .where(eq(stories.id, storyId));

    // Load story
    const story = await db
      .select()
      .from(stories)
      .where(eq(stories.id, storyId))
      .then((r) => r[0]);

    if (!story) {
      return NextResponse.json({ error: "Story not found" }, { status: 404 });
    }

    // Load pages
    const pages = await db
      .select()
      .from(storyPages)
      .where(eq(storyPages.storyId, storyId))
      .orderBy(asc(storyPages.pageNumber));

    const storyText = pages.map((p) => `PAGE ${p.pageNumber}: ${p.text}`).join("\n");

    // Call Claude
    const completion = await client.messages.create({
      model: "claude-sonnet-4-5-20250929",
      system: SYSTEM,
      max_tokens: 3000,
      messages: [{ role: "user", content: `Extract world:\n\n${storyText}` }],
    });

    const raw = extractClaudeText(completion.content);
    if (!raw) {
      return NextResponse.json(
        { error: "Claude returned empty response" },
        { status: 500 }
      );
    }

    // Parse + repair fallback
    let json: any;
    try {
      json = JSON.parse(extractJson(raw));
    } catch {
      console.warn("[extract-world] initial parse failed, attempting repair");
      const repaired = await repairJsonWithClaude(raw);
      json = JSON.parse(extractJson(repaired));
    }

    const chars = Array.isArray(json.characters) ? json.characters : [];
    const locs = Array.isArray(json.locations) ? json.locations : [];
    const pagePresence = json.pagePresence ?? {};
    const style = json.style ?? {};

    // Save to DB
    await db.transaction(async (tx) => {
      const project = await tx
        .select()
        .from(projects)
        .where(eq(projects.id, story.projectId))
        .then((r) => r[0]);

      if (!project) throw new Error("Project not found");
      if (!project.userId) throw new Error("Project.userId is null");

      const userId = project.userId;

      // Map pageNumber -> pageId
      const pagesByNumber = new Map<number, string>();
      pages.forEach((p) => pagesByNumber.set(p.pageNumber, p.id));
      const pageIds = pages.map((p) => p.id);

      // Clear ONLY joins for this story/pages (scoped deletes ✅)
      await tx.delete(storyCharacters).where(eq(storyCharacters.storyId, storyId));
      await tx.delete(storyLocations).where(eq(storyLocations.storyId, storyId));

      if (pageIds.length) {
        await tx
          .delete(storyPageCharacters)
          .where(inArray(storyPageCharacters.pageId, pageIds));
        await tx
          .delete(storyPageLocations)
          .where(inArray(storyPageLocations.pageId, pageIds));
      }

      // Insert entities + story joins, and build name->id maps
      const characterByName = new Map<string, string>();
      const locationByName = new Map<string, string>();

      for (const c of chars) {
        const name = String(c?.name ?? "").trim();
        if (!name) continue;

        const characterId = uuid();
        await tx.insert(characters).values({
          id: characterId,
          userId,
          name,
          description: String(c?.description ?? "").trim(),
        });

        await tx.insert(storyCharacters).values({
          storyId,
          characterId,
        });

        characterByName.set(name, characterId);
      }

      for (const l of locs) {
        const name = String(l?.name ?? "").trim();
        if (!name) continue;

        const locationId = uuid();
        await tx.insert(locations).values({
          id: locationId,
          userId,
          name,
          description: String(l?.description ?? "").trim(),
        });

        await tx.insert(storyLocations).values({
          storyId,
          locationId,
        });

        locationByName.set(name, locationId);
      }

      // Page presence -> page join tables
      for (const [pageNumStr, presenceAny] of Object.entries(pagePresence)) {
        const pageNum = Number(pageNumStr);
        const pageId = pagesByNumber.get(pageNum);
        if (!pageId) continue;

        const presence = presenceAny as any;
        const presentChars: string[] = Array.isArray(presence?.characters)
          ? presence.characters
          : [];
        const presentLocs: string[] = Array.isArray(presence?.locations)
          ? presence.locations
          : [];

        for (const charName of presentChars) {
          const charId = characterByName.get(String(charName));
          if (!charId) continue;
          await tx.insert(storyPageCharacters).values({
            pageId,
            characterId: charId,
            source: "ai",
          });
        }

        for (const locName of presentLocs) {
          const locId = locationByName.get(String(locName));
          if (!locId) continue;
          await tx.insert(storyPageLocations).values({
            pageId,
            locationId: locId,
            source: "ai",
          });
        }
      }

      // Upsert style guide row (instead of stories.meta)
      const existingGuide = await tx
        .select()
        .from(storyStyleGuide)
        .where(eq(storyStyleGuide.storyId, storyId))
        .then((r) => r[0]);

      // ✅ Build a safe summary without mixing ?? and ||
      const derivedSummary = [
        style?.lighting ? `Lighting: ${style.lighting}` : "",
        style?.palette ? `Palette: ${style.palette}` : "",
        style?.render ? `Render: ${style.render}` : "",
      ]
        .filter(Boolean)
        .join("\n")
        .trim();

      const summary =
        (style?.summary ?? "").trim().length > 0
          ? String(style.summary).trim()
          : derivedSummary.length > 0
            ? derivedSummary
            : null;

            const negativePrompt =
            (style?.negativePrompt ?? "").trim().length > 0
              ? String(style.negativePrompt).trim()
              : null;
          
      if (!existingGuide) {
        await tx.insert(storyStyleGuide).values({
          storyId,
          summary,
          negativePrompt,
        });
      } else {
        await tx
          .update(storyStyleGuide)
          .set({ summary, negativePrompt, updatedAt: new Date() })
          .where(eq(storyStyleGuide.storyId, storyId));
      }

      // Bump story timestamp
      await tx
        .update(stories)
        .set({ 
          status: 'needs_style',
          updatedAt: new Date(),
         })
        .where(eq(stories.id, storyId));
    });

    return NextResponse.json({
      ok: true,
      characters: chars.length,
      locations: locs.length,
      pagePresence,
      style,
    });
  } catch (err) {
    console.error("extract-world error:", err);
    return NextResponse.json(
      { error: "World extraction failed", details: String(err) },
      { status: 500 }
    );
  }
}
