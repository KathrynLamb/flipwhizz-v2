import { db } from "@/db";
import {
  storySpreads,
  storyPages,
  characters,
  locations,
  storyCharacters,
  storyLocations,
  storyStyleGuide,
  characterStoryOutfits,
  spreadCharacterOutfits,
  storyPageCharacters,
  storyPageLocations,
  storySpreadPresence,
  storySpreadScene,
} from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";

import { NextResponse } from "next/server";

type OutfitOption = {
  outfitKey: string;
  outfitDescription: string;
  isDefault: boolean;
};

type SpreadPresenceCharacter = {
  characterId: string;
  role?: "primary" | "secondary" | "background";
  confidence?: number;
  reason?: string;
};

type SpreadPresenceLocation = {
  locationId: string;
  role?: "primary" | "secondary" | "background" | "referenced" | "memory";
  confidence?: number;
  reason?: string;
};

function uniqueIds(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; spreadId: string }> }
) {
  try {
    const { id: storyId, spreadId } = await params;

    /* ───────── 1. Spread ───────── */

    const spread = await db.query.storySpreads.findFirst({
      where: and(
        eq(storySpreads.id, spreadId),
        eq(storySpreads.storyId, storyId)
      ),
    });

    if (!spread) {
      return NextResponse.json({ error: "Spread not found" }, { status: 404 });
    }

    /* ───────── 2. Scene record (art director brief) ───────── */

    const sceneRecord = await db.query.storySpreadScene.findFirst({
      where: eq(storySpreadScene.spreadId, spreadId),
    });

    /* ───────── 3. Pages for this spread ───────── */

    const spreadPageIds = [spread.leftPageId, spread.rightPageId].filter(
      Boolean
    ) as string[];

    const pages = spreadPageIds.length
      ? await db
          .select()
          .from(storyPages)
          .where(inArray(storyPages.id, spreadPageIds))
      : [];

    /* ───────── 4. Spread presence (preferred source of truth) ───────── */

    const spreadPresence = await db.query.storySpreadPresence.findFirst({
      where: eq(storySpreadPresence.spreadId, spreadId),
    });

    const presenceCharacters = (spreadPresence?.characters ??
      []) as SpreadPresenceCharacter[];
    const presenceLocations = (spreadPresence?.locations ??
      []) as SpreadPresenceLocation[];

    /* ───────── 5. Page-level fallback assignments ───────── */

    const pageCharacterRows = spreadPageIds.length
      ? await db
          .select({ characterId: storyPageCharacters.characterId })
          .from(storyPageCharacters)
          .where(
            and(
              eq(storyPageCharacters.storyId, storyId),
              inArray(storyPageCharacters.pageId, spreadPageIds)
            )
          )
      : [];

    const pageLocationRows = spreadPageIds.length
      ? await db
          .select({ locationId: storyPageLocations.locationId })
          .from(storyPageLocations)
          .where(
            and(
              eq(storyPageLocations.storyId, storyId),
              inArray(storyPageLocations.pageId, spreadPageIds)
            )
          )
      : [];

    const fallbackCharacterIds = uniqueIds(
      pageCharacterRows.map((r) => r.characterId)
    );
    const fallbackLocationIds = uniqueIds(
      pageLocationRows.map((r) => r.locationId)
    );

    const assignedCharacterIds =
      presenceCharacters.length > 0
        ? uniqueIds(presenceCharacters.map((c) => c.characterId))
        : fallbackCharacterIds;

    const assignedLocationIds =
      presenceLocations.length > 0
        ? uniqueIds(presenceLocations.map((l) => l.locationId))
        : fallbackLocationIds;

    /* ───────── 6. All story characters ───────── */

    const storyCharacterRows = await db
      .select({
        characterId: storyCharacters.characterId,
        role: storyCharacters.role,
      })
      .from(storyCharacters)
      .where(eq(storyCharacters.storyId, storyId));

    const allCharacterIds = storyCharacterRows.map((sc) => sc.characterId);

    const allCharacterData = allCharacterIds.length
      ? await db
          .select({
            id: characters.id,
            name: characters.name,
            portraitImageUrl: characters.portraitImageUrl,
            fullBodyImageUrl: characters.fullBodyImageUrl,
            referenceImageUrl: characters.referenceImageUrl,
            description: characters.description,
          })
          .from(characters)
          .where(inArray(characters.id, allCharacterIds))
      : [];

    /* ───────── 7. All story locations ───────── */

    const storyLocationRows = await db
      .select({
        locationId: storyLocations.locationId,
        significance: storyLocations.significance,
      })
      .from(storyLocations)
      .where(eq(storyLocations.storyId, storyId));

    const allLocationIds = storyLocationRows.map((sl) => sl.locationId);

    const allLocationData = allLocationIds.length
      ? await db
          .select({
            id: locations.id,
            name: locations.name,
            portraitImageUrl: locations.portraitImageUrl,
            referenceImageUrl: locations.referenceImageUrl,
            description: locations.description,
          })
          .from(locations)
          .where(inArray(locations.id, allLocationIds))
      : [];

    /* ───────── 8. Outfit data ───────── */

    const outfitAssignments = await db
      .select({
        characterId: spreadCharacterOutfits.characterId,
        outfitKey: spreadCharacterOutfits.outfitKey,
        outfitDescription: spreadCharacterOutfits.outfitDescription,
      })
      .from(spreadCharacterOutfits)
      .where(eq(spreadCharacterOutfits.spreadId, spreadId));

    const allOutfits = await db
      .select({
        characterId: characterStoryOutfits.characterId,
        outfitKey: characterStoryOutfits.outfitKey,
        outfitDescription: characterStoryOutfits.outfitDescription,
        isDefault: characterStoryOutfits.isDefault,
      })
      .from(characterStoryOutfits)
      .where(eq(characterStoryOutfits.storyId, storyId));

    const outfitsByCharacter: Record<string, OutfitOption[]> = {};
    for (const outfit of allOutfits) {
      if (!outfitsByCharacter[outfit.characterId]) {
        outfitsByCharacter[outfit.characterId] = [];
      }
      outfitsByCharacter[outfit.characterId].push({
        outfitKey: outfit.outfitKey,
        outfitDescription: outfit.outfitDescription,
        isDefault: outfit.isDefault,
      });
    }

    /* ───────── 9. Style guide ───────── */

    const styleGuide = await db.query.storyStyleGuide.findFirst({
      where: eq(storyStyleGuide.storyId, storyId),
    });

    /* ───────── 10. Build characters response ───────── */

    const assignedCharacterIdSet = new Set(assignedCharacterIds);

    const assignedCharacters = assignedCharacterIds
      .map((characterId) => {
        const char = allCharacterData.find((c) => c.id === characterId);
        if (!char) return null;

        const storyRole =
          storyCharacterRows.find((sc) => sc.characterId === characterId)
            ?.role ?? null;

        const presenceRole =
          presenceCharacters.find((pc) => pc.characterId === characterId)?.role ??
          null;

        const spreadAssignment =
          outfitAssignments.find((oa) => oa.characterId === characterId) ?? null;

        const availableOutfits = outfitsByCharacter[characterId] ?? [];

        const selectedOutfit = spreadAssignment?.outfitKey
          ? availableOutfits.find(
              (o) => o.outfitKey === spreadAssignment.outfitKey
            ) ?? null
          : null;

        const defaultOutfit =
          availableOutfits.find((o) => o.isDefault) ?? null;

        const resolvedCurrentOutfit =
          selectedOutfit ??
          defaultOutfit ??
          (spreadAssignment
            ? {
                outfitKey: spreadAssignment.outfitKey,
                outfitDescription: spreadAssignment.outfitDescription ?? "",
                isDefault: false,
              }
            : null);

        return {
          characterId,
          name: char.name,
          portraitImageUrl: char.portraitImageUrl ?? null,
          fullBodyImageUrl: char.fullBodyImageUrl ?? null,
          referenceImageUrl: char.referenceImageUrl ?? null,
          role: (presenceRole ?? storyRole) as string | null,
          currentOutfitKey: resolvedCurrentOutfit?.outfitKey ?? null,
          currentOutfitDescription:
            resolvedCurrentOutfit?.outfitDescription ?? null,
          availableOutfits,
        };
      })
      .filter(Boolean);

    const availableCharacters = allCharacterData
      .filter((c) => !assignedCharacterIdSet.has(c.id))
      .map((c) => {
        const storyRole =
          storyCharacterRows.find((sc) => sc.characterId === c.id)?.role ?? null;

        return {
          characterId: c.id,
          name: c.name,
          portraitImageUrl: c.portraitImageUrl,
          fullBodyImageUrl: c.fullBodyImageUrl,
          referenceImageUrl: c.referenceImageUrl,
          role: storyRole,
          availableOutfits: outfitsByCharacter[c.id] ?? [],
        };
      });

    /* ───────── 11. Build locations response ───────── */

    const assignedLocationIdSet = new Set(assignedLocationIds);

    const assignedLocations = assignedLocationIds
      .map((locationId) => {
        const loc = allLocationData.find((l) => l.id === locationId);
        if (!loc) return null;

        const presenceRole =
          presenceLocations.find((pl) => pl.locationId === locationId)?.role ??
          null;

        return {
          id: loc.id,
          name: loc.name,
          portraitImageUrl: loc.portraitImageUrl,
          referenceImageUrl: loc.referenceImageUrl,
          description: loc.description,
          significance:
            storyLocationRows.find((sl) => sl.locationId === loc.id)
              ?.significance ?? null,
          role:
            (presenceRole ??
              (assignedLocationIds[0] === locationId
                ? "primary"
                : "secondary")) as
              | "primary"
              | "secondary"
              | "background"
              | "referenced"
              | "memory",
        };
      })
      .filter(Boolean);

    const assignedLocation = assignedLocations[0] ?? null;

    const availableLocations = allLocationData
      .filter((l) => !assignedLocationIdSet.has(l.id))
      .map((l) => ({
        id: l.id,
        name: l.name,
        portraitImageUrl: l.portraitImageUrl,
        referenceImageUrl: l.referenceImageUrl,
        description: l.description,
        significance:
          storyLocationRows.find((sl) => sl.locationId === l.id)?.significance ??
          null,
      }));

    /* ───────── 12. Response ───────── */

    return NextResponse.json({
      spread: {
        id: spread.id,
        spreadIndex: spread.spreadIndex,
        // Prefer scene record data — it's the locked art director brief.
        // Fall back to storySpreads.sceneSummary for older stories without scene records.
        sceneSummary: sceneRecord?.sceneSummary ?? spread.sceneSummary ?? null,
        illustrationPrompt: sceneRecord?.illustrationPrompt ?? null,
        mood: sceneRecord?.mood ?? null,
        compositionNotes: (sceneRecord?.compositionNotes as string[]) ?? [],
      },
      pages: pages.map((p) => ({
        id: p.id,
        pageNumber: p.pageNumber,
        text: p.text,
        imageUrl: p.imageUrl,
      })),
      assignedCharacters,
      availableCharacters,
      assignedLocation,
      assignedLocations,
      availableLocations,
      styleGuide: styleGuide
        ? {
            summary: styleGuide.summary,
            artStyle: styleGuide.artStyle,
            sampleIllustrationUrl: styleGuide.sampleIllustrationUrl,
          }
        : null,
    });
  } catch (error) {
    console.error("references route error:", error);
    return NextResponse.json(
      { error: "Failed to load spread references" },
      { status: 500 }
    );
  }
}