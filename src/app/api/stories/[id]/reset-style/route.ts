// src/app/api/stories/[id]/reset-style/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { stories, storySpreads, storySpreadScene, storyWorkflowProgress } from "@/db/schema";
import { eq } from "drizzle-orm";

const POST_DESIGN_STEPS = [
  "design",
  "characters",
  "locations",
  "preview",
  "pay",
  "studio",
  "cover",
  "print",
];

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: storyId } = await context.params;

    // 1. Strip post-design steps from completedSteps
    const story = await db
      .select({ completedSteps: stories.completedSteps })
      .from(stories)
      .where(eq(stories.id, storyId))
      .limit(1)
      .then(r => r[0]);

    if (!story) {
      return NextResponse.json({ error: "Story not found" }, { status: 404 });
    }

    const currentSteps = (story.completedSteps as string[] ?? []);
    const resetSteps = currentSteps.filter(
      (s) => !POST_DESIGN_STEPS.includes(s)
    );

    // 2. Get all spreads for this story
    const spreads = await db
      .select({ id: storySpreads.id })
      .from(storySpreads)
      .where(eq(storySpreads.storyId, storyId));

    const spreadIds = spreads.map(s => s.id);

    // 3. Clear illustration prompts from storySpreadScene
    // (they were generated with the old style, need rebuilding)
    if (spreadIds.length > 0) {
      for (const spreadId of spreadIds) {
        await db
          .update(storySpreadScene)
          .set({
            illustrationPrompt: "",
            locked: false,
            updatedAt: new Date(),
          })
          .where(eq(storySpreadScene.spreadId, spreadId))
          .catch(() => {}); // non-fatal if no scene exists
      }
    }

    // 4. Reset workflow progress flags that relate to prompts and illustrations
    await db
      .update(storyWorkflowProgress)
      .set({
        promptsBuilt: false,
        promptsBuiltAt: null,
        updatedAt: new Date(),
      })
      .where(eq(storyWorkflowProgress.storyId, storyId))
      .catch(() => {}); // non-fatal if no workflow row

    // 5. Update completedSteps on the story
    await db
      .update(stories)
      .set({
        completedSteps: resetSteps,
        updatedAt: new Date(),
      })
      .where(eq(stories.id, storyId));

    console.log(`[reset-style] Story ${storyId}: reset steps to`, resetSteps);

    return NextResponse.json({ ok: true, completedSteps: resetSteps });
  } catch (err) {
    console.error("[reset-style]", err);
    return NextResponse.json({ error: "Reset failed" }, { status: 500 });
  }
}