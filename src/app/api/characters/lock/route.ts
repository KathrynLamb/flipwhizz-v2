// src/app/api/characters/lock/route.ts
import { NextResponse } from "next/server";
import { db } from "@/db";
import { characters } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { generatePortraitFromDescription } from "@/lib/characters/generatePortrait";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { characterId } = await req.json();
  if (!characterId) {
    return NextResponse.json({ error: "Missing characterId" }, { status: 400 });
  }

  const [character] = await db
    .select({
      id: characters.id,
      userId: characters.userId,
      locked: characters.locked,
      portraitImageUrl: characters.portraitImageUrl,
    })
    .from(characters)
    .where(eq(characters.id, characterId))
    .limit(1);

  if (!character) {
    return NextResponse.json({ error: "Character not found" }, { status: 404 });
  }

  if (character.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (character.locked) {
    // Idempotent — safe to call twice
    return NextResponse.json({ ok: true });
  }

  // Auto-generate portrait from description if missing
  if (!character.portraitImageUrl) {
    console.log(`🖼️ No portrait for character ${characterId} — auto-generating before lock`);
    try {
      await generatePortraitFromDescription(characterId);
    } catch (err) {
      console.error("❌ Auto portrait generation failed during lock:", err);
      // Don't block the lock — let it proceed without a portrait
      // The illustration pipeline's preflight (future) will catch it
    }
  }

  await db
    .update(characters)
    .set({ locked: true, updatedAt: new Date() })
    .where(eq(characters.id, characterId));

  return NextResponse.json({ ok: true });
}