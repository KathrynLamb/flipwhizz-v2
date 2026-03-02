// app/api/stories/[id]/generate-spread/route.ts

import { NextRequest, NextResponse } from "next/server";
import { inngest } from "@/inngest/client";
import { db } from "@/db";
import { storyPages, storyStyleGuide } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: storyId } = await params;
  const body = await req.json();
  const { leftPageId, rightPageId, pageLabel, feedback } = body;

  if (!leftPageId || !pageLabel) {
    return NextResponse.json(
      { error: "leftPageId and pageLabel are required" },
      { status: 400 }
    );
  }

  // ── Check style guide status so client can warn user ──────────────────
  const styleRows = await db
    .select({
      approved:               storyStyleGuide.approved,
      hasSampleImage:         storyStyleGuide.sampleIllustrationUrl,
      hasPromptBase:          storyStyleGuide.userNotes,
    })
    .from(storyStyleGuide)
    .where(eq(storyStyleGuide.storyId, storyId))
    .limit(1);

  const style = styleRows[0];
  const styleWarning =
    !style                    ? "no_style_guide" :
    !style.approved           ? "style_not_locked" :
    !style.hasSampleImage     ? "no_reference_image" :
    null;

  // ── Clear existing imageUrl so poll reports "generating" not old image ─
  await db
    .update(storyPages)
    .set({ imageUrl: null })
    .where(eq(storyPages.id, leftPageId));

  // ── Fire Inngest — fields match GenerateSingleSpreadEventSchema exactly ─
  await inngest.send({
    name: "story/generate.single.spread",
    data: {
      storyId,
      leftPageId,
      rightPageId: rightPageId ?? null,
      pageLabel,
      feedback: feedback ?? undefined,
    },
  });

  const jobId = `${leftPageId}__${storyId}`;

  return NextResponse.json({
    jobId,
    // null = fully ready, otherwise a hint string for the UI
    styleWarning,
  });
}