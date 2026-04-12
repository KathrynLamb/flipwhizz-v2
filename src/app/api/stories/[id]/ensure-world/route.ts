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
 * Safeguards against stuck jobs:
 * - Force parameter to override stuck state
 * - Timeout detection (>5 min = probably stuck)
 * - Manual retry capability
 */
export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id: storyId } = await context.params;
  
  // Check for force parameter
  const url = new URL(req.url);
  const force = url.searchParams.get('force') === 'true';

  console.log("🌍 [API] Ensure-world requested for:", storyId, { force });

  // Validate story exists
// After fetching the story, add storyConfirmed to the columns:
const story = await db.query.stories.findFirst({
  where: eq(stories.id, storyId),
  columns: { 
    id: true, 
    status: true, 
    updatedAt: true,
    storyConfirmed: true,  // ← add this
  },
});

if (!story) {
  return NextResponse.json({ error: "Story not found" }, { status: 404 });
}

// Guard: story must be confirmed before extraction
if (!story.storyConfirmed && !force) {
  console.log("⛔ Story not yet confirmed, skipping extraction. Status:", story.status);
  return NextResponse.json(
    { error: "Story must be confirmed before world extraction" },
    { status: 400 }
  );
}

  // Check if already processing (unless forced)
  if (story.status === "extracting" && !force) {
    // Check if it's been stuck for more than 5 minutes
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const isStuck = story.updatedAt && story.updatedAt < fiveMinutesAgo;

    if (isStuck) {
      console.log("⚠️  World extraction appears stuck (>5min), forcing restart");
      // Fall through to restart
    } else {
      console.log("⏭️  World extraction already in progress, skipping");
      return NextResponse.json({
        ok: true,
        message: "World extraction already in progress",
        canForce: true, // Tell frontend they can force if needed
      });
    }
  }

  // Mark as extracting with fresh timestamp
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
    message: force 
      ? "World extraction restarted (forced)" 
      : "World extraction started (resumable from last checkpoint)",
  });
}