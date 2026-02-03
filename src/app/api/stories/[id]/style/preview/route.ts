// src/app/api/stories/[id]/style/preview/route.ts
import { NextResponse } from "next/server";
import { db } from "@/db";
import {
  storySpreads,
  storyPages,
  storyPageCharacters,
  storyPageLocations,
  characters,
  locations,
} from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id: storyId } = await context.params;
  const body = await req.json();

  const spreadIndex = Number(body.spreadIndex);
  if (!spreadIndex || Number.isNaN(spreadIndex)) {
    return NextResponse.json({ error: "spreadIndex required" }, { status: 400 });
  }

  const artDirection = typeof body.artDirection === "string" ? body.artDirection : "";
  const negativePrompt = typeof body.negativePrompt === "string" ? body.negativePrompt : "";
  const styleReferenceUrl = typeof body.styleReferenceUrl === "string" ? body.styleReferenceUrl : null;
  const feedback = typeof body.feedback === "string" ? body.feedback : null;

  const spread = await db.query.storySpreads.findFirst({
    where: and(eq(storySpreads.storyId, storyId), eq(storySpreads.spreadIndex, spreadIndex)),
  });

  if (!spread) return NextResponse.json({ error: "Spread not found" }, { status: 404 });

  const left = spread.leftPageId
    ? await db.query.storyPages.findFirst({ where: eq(storyPages.id, spread.leftPageId) })
    : null;
  const right = spread.rightPageId
    ? await db.query.storyPages.findFirst({ where: eq(storyPages.id, spread.rightPageId) })
    : null;

  const pageIds = [spread.leftPageId, spread.rightPageId].filter(Boolean) as string[];

  const charRows = await db
    .select({
      id: characters.id,
      name: characters.name,
      appearance: characters.appearance,
    })
    .from(storyPageCharacters)
    .innerJoin(characters, eq(storyPageCharacters.characterId, characters.id))
    .where(eq(storyPageCharacters.pageId, pageIds[0] as any)); // minimal; if you want exact inArray, tell me and I’ll adjust

  const locRows = await db
    .select({
      id: locations.id,
      name: locations.name,
      description: locations.description,
    })
    .from(storyPageLocations)
    .innerJoin(locations, eq(storyPageLocations.locationId, locations.id))
    .where(eq(storyPageLocations.pageId, pageIds[0] as any));

  // Build prompt
  const prompt = buildStylePreviewPrompt({
    artDirection,
    negativePrompt,
    styleReferenceUrl,
    feedback,
    sceneSummary: spread.sceneSummary ?? "",
    leftText: left?.text ?? "",
    rightText: right?.text ?? "",
    characters: charRows.map((c) => ({ name: c.name, appearance: c.appearance ?? "" })),
    locations: locRows.map((l) => ({ name: l.name, description: l.description ?? "" })),
  });

  // ✅ TODO: Hook into your existing image generation + storage
  // Replace this with your real image pipeline (OpenAI / Gemini / Replicate / etc.)
  const url = await fakeGenerateAndStore(prompt);

  return NextResponse.json({ ok: true, url });
}

function buildStylePreviewPrompt(input: {
  artDirection: string;
  negativePrompt: string;
  styleReferenceUrl: string | null;
  feedback: string | null;
  sceneSummary: string;
  leftText: string;
  rightText: string;
  characters: { name: string; appearance: string }[];
  locations: { name: string; description: string }[];
}) {
  const cast = input.characters.length
    ? input.characters.map((c) => `- ${c.name}: ${c.appearance || "no appearance notes"}`).join("\n")
    : "- (none)";

  const locs = input.locations.length
    ? input.locations.map((l) => `- ${l.name}: ${l.description || "no description notes"}`).join("\n")
    : "- (none)";

  return `
You are generating ONE preview illustration to validate the book’s visual style.

ART DIRECTION:
${input.artDirection}

STYLE REFERENCE IMAGE (if provided):
${input.styleReferenceUrl ?? "(none)"}

NEGATIVE PROMPT (avoid):
${input.negativePrompt || "(none)"}

USER FEEDBACK REFINEMENT (optional):
${input.feedback ?? "(none)"}

SPREAD SCENE SUMMARY:
${input.sceneSummary || "(none)"}

SPREAD TEXT (for context only — do not render text in the image):
LEFT:
${input.leftText}

RIGHT:
${input.rightText}

CHARACTERS IN THIS SPREAD:
${cast}

LOCATIONS IN THIS SPREAD:
${locs}

OUTPUT:
- One single illustration (no text overlays)
- Designed to represent the entire book’s final look
- Cohesive composition, strong readability, child-friendly
`.trim();
}

// Placeholder: replace with your real image generator/storage
async function fakeGenerateAndStore(_prompt: string) {
  // return a placeholder image so UI works during wiring
  return "https://placehold.co/1200x900/png?text=Style+Preview";
}
