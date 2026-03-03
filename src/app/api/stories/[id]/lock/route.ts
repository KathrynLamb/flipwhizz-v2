import { NextResponse } from "next/server";
import { db } from "@/db";
import {
  stories,
  storyCharacters,
  storyLocations,
  storyStyleGuide,
  storySpreads,
  storyWorkflowProgress,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

type Context = {
  params: Promise<{ id: string }>;
};

export async function POST(_req: Request, { params }: Context) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: storyId } = await params;

  try {
    const [existing] = await db
      .select({ storyConfirmed: stories.storyConfirmed })
      .from(stories)
      .where(eq(stories.id, storyId));

    if (!existing) {
      return NextResponse.json({ error: "Story not found" }, { status: 404 });
    }

    // Already confirmed — don't wipe anything
    if (existing.storyConfirmed) {
      return NextResponse.json({ ok: true, alreadyConfirmed: true });
    }

    // First time confirming — wipe + rebuild
    await db.transaction(async (tx) => {
      const [current] = await tx
        .select({ completedSteps: stories.completedSteps })
        .from(stories)
        .where(eq(stories.id, storyId));

      const existingSteps: string[] =
        (current?.completedSteps as string[]) || [];

      // Mark all steps up to this point as complete
      const stepsToComplete = ["write", "design"];
      const updatedSteps = [
        ...existingSteps,
        ...stepsToComplete.filter((s) => !existingSteps.includes(s)),
      ];

      const updated = await tx
        .update(stories)
        .set({
          storyConfirmed: true,
          status: "confirmed",
          completedSteps: updatedSteps,
          updatedAt: new Date(),
        })
        .where(eq(stories.id, storyId))
        .returning({ id: stories.id });

      if (!updated.length) {
        throw new Error("Story not found");
      }

      // Clear derived world data (safe to regenerate)
      await Promise.all([
        tx.delete(storyCharacters).where(eq(storyCharacters.storyId, storyId)),
        tx.delete(storyLocations).where(eq(storyLocations.storyId, storyId)),
        tx.delete(storyStyleGuide).where(eq(storyStyleGuide.storyId, storyId)),
        tx.delete(storySpreads).where(eq(storySpreads.storyId, storyId)),
        tx
          .delete(storyWorkflowProgress)
          .where(eq(storyWorkflowProgress.storyId, storyId)),
      ]);
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("❌ Failed to lock story:", err);
    return NextResponse.json(
      { error: "Failed to lock story" },
      { status: 500 }
    );
  }
}