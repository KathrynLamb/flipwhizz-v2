import { NextResponse } from "next/server";
import { db } from "@/db";
import { stories } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import type { StepKey } from "@/lib/storySteps";

type Context = {
  params: Promise<{ id: string }>;
};

const VALID_STEPS: StepKey[] = [
  "write",
  "design",
  "characters",
  "locations",
  "preview",
  "pay",
  "studio",
  "cover",
  "print",
];

/**
 * POST /api/stories/[id]/lock-step
 *
 * Body: { step: StepKey }
 *
 * Adds the given step to the story's completed_steps array
 * if it isn't already there. Idempotent — calling twice
 * with the same step is a no-op.
 */
export async function POST(req: Request, { params }: Context) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: storyId } = await params;

  // Parse + validate body
  let step: StepKey;
  try {
    const body = await req.json();
    step = body.step;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  if (!step || !VALID_STEPS.includes(step)) {
    return NextResponse.json(
      { error: `Invalid step: "${step}". Must be one of: ${VALID_STEPS.join(", ")}` },
      { status: 400 }
    );
  }

  console.log(`🔒 Lock step "${step}" for story:`, storyId);

  try {
    const [story] = await db
      .select({
        id: stories.id,
        completedSteps: stories.completedSteps,
        userId: stories.userId,
      })
      .from(stories)
      .where(eq(stories.id, storyId));

    if (!story) {
      return NextResponse.json({ error: "Story not found" }, { status: 404 });
    }

    // Ownership check
    if (story.userId !== session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const existingSteps: string[] =
      (story.completedSteps as string[]) || [];

    // Already locked — idempotent success
    if (existingSteps.includes(step)) {
      return NextResponse.json({
        ok: true,
        alreadyLocked: true,
        completedSteps: existingSteps,
      });
    }

    const updatedSteps = [...existingSteps, step];

    await db
      .update(stories)
      .set({
        completedSteps: updatedSteps,
        updatedAt: new Date(),
      })
      .where(eq(stories.id, storyId));

    console.log(`✅ Step "${step}" locked. Completed steps:`, updatedSteps);

    return NextResponse.json({
      ok: true,
      completedSteps: updatedSteps,
    });
  } catch (err) {
    console.error(`❌ Failed to lock step "${step}":`, err);
    return NextResponse.json(
      { error: "Failed to lock step" },
      { status: 500 }
    );
  }
}