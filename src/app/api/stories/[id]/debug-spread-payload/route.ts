// src/app/api/stories/[id]/debug-spread-payload/route.ts
//
// Shows exactly what would be sent to Gemini for spread generation.
// Mirrors the logic in generateSpreadImages.phaseB.ts v4.
// DELETE before production.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  stories,
  storyPages,
  storyStyleGuide,
  characters,
  storySpreads,
  storyPageCharacters,
  storyPageLocations,
  locations,
  spreadCharacterOutfits,
  characterStoryOutfits,
} from "@/db/schema";
import { eq, inArray, asc, desc, or, sql, and } from "drizzle-orm";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: storyId } = await params;
  const url = new URL(req.url);
  const spreadIndex = parseInt(url.searchParams.get("spread") || "0", 10);

  const story = await db.query.stories.findFirst({ where: eq(stories.id, storyId) });
  if (!story) return NextResponse.json({ error: "Story not found" }, { status: 404 });

  // Get pages
  const pages = await db.query.storyPages.findMany({
    where: eq(storyPages.storyId, storyId),
    orderBy: asc(storyPages.pageNumber),
  });

  // Build spread pairs
  const spreadPairs: { left: typeof pages[0]; right: typeof pages[0] | null }[] = [];
  for (let i = 0; i < pages.length; i += 2) {
    spreadPairs.push({ left: pages[i], right: pages[i + 1] || null });
  }

  if (spreadIndex >= spreadPairs.length) {
    return NextResponse.json({ error: `Spread ${spreadIndex} not found. Max: ${spreadPairs.length - 1}` }, { status: 400 });
  }

  const pair = spreadPairs[spreadIndex];
  const leftPageId = pair.left.id;
  const rightPageId = pair.right?.id ?? null;
  const spreadPageIds = [leftPageId, ...(rightPageId ? [rightPageId] : [])];

  // Style guide
  const style = await db.query.storyStyleGuide.findFirst({ where: eq(storyStyleGuide.storyId, storyId) });

  // Style ref fallback
  let styleRefUrl: string | null = style?.sampleIllustrationUrl ?? null;
  if (!styleRefUrl || styleRefUrl.startsWith("data:image")) {
    const firstWithImage = pages.find((p) => p.imageUrl && !p.imageUrl.startsWith("data:image"));
    styleRefUrl = firstWithImage?.imageUrl ?? null;
  }

  // Spread plan
  const spread = await db.select({ spreadId: storySpreads.id, sceneSummary: storySpreads.sceneSummary })
    .from(storySpreads)
    .where(rightPageId
      ? or(eq(storySpreads.leftPageId, leftPageId), eq(storySpreads.rightPageId, rightPageId))
      : eq(storySpreads.leftPageId, leftPageId))
    .orderBy(desc(storySpreads.createdAt)).limit(1).then((r) => r[0]);

  // Characters assigned to this spread's pages
  const charRows = await db.select({ characterId: storyPageCharacters.characterId })
    .from(storyPageCharacters).where(inArray(storyPageCharacters.pageId, spreadPageIds));
  const charIds = [...new Set(charRows.map((r) => r.characterId))];

  const charRefs = charIds.length === 0 ? [] : await db.select({
    id: characters.id, name: characters.name,
    portraitUrl: characters.portraitImageUrl, fullBodyUrl: characters.fullBodyImageUrl,
    referenceUrl: characters.referenceImageUrl,
    species: characters.species, breed: characters.breed,
    appearance: characters.appearance, description: characters.description,
    visualDetails: characters.visualDetails,
  }).from(characters).where(inArray(characters.id, charIds));

  // Location
  const locRows = await db.select({ locationId: storyPageLocations.locationId })
    .from(storyPageLocations).where(inArray(storyPageLocations.pageId, spreadPageIds));
  const locIds = [...new Set(locRows.map((r) => r.locationId))];
  let locationRef: any = null;
  if (locIds.length > 0) {
    locationRef = await db.select({
      id: locations.id, name: locations.name,
      imageUrl: sql<string>`COALESCE(${locations.portraitImageUrl}, ${locations.referenceImageUrl})`,
      description: locations.description,
    }).from(locations).where(eq(locations.id, locIds[0])).limit(1).then((r) => r[0]);
  }

  // Outfits
  const outfitMap: Record<string, { outfitKey: string; outfitDescription: string }> = {};
  if (spread?.spreadId) {
    const assignments = await db.query.spreadCharacterOutfits.findMany({
      where: eq(spreadCharacterOutfits.spreadId, spread.spreadId),
    });
    const cids = [...new Set(assignments.map((a) => a.characterId))];
    const canonical = cids.length > 0
      ? await db.select({ characterId: characterStoryOutfits.characterId, outfitKey: characterStoryOutfits.outfitKey, outfitDescription: characterStoryOutfits.outfitDescription })
          .from(characterStoryOutfits).where(and(eq(characterStoryOutfits.storyId, storyId), inArray(characterStoryOutfits.characterId, cids)))
      : [];
    for (const a of assignments) {
      const match = canonical.find((o) => o.characterId === a.characterId && o.outfitKey === a.outfitKey);
      if (match) outfitMap[a.characterId] = { outfitKey: match.outfitKey, outfitDescription: match.outfitDescription };
    }
  }

  // Build the EXACT prompt parts list (text only — images shown as URLs)
  const promptParts: { index: number; type: "image" | "text"; content: string }[] = [];
  let idx = 0;

  // 1. Style reference
  if (styleRefUrl) {
    promptParts.push({ index: idx++, type: "image", content: `[STYLE REF] ${styleRefUrl}` });
    promptParts.push({ index: idx++, type: "text", content: "↑ STYLE REFERENCE — match this illustration style exactly. Same technique, line weight, colours, warmth. ↑" });
  }

  // 2. Layout template
  promptParts.push({ index: idx++, type: "image", content: "[LAYOUT TEMPLATE] spread-text-safe-template.png" });
  promptParts.push({ index: idx++, type: "text", content: "↑ LAYOUT GUIDE — place LEFT page text in upper-left zone, RIGHT page text in upper-right zone. Keep text away from all edges and the centre spine. Do NOT draw any guides or template markers. ↑" });

  // 3. Location
  if (locationRef?.imageUrl && !locationRef.imageUrl.startsWith("data:image")) {
    promptParts.push({ index: idx++, type: "image", content: `[LOCATION] ${locationRef.imageUrl}` });
    promptParts.push({ index: idx++, type: "text", content: `↑ LOCATION: ${locationRef.name.toUpperCase()} — use this as the setting. ↑` });
  }

  // 4. Characters
  for (const c of charRefs) {
    const isAnimal = c.species && c.species !== "human";
    const animalProfile = (c.visualDetails as any)?.animalProfile;

    // Which image would be sent?
    const imgUrl = c.portraitUrl || c.fullBodyUrl || c.referenceUrl;
    const imgIsDataUrl = imgUrl?.startsWith("data:image");

    if (!imgUrl || imgIsDataUrl) {
      // Text-only fallback
      if (isAnimal && animalProfile) {
        promptParts.push({ index: idx++, type: "text", content: `CHARACTER: ${c.name.toUpperCase()} — a ${animalProfile.coatColour || ""} ${c.breed || c.species}.` });
      } else {
        const desc = c.appearance || c.description;
        if (desc) promptParts.push({ index: idx++, type: "text", content: `CHARACTER: ${c.name.toUpperCase()} — ${desc.slice(0, 80)}` });
      }
    } else {
      promptParts.push({ index: idx++, type: "image", content: `[${c.name.toUpperCase()}] ${imgUrl}` });
      if (isAnimal) {
        const coatNote = animalProfile?.coatColour ? ` — ${animalProfile.coatColour} coat` : "";
        promptParts.push({ index: idx++, type: "text", content: `↑ THIS IS ${c.name.toUpperCase()} (${c.breed || c.species}${coatNote}) ↑` });
      } else {
        promptParts.push({ index: idx++, type: "text", content: `↑ THIS IS ${c.name.toUpperCase()} ↑` });
      }

      // Outfit
      const outfit = outfitMap[c.id];
      if (outfit) {
        promptParts.push({ index: idx++, type: "text", content: `${c.name.toUpperCase()} wears: ${outfit.outfitDescription}. Ignore clothing in the reference.` });
      }
    }
  }

  // 5. Scene instructions
  const sceneText = `CREATE A DOUBLE-PAGE SPREAD ILLUSTRATION.\nOne continuous 16:9 landscape. Left half = left page, right half = right page.\n\nSCENE: ${spread?.sceneSummary ?? "Illustrate the story text below."}\n\nLEFT PAGE TEXT (upper-left area):\n${pair.left.text}\n\nRIGHT PAGE TEXT (upper-right area):\n${pair.right?.text ?? ""}\n\nHand-letter text into the illustration. Large, high-contrast, child-friendly.\nKeep text well inside safe zones. Outer edges will be trimmed.`;
  promptParts.push({ index: idx++, type: "text", content: sceneText });

  // Summary
  const imageCount = promptParts.filter((p) => p.type === "image").length;
  const textCount = promptParts.filter((p) => p.type === "text").length;
  const totalChars = promptParts.filter((p) => p.type === "text").reduce((sum, p) => sum + p.content.length, 0);

  return NextResponse.json({
    spreadIndex,
    pageLabel: `Pages ${pair.left.pageNumber}–${pair.right?.pageNumber ?? "end"}`,
    summary: {
      imageCount,
      textCount,
      totalTextChars: totalChars,
      model: "gemini-3-pro-image-preview",
      aspectRatio: "16:9",
      imageSize: "2K",
    },
    characters: charRefs.map((c) => ({
      name: c.name,
      species: c.species,
      imageSource: c.portraitUrl ? "portrait" : c.fullBodyUrl ? "fullBody" : c.referenceUrl ? "reference" : "NONE",
      imageUrl: c.portraitUrl || c.fullBodyUrl || c.referenceUrl || null,
      hasOutfit: !!outfitMap[c.id],
      outfit: outfitMap[c.id]?.outfitKey ?? null,
      // NOTE: appearance is in the DB but NOT sent to Gemini in v4 prompt
      appearanceInDB: c.appearance?.substring(0, 100) ?? null,
      sentToGemini: "IMAGE + NAME ONLY (no description text)",
    })),
    location: locationRef ? { name: locationRef.name, imageUrl: locationRef.imageUrl } : null,
    styleRef: styleRefUrl,
    sceneSummary: spread?.sceneSummary ?? null,
    promptParts,
  });
}