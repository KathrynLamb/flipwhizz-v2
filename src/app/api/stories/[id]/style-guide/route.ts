// src/app/api/stories/[id]/style-guide/route.ts

import { NextResponse } from "next/server";
import { db } from "@/db";
import { storyStyleGuide } from "@/db/schema";
import { eq } from "drizzle-orm";

/* -------------------------------------------------------------------------- */
/*  Shared handler — accepts POST (client) and PATCH (legacy/other callers)   */
/* -------------------------------------------------------------------------- */

async function handleSave(req: Request, storyId: string) {
  try {
    const body = await req.json();

    // Only allow known schema columns through — never blind-spread unknown keys
    const {
      summary,
      artStyle,
      visualThemes,
      colorPalette,
      promptBase,        // stored as userNotes — user never sees this key name
      negativePrompt,
      sampleIllustrationUrl,
      locked,
      approved,
      feedback,
      userNotes,
    } = body;

    console.log("📝 Saving style guide for story:", storyId);

    /* ── Upsert: create row if it doesn't exist yet ── */
    const [existing] = await db
      .select({ id: storyStyleGuide.id })
      .from(storyStyleGuide)
      .where(eq(storyStyleGuide.storyId, storyId));

    if (!existing) {
      console.log("➕ Creating new style guide row");
      await db.insert(storyStyleGuide).values({
        storyId,
        summary: summary ?? "",
      });
    }

    /* ── Build update payload — only include defined fields ── */
    const update: Record<string, unknown> = { updatedAt: new Date() };

    if (summary !== undefined)               update.summary = summary;
    if (artStyle !== undefined)              update.artStyle = artStyle;
    if (visualThemes !== undefined)          update.visualThemes = visualThemes;
    if (colorPalette !== undefined)          update.colorPalette = colorPalette;
    if (negativePrompt !== undefined)        update.negativePrompt = negativePrompt;
    if (sampleIllustrationUrl !== undefined) update.sampleIllustrationUrl = sampleIllustrationUrl;
    if (approved !== undefined)              update.approved = approved;
    if (feedback !== undefined)              update.feedback = feedback;

    // 🔒 promptBase from client → stored in `userNotes` column
    // The column name "userNotes" doesn't hint at its real purpose
    if (promptBase !== undefined)            update.userNotes = promptBase;
    if (userNotes !== undefined)             update.userNotes = userNotes;

    await db
      .update(storyStyleGuide)
      .set(update)
      .where(eq(storyStyleGuide.storyId, storyId));

    console.log("✅ Style guide saved");
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("❌ [style-guide save]", err);
    return NextResponse.json(
      { error: err.message || "Failed to save style guide" },
      { status: 500 }
    );
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return handleSave(req, id);
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return handleSave(req, id);
}