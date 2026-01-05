// src/app/api/characters/update/route.ts
import { NextResponse } from "next/server";
import { db } from "@/db";
import { characters } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { characterId, description } = await req.json();

  if (!characterId) {
    return NextResponse.json({ error: "Missing characterId" }, { status: 400 });
  }

  const [character] = await db
    .select({
      id: characters.id,
      userId: characters.userId,
      locked: characters.locked,
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
    return NextResponse.json(
      { error: "Character is locked" },
      { status: 403 }
    );
  }

  await db
    .update(characters)
    .set({
      description,
      updatedAt: new Date(),
    })
    .where(eq(characters.id, characterId));

  return NextResponse.json({ ok: true });
}
