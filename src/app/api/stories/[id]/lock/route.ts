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

// Define the context type for better readability
type Context = {
  params: Promise<{ id: string }>;
};

export async function POST(
  _req: Request,
  { params }: Context // Update argument type here
) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Await the params before using them
  const { id } = await params;
  const storyId = id;

  try {
    await db.transaction(async (tx) => {
      // 1️⃣ Lock the story text
      const updated = await tx
        .update(stories)
        .set({
          storyConfirmed: true,
          status: "confirmed",
          updatedAt: new Date(),
        })
        .where(eq(stories.id, storyId))
        .returning({ id: stories.id });

      if (!updated.length) {
        throw new Error("Story not found");
      }

      // 2️⃣ Clear derived world data (safe to regenerate)
      await Promise.all([
        tx.delete(storyCharacters).where(eq(storyCharacters.storyId, storyId)),
        tx.delete(storyLocations).where(eq(storyLocations.storyId, storyId)),
        tx.delete(storyStyleGuide).where(eq(storyStyleGuide.storyId, storyId)),
        tx.delete(storySpreads).where(eq(storySpreads.storyId, storyId)),
        tx.delete(storyWorkflowProgress).where(eq(storyWorkflowProgress.storyId, storyId)),
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