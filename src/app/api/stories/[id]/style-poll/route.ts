import { NextResponse } from "next/server";
import { db } from "@/db";
import { stories, storyStyleGuide } from "@/db/schema";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id: storyId } = await ctx.params;

  if (!storyId) {
    return NextResponse.json(
      { error: "Missing storyId" },
      { status: 400 }
    );
  }

  const story = await db.query.stories.findFirst({
    where: eq(stories.id, storyId),
  });

  if (!story) {
    return NextResponse.json(
      { error: "Story not found" },
      { status: 404 }
    );
  }

  const style = await db.query.storyStyleGuide.findFirst({
    where: eq(storyStyleGuide.storyId, storyId),
  });

  return NextResponse.json({
    status: story.status,
    ready: Boolean(style?.sampleIllustrationUrl),
    sampleUrl: style?.sampleIllustrationUrl ?? null,
    style: style
      ? {
          summary: style.summary,
          negativePrompt: style.negativePrompt,
          updatedAt: style.updatedAt,
        }
      : null,
  });
  
}
