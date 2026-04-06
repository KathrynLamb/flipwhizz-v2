import { NextResponse } from "next/server";
import { inngest } from "@/inngest/client";
import { db } from "@/db";
import { stories } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: storyId } = await context.params;

    console.log("🚀 Starting illustration generation for story:", storyId);

    const [story] = await db
      .select()
      .from(stories)
      .where(eq(stories.id, storyId));

    if (!story) {
      return NextResponse.json({ error: "Story not found" }, { status: 404 });
    }

    await db
      .update(stories)
      .set({
        status: "generating",
        updatedAt: new Date(),
      })
      .where(eq(stories.id, storyId));

    await inngest.send({
      name: "story/generate-spreads",
      data: { storyId },
    });

    console.log("✅ Generation job queued successfully");

    return NextResponse.json({
      success: true,
      storyId,
      status: "generating",
      message: "Generation queued. Overcrowded spreads will be skipped and can be focused in the studio.",
    });
  } catch (err: any) {
    console.error("❌ [generate-all]", err);

    return NextResponse.json(
      { error: err?.message || "Failed to start generation" },
      { status: 500 }
    );
  }
}