import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { characterStoryOutfits } from "@/db/schema";
import { and, eq } from "drizzle-orm";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; characterId: string } }
) {
  const { id: storyId, characterId } = params;

  if (!storyId || !characterId) {
    return NextResponse.json(
      { error: "Missing storyId or characterId in route params" },
      { status: 400 }
    );
  }

  try {
    const body = await req.json();
    const { outfitKey, outfitDescription, triggerConditions } = body;

    if (!outfitKey || !outfitDescription) {
      return NextResponse.json(
        { error: "outfitKey and outfitDescription are required" },
        { status: 400 }
      );
    }

    const sanitisedKey = outfitKey
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_]/g, "");

    if (!sanitisedKey) {
      return NextResponse.json(
        { error: "Invalid outfit name" },
        { status: 400 }
      );
    }

    const existing = await db.query.characterStoryOutfits.findFirst({
      where: and(
        eq(characterStoryOutfits.storyId, storyId),
        eq(characterStoryOutfits.characterId, characterId),
        eq(characterStoryOutfits.outfitKey, sanitisedKey)
      ),
    });

    if (existing) {
      return NextResponse.json(
        { error: `Outfit "${sanitisedKey}" already exists for this character` },
        { status: 409 }
      );
    }

    const [outfit] = await db
      .insert(characterStoryOutfits)
      .values({
        storyId,
        characterId,
        outfitKey: sanitisedKey,
        outfitDescription: outfitDescription.trim(),
        triggerConditions:
          typeof triggerConditions === "string" && triggerConditions.trim()
            ? triggerConditions.trim()
            : null,
        isDefault: false,
      })
      .returning();

    return NextResponse.json({
      outfit: {
        id: outfit.id,
        outfitKey: outfit.outfitKey,
        outfitDescription: outfit.outfitDescription,
        isDefault: outfit.isDefault,
      },
    });
  } catch (err: any) {
    console.error("Failed to create outfit:", err);
    return NextResponse.json(
      { error: err.message || "Failed to create outfit" },
      { status: 500 }
    );
  }
}