// src/app/api/stories/[id]/outfits/[outfitId]/route.ts
import { NextResponse } from "next/server";
import { db } from "@/db";
import { characterStoryOutfits } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { requireStoryOwner } from "@/lib/apiAuth";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; outfitId: string }> }
) {
  try {
    const { id: storyId, outfitId } = await params;
    const ownerCheck = await requireStoryOwner(storyId);
    if (!ownerCheck.ok) return ownerCheck.response;

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
      .where(
        and(
          eq(characterStoryOutfits.id, outfitId),
          eq(characterStoryOutfits.storyId, storyId)
        )
      )
      .returning();

    if (!updated.length) {
      return NextResponse.json({ error: "Outfit not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, outfit: updated[0] });
  } catch (error) {
    console.error("Update outfit error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}