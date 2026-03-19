import { NextResponse } from "next/server";
import { db } from "@/db";
import { characters } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const characterId =
      typeof body.characterId === "string" ? body.characterId : null;
    const imageUrl =
      typeof body.imageUrl === "string" ? body.imageUrl : null;
    const storagePath =
      typeof body.storagePath === "string" ? body.storagePath : null;

    if (!characterId || !imageUrl) {
      return NextResponse.json(
        { error: "Missing characterId or imageUrl" },
        { status: 400 }
      );
    }

    await db
      .update(characters)
      .set({
        referenceImageUrl: imageUrl,
        updatedAt: new Date(),
      })
      .where(eq(characters.id, characterId));

    return NextResponse.json({
      ok: true,
      url: imageUrl,
      storagePath,
    });
  } catch (err) {
    console.error("CHARACTER UPLOAD ERROR:", err);
    return NextResponse.json(
      { error: "Failed to save reference image" },
      { status: 500 }
    );
  }
}