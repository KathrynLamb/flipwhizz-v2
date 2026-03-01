import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { stories } from "@/db/schema";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: storyId } = await params;
  const { step } = await req.json();

  if (!step || typeof step !== "string") {
    return NextResponse.json({ error: "Missing step" }, { status: 400 });
  }

  // Get current completedSteps
  const [story] = await db
    .select({ completedSteps: stories.completedSteps })
    .from(stories)
    .where(eq(stories.id, storyId));

  if (!story) {
    return NextResponse.json({ error: "Story not found" }, { status: 404 });
  }

  const existing: string[] = (story.completedSteps as string[]) || [];

  if (existing.includes(step)) {
    return NextResponse.json({ ok: true, alreadyCompleted: true });
  }

  const updated = [...existing, step];

  await db
    .update(stories)
    .set({
      completedSteps: updated,
      updatedAt: new Date(),
    })
    .where(eq(stories.id, storyId));

  return NextResponse.json({ ok: true, completedSteps: updated });
}