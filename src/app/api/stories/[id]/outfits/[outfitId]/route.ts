// src/app/api/stories/[storyId]/outfits/[outfitId]/route.ts
import { NextResponse } from "next/server";
import { db } from "@/db";
import { characterStoryOutfits } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ storyId: string; outfitId: string }> }
) {
  try {
    const { storyId, outfitId } = await params;
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
      .where(eq(characterStoryOutfits.id, outfitId))
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