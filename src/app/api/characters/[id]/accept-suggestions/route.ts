// src/app/api/characters/[id]/accept-suggestions/route.ts
import { NextResponse } from "next/server";
import { db } from "@/db";
import { characters, characterStoryOutfits } from "@/db/schema";
import { eq, and } from "drizzle-orm";

/**
 * POST /api/characters/[id]/accept-suggestions
 *
 * Body: {
 *   storyId: string,
 *   acceptAppearance: boolean,
 *   acceptDescription: boolean,
 *   createOutfit: boolean,          // user confirmed "yes this is a chosen outfit"
 *   customAppearance?: string,      // if they edited the suggestion before accepting
 *   customDescription?: string,
 *   customOutfitDescription?: string,
 *   outfitLabel?: string,           // e.g. "casual summer"
 * }
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: characterId } = await params;
    const body = await req.json();
    const {
      storyId,
      acceptAppearance,
      acceptDescription,
      createOutfit,
      customAppearance,
      customDescription,
      customOutfitDescription,
      outfitLabel,
    } = body;

    // Fetch current character + suggestions
    const character = await db.query.characters.findFirst({
      where: eq(characters.id, characterId),
    });

    if (!character) {
      return NextResponse.json({ error: "Character not found" }, { status: 404 });
    }

    const visualDetails = (character.visualDetails as Record<string, any>) || {};
    const suggestions = visualDetails?.photoAnalysis?.suggestions;

    if (!suggestions) {
      return NextResponse.json(
        { error: "No suggestions available" },
        { status: 400 }
      );
    }

    // Build updates
    const updates: Record<string, any> = {
      updatedAt: new Date(),
    };

    // Accept appearance
    if (acceptAppearance) {
      updates.appearance = customAppearance || suggestions.appearance;
    }

    // Accept enriched description
    if (acceptDescription && (customDescription || suggestions.enrichedDescription)) {
      updates.description = customDescription || suggestions.enrichedDescription;
    }

    // Mark suggestions as handled
    updates.visualDetails = {
      ...visualDetails,
      photoAnalysis: {
        ...visualDetails.photoAnalysis,
        status: "handled",
        handledAt: new Date().toISOString(),
        accepted: {
          appearance: acceptAppearance,
          description: acceptDescription,
          outfit: createOutfit,
        },
      },
    };

    // Update character
    await db
      .update(characters)
      .set(updates)
      .where(eq(characters.id, characterId));

    // Create outfit entry if user confirmed
    if (createOutfit && storyId) {
      const outfitKey = (outfitLabel || "reference_photo")
        .toLowerCase()
        .replace(/\s+/g, "_")
        .replace(/[^a-z0-9_]/g, "");

      const outfitDesc =
        customOutfitDescription || suggestions.outfit;

      // Upsert — don't create duplicate if one exists with same key
      const existing = await db
        .select()
        .from(characterStoryOutfits)
        .where(
          and(
            eq(characterStoryOutfits.storyId, storyId),
            eq(characterStoryOutfits.characterId, characterId),
            eq(characterStoryOutfits.outfitKey, outfitKey)
          )
        )
        .limit(1)
        .then((rows) => rows[0]);

      if (existing) {
        await db
          .update(characterStoryOutfits)
          .set({ outfitDescription: outfitDesc })
          .where(eq(characterStoryOutfits.id, existing.id));
      } else {
        await db.insert(characterStoryOutfits).values({
          storyId,
          characterId,
          outfitKey,
          outfitDescription: outfitDesc,
          triggerConditions: null,
        });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Accept suggestions error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}