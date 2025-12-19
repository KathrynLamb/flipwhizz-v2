// characters/[id]/route
import { NextResponse } from "next/server";
import { db } from "@/db";
import { characters } from "@/db/schema";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    // ✅ MUST await params in App Router
    const { id: characterId } = await ctx.params;
    const body = await req.json();

    console.log("Updating character:", characterId);
    console.log("Payload:", body);

    const update: Record<string, any> = {};

    if (body.name !== undefined) update.name = body.name;
    if (body.description !== undefined) update.description = body.description;
    if (body.appearance !== undefined) update.appearance = body.appearance;
    if (body.referenceImageUrl !== undefined)
      update.referenceImageUrl = body.referenceImageUrl;

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ success: true });
    }

    await db
      .update(characters)
      .set(update)
      .where(eq(characters.id, characterId));

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[CHARACTER PATCH ERROR]", err);
    return NextResponse.json(
      { error: "Failed to update character" },
      { status: 500 }
    );
  }
}
