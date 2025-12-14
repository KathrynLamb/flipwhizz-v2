// src/app/api/stories/[id]/style/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { storyStyleGuide } from "@/db/schema";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: storyId } = await context.params;

    if (!storyId) {
      return NextResponse.json({ error: "Missing story id" }, { status: 400 });
    }

    const body = await request.json();
    const style = body?.style ?? {};

    const existing = await db
      .select()
      .from(storyStyleGuide)
      .where(eq(storyStyleGuide.storyId, storyId))
      .then((r) => r[0]);

    // Only include columns that actually exist on storyStyleGuide
    const update = {
      summary: style?.summary ?? null,
      userNotes: style?.userNotes ?? null,
      sampleIllustrationUrl: style?.sampleIllustrationUrl ?? null,
      // If your schema has negativePrompt, add it here; otherwise leave it out.
      // negativePrompt: style?.negativePrompt ?? null,
      updatedAt: new Date(),
    } as const;

    if (!existing) {
      await db.insert(storyStyleGuide).values({
        storyId,
        summary: style?.summary ?? null,
        userNotes: style?.userNotes ?? null,
        sampleIllustrationUrl: style?.sampleIllustrationUrl ?? null,
        // negativePrompt: style?.negativePrompt ?? null,
      });
    } else {
      await db
        .update(storyStyleGuide)
        .set(update)
        .where(eq(storyStyleGuide.storyId, storyId));
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[STYLE PATCH ERROR]", error);
    return NextResponse.json({ error: "Failed to save style" }, { status: 500 });
  }
}
