// src/app/api/projects/[projectId]/split/route.ts
import { NextRequest, NextResponse } from "next/server";
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
  storyStyleGuide,
} from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { v4 as uuid } from "uuid";

export const runtime = "nodejs";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

const SYSTEM = `
You are FlipWhizz, a world extractor for children's stories.

Output ONLY valid JSON:

{
  "characters": [{ "name": "...", "description": "..." }],
  "locations": [{ "name": "...", "description": "..." }],
  "style": {
    "summary": "...",
    "lighting": "...",
    "palette": "...",
    "render": "...",
    "negativePrompt": "..."
  }
}

Rules:
- No markdown
- No backticks
- No commentary
`;

function extractClaudeText(content: any[]): string {
  return (content ?? [])
    .map((b) => (b?.type === "text" ? String(b.text ?? "") : ""))
    .filter((t) => t.trim().length > 0)
    .join("\n")
    .trim();
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await context.params;

    if (!projectId) {
      return NextResponse.json({ error: "Missing projectId" }, { status: 400 });
    }

    const project = await db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId))
      .then((r) => r[0]);

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const userId = project.userId;
    if (!userId) {
      return NextResponse.json(
        { error: "Project.userId is null — cannot split" },
        { status: 400 }
      );
    }

    // If you have multiple stories per project, pick the right one here.
    const story = await db
      .select()
      .from(stories)
      .where(eq(stories.projectId, projectId))
      .then((r) => r[0]);

    if (!story) {
      return NextResponse.json({ error: "Story not found" }, { status: 404 });
    }

    const pages = await db
      .select()
      .from(storyPages)
      .where(eq(storyPages.storyId, story.id))
      .orderBy(asc(storyPages.pageNumber));

    const storyText = pages.map((p) => `PAGE ${p.pageNumber}: ${p.text}`).join("\n");

    const completion = await client.messages.create({
      model: "claude-sonnet-4-5-20250929",
      system: SYSTEM,
      max_tokens: 3000,
      messages: [
        {
          role: "user",
          content: `Extract world from this story:\n\n${storyText}\n\nReturn ONLY JSON.`,
        },
      ],
    });

    const raw = extractClaudeText(completion.content as any[]);
    if (!raw) {
      return NextResponse.json(
        { error: "Claude returned empty response" },
        { status: 500 }
      );
    }

    let json: any;
    try {
      json = JSON.parse(raw);
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON returned", raw },
        { status: 500 }
      );
    }

    const chars = Array.isArray(json.characters) ? json.characters : [];
    const locs = Array.isArray(json.locations) ? json.locations : [];
    const style = json.style ?? {};

    await db.transaction(async (tx) => {
      // TESTING: clear old joins for THIS story
      await tx.delete(storyCharacters).where(eq(storyCharacters.storyId, story.id));
      await tx.delete(storyLocations).where(eq(storyLocations.storyId, story.id));

      // Characters
      for (const c of chars) {
        const name = String(c?.name ?? "").trim();
        if (!name) continue;

        const description = String(c?.description ?? "").trim();
        const characterId = uuid();

        await tx.insert(characters).values({
          id: characterId,
          userId,
          name,
          description,
        });

        // join table has no id column
        await tx.insert(storyCharacters).values({
          storyId: story.id,
          characterId,
        });
      }

      // Locations
      for (const l of locs) {
        const name = String(l?.name ?? "").trim();
        if (!name) continue;

        const description = String(l?.description ?? "").trim();
        const locationId = uuid();

        await tx.insert(locations).values({
          id: locationId,
          userId,
          name,
          description,
        });

        // join table has no id column
        await tx.insert(storyLocations).values({
          storyId: story.id,
          locationId,
        });
      }

      // Upsert storyStyleGuide (no stories.meta)
      const existingGuide = await tx
        .select()
        .from(storyStyleGuide)
        .where(eq(storyStyleGuide.storyId, story.id))
        .then((r) => r[0]);

      if (!existingGuide) {
        await tx.insert(storyStyleGuide).values({
          storyId: story.id,
          summary: style?.summary ?? null,
          negativePrompt: style?.negativePrompt ?? null,
        });
      } else {
        await tx
          .update(storyStyleGuide)
          .set({
            summary: style?.summary ?? null,
            negativePrompt: style?.negativePrompt ?? null,
            updatedAt: new Date(),
          })
          .where(eq(storyStyleGuide.storyId, story.id));
      }

      // bump timestamp only
      await tx
        .update(stories)
        .set({ updatedAt: new Date() })
        .where(eq(stories.id, story.id));
    });

    return NextResponse.json({
      ok: true,
      characters: chars.length,
      locations: locs.length,
      style,
    });
  } catch (err) {
    console.error("[project split error]", err);
    return NextResponse.json(
      { error: "Split failed", details: String(err) },
      { status: 500 }
    );
  }
}
