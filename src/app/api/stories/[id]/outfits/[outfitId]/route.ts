// src/app/api/stories/[storyId]/outfits/[outfitId]/route.ts
import { NextResponse } from "next/server";
import { db } from "@/db";
import { characterStoryOutfits, characters } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { withAccess } from "@/lib/authz";

async function _PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; outfitId: string }> }
) {
  try {
    const { id: storyId, outfitId } = await params;
    const { outfitDescription } = await req.json();

    if (!outfitDescription || typeof outfitDescription !== "string") {
      return NextResponse.json(
        { error: "outfitDescription is required" },
        { status: 400 }
      );
    }

    const updated = await db
      .update(characterStoryOutfits)
      .set({ outfitDescription })
      .where(and(eq(characterStoryOutfits.id, outfitId), eq(characterStoryOutfits.storyId, storyId)))
      .returning();

    if (!updated.length) {
      return NextResponse.json({ error: "Outfit not found" }, { status: 404 });
    }

    await db.update(characters).set({ portraitImageUrl: null, locked: false, lockedAt: null, updatedAt: new Date() })
      .where(eq(characters.id, updated[0].characterId));
    return NextResponse.json({ ok: true, outfit: updated[0] });
  } catch (error) {
    console.error("Update outfit error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

export const PATCH = withAccess({ story: { param: "id" } }, _PATCH);
