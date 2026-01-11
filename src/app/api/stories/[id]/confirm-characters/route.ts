import { NextResponse } from "next/server";
import { db } from "@/db";
import { stories, storyCharacters, characters } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";

/* ------------------------------------------------------------------
   POST /api/stories/[id]/confirm-characters
------------------------------------------------------------------ */

export async function POST(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id: storyId } = await context.params; // ✅ FIX

  if (!storyId) {
    return NextResponse.json(
      { error: "Missing storyId" },
      { status: 400 }
    );
  }

  try {
    await db.transaction(async (tx) => {
      // 1️⃣ Get character IDs for this story
      const linked = await tx
        .select({ characterId: storyCharacters.characterId })
        .from(storyCharacters)
        .where(eq(storyCharacters.storyId, storyId));

      const characterIds = linked.map((c) => c.characterId);

      // 2️⃣ Lock characters
      if (characterIds.length > 0) {
        await tx
          .update(characters)
          .set({
            locked: true,
            lockedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(inArray(characters.id, characterIds));
      }

      // 3️⃣ Mark story as confirmed
      await tx
        .update(stories)
        .set({
          storyConfirmed: true,
          updatedAt: new Date(),
        })
        .where(eq(stories.id, storyId));
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("CONFIRM CHARACTERS ERROR", err);
    return NextResponse.json(
      { error: "Failed to confirm characters" },
      { status: 500 }
    );
  }
}
