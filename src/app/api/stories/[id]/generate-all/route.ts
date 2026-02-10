// src/app/api/stories/[id]/generate-all/route.ts
import { NextResponse } from "next/server";
import { inngest } from "@/inngest/client";
import { db } from "@/db";
import { stories } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: storyId } = await context.params;

    console.log("🚀 Starting illustration generation for story:", storyId);

    // Verify story exists
    const [story] = await db
      .select()
      .from(stories)
      .where(eq(stories.id, storyId));

    if (!story) {
      return NextResponse.json({ error: "Story not found" }, { status: 404 });
    }

    // Update story status
    await db
      .update(stories)
      .set({
        status: "generating",
        updatedAt: new Date(),
      })
      .where(eq(stories.id, storyId));

    // Trigger Inngest function to generate all spreads
    await inngest.send({
      name: "story/generate-spreads",
      data: {
        storyId,
      },
    });

    console.log("✅ Generation job queued successfully");

    return NextResponse.json({
      success: true,
      message: "Generation started",
    });

  } catch (err: any) {
    console.error("❌ [generate-all]", err);
    return NextResponse.json(
      { error: err.message || "Failed to start generation" },
      { status: 500 }
    );
  }
}