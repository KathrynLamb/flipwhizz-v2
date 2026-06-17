
// src/app/api/stories/generate-cover-prompt/route.ts
//
// v2: Thin wrapper. The cover chat now builds the generationStrategy.
// This route just ensures the coverPlan is saved and locked.
// Kept for backward compatibility — the frontend still calls this before triggering Inngest.

import { NextResponse } from "next/server";
import { db } from "@/db";
import { stories } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(req: Request) {
  try {
    const { storyId } = await req.json();

    if (!storyId) {
      return NextResponse.json({ error: "storyId required" }, { status: 400 });
    }

    const story = await db
      .select()
      .from(stories)
      .where(eq(stories.id, storyId))
      .then((r) => r[0]);

    if (!story) {
      return NextResponse.json({ error: "Story not found" }, { status: 404 });
    }

    const coverPlan = story.coverPlan as any;

    if (!coverPlan?.generationStrategy) {
      return NextResponse.json(
        { error: "No generationStrategy found in coverPlan. Complete the cover chat first." },
        { status: 400 }
      );
    }

    // Ensure locked
    if (!story.coverPlanLocked) {
      await db.update(stories).set({
        coverPlanLocked: true,
        updatedAt: new Date(),
      }).where(eq(stories.id, storyId));
    }

    return NextResponse.json({
      success: true,
      coverPlan,
    });
  } catch (err: any) {
    console.error("Cover prompt route error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}