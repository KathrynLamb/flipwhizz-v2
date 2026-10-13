// src/app/api/characters/lock/route.ts
import { NextResponse } from "next/server";
import { db } from "@/db";
import { characters } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPortrait } from "@/lib/characters/readiness";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { characterId, portraitImageUrl } = await req.json();
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

  if (!hasPortrait(character)) {
    return NextResponse.json({ error: 'Generate an appearance and review it before approving.' }, { status: 409 });
  }
  if (portraitImageUrl && portraitImageUrl !== character.portraitImageUrl) {
    return NextResponse.json({ error: 'The appearance changed. Refresh and review the latest image.' }, { status: 409 });
  }

  const approved = await db
    .update(characters)
    .set({ locked: true, lockedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(characters.id, characterId), eq(characters.portraitImageUrl, character.portraitImageUrl!)))
    .returning({ id: characters.id });
  if (!approved.length) return NextResponse.json({ error: "Appearance changed. Please review it again." }, { status: 409 });

  return NextResponse.json({ ok: true });
}