// app/api/stories/[id]/trigger-spread-workflow/route.ts

import { NextResponse } from "next/server";
import { inngest } from "@/inngest/client";
import { db } from "@/db";
import { stories } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: storyId } = await params;

  try {
    // Check story exists
    const story = await db.query.stories.findFirst({
      where: eq(stories.id, storyId),
    });

    if (!story) {
      return NextResponse.json({ error: "Story not found" }, { status: 404 });
    }

    // 1. Build spreads
    console.log("🏗️ Triggering build-spreads...");
    await inngest.send({
      name: "story/build.spreads",
      data: { storyId },
    });

    // Wait a moment for spreads to be created
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 2. Decide scenes
    console.log("🎬 Triggering decide-spread-scenes...");
    await inngest.send({
      name: "story/decide-spread-scenes",
      data: { storyId },
    });

    return NextResponse.json({
      ok: true,
      message: "Spread workflow triggered. Check Inngest for progress.",
      steps: [
        "1. Building spreads...",
        "2. Deciding scenes...",
        "3. Ready for image generation",
      ],
    });
  } catch (error) {
    console.error("[trigger-spread-workflow] Error:", error);
    return NextResponse.json(
      { error: "Failed to trigger workflow", details: String(error) },
      { status: 500 }
    );
  }
}