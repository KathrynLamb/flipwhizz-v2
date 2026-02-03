// src/app/api/stories/[id]/style/save/route.ts
import { NextResponse } from "next/server";
import { db } from "@/db";
import { stories, storyStyleGuide, styleGuideImages } from "@/db/schema";
import { eq } from "drizzle-orm";
import { v4 as uuid } from "uuid";

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id: storyId } = await context.params;
  const body = await req.json();

  const summary = typeof body.summary === "string" ? body.summary : "";
  const negativePrompt = typeof body.negativePrompt === "string" ? body.negativePrompt : "";
  const styleReferenceUrl = typeof body.styleReferenceUrl === "string" ? body.styleReferenceUrl : null;
  const sampleIllustrationUrl = typeof body.sampleIllustrationUrl === "string" ? body.sampleIllustrationUrl : null;

  const story = await db.query.stories.findFirst({
    where: eq(stories.id, storyId),
    columns: { id: true },
  });
  if (!story) return NextResponse.json({ error: "Story not found" }, { status: 404 });

  const guide = await db.query.storyStyleGuide.findFirst({
    where: eq(storyStyleGuide.storyId, storyId),
    columns: { id: true },
  });

  const guideId = guide?.id ?? uuid();

  await db
    .insert(storyStyleGuide)
    .values({
      id: guideId,
      storyId,
      summary,
      negativePrompt,
      sampleIllustrationUrl,
      updatedAt: new Date(),
      createdAt: new Date(),
    } as any)
    .onConflictDoUpdate({
      target: storyStyleGuide.storyId,
      set: {
        summary,
        negativePrompt,
        sampleIllustrationUrl,
        updatedAt: new Date(),
      },
    });

  // Maintain style reference image row (type="style")
  if (styleReferenceUrl) {
    // naive: insert new style image record each time; if you want a single record, we can upsert by (styleGuideId,type)
    await db.insert(styleGuideImages).values({
      id: uuid(),
      styleGuideId: guideId,
      url: styleReferenceUrl,
      type: "style",
      label: "style reference",
      createdAt: new Date(),
    } as any);
  }

  return NextResponse.json({ ok: true });
}
