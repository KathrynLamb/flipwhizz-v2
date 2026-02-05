// src/app/api/stories/[id]/ensure-world/route.ts
import { NextResponse } from "next/server";
import { db } from "@/db";
import { stories } from "@/db/schema";
import { eq } from "drizzle-orm";
import { inngest } from "@/inngest/client";

/**
 * POST /api/stories/[id]/ensure-world
 * 
 * Triggers the world-building orchestrator for a story.
 * This is idempotent and resumable - it will pick up where it left off.
 * 
 * Use cases:
 * - Auto-triggered after story generation
 * - Manual retry if world extraction failed
 * - User clicks "regenerate world" button
 */
export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id: storyId } = await context.params;

  console.log("🌍 [API] Ensure-world requested for:", storyId);

  // Validate story exists
  const story = await db.query.stories.findFirst({
    where: eq(stories.id, storyId),
    columns: { id: true, status: true },
  });

  if (!story) {
    return NextResponse.json({ error: "Story not found" }, { status: 404 });
  }

  // Check if already processing
  if (story.status === "extracting") {
    console.log("⏭️  World extraction already in progress, skipping");
    return NextResponse.json({
      ok: true,
      message: "World extraction already in progress",
    });
  }

  // Mark as extracting
  await db
    .update(stories)
    .set({ 
      status: "extracting", 
      updatedAt: new Date() 
    })
    .where(eq(stories.id, storyId));

  // Trigger the orchestrator
  await inngest.send({
    name: "story/ensure-world",
    data: { storyId },
  });

  console.log("🚀 World extraction orchestrator dispatched");

  return NextResponse.json({
    ok: true,
    message: "World extraction started (resumable from last checkpoint)",
  });
}