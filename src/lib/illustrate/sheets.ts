// src/lib/illustrate/sheets.ts
//
// The fixed anchors every picture is drawn and checked against:
//
// 1. Reference sheet per character: one image with a face close-up and the
//    same person full length, made from their card (how they're drawn in
//    this book) and real photo (likeness). One image carries face, body,
//    hair length and outfit, which matters because the image models only
//    take 4-5 character images per request. Cached PER STORY on
//    characters.visual_details.sheets[storyId] (a character can be in several
//    books with different styles) and rebuilt when the card or photo changes.
//
// 2. Style plate per story: the style sample with every person removed.
//    The style sample is sent as the style reference everywhere, and the
//    people in it (drawn before the cards were final) were leaking into
//    pages. Cached on story_style_guide.style_plate_url / style_plate_from.

import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { characters, storyCharacters, storyStyleGuide } from "@/db/schema";
import { generateImage } from "./gemini";
import { fetchImage, toPart, upload, urlToPart } from "./images";
import { artModel, type ArtModelKey } from "./models";
import type { CastRef } from "./plan";
import type { CastSheet } from "@/lib/characters/consistency";

const SHEET_VERSION = 1;
const PLATE_VERSION = 1;

const usable = (u: string | null | undefined): u is string => !!u && !u.startsWith("data:");

type SheetInfo = { url: string; from: string; v: number };

function sheetKey(c: { portraitImageUrl: string | null; referenceImageUrl: string | null }) {
  return `${c.portraitImageUrl ?? ""}|${c.referenceImageUrl ?? ""}|v${SHEET_VERSION}`;
}

export function currentSheetUrl(
  c: { portraitImageUrl: string | null; referenceImageUrl: string | null; visualDetails: any },
  storyId: string
): string | null {
  const s = c.visualDetails?.sheets?.[storyId] as SheetInfo | undefined;
  return s?.url && s.from === sheetKey(c) ? s.url : null;
}

/** Ids from `ids` that really belong to this story (characters are shared by all users). */
export async function storyCharacterIds(storyId: string, ids?: string[]): Promise<string[]> {
  const rows = await db
    .select({ id: storyCharacters.characterId })
    .from(storyCharacters)
    .where(
      ids && ids.length
        ? and(eq(storyCharacters.storyId, storyId), inArray(storyCharacters.characterId, ids))
        : eq(storyCharacters.storyId, storyId)
    );
  return [...new Set(rows.map((r) => r.id))];
}

export async function ensureReferenceSheet(
  characterId: string,
  storyId: string,
  opts: { modelKey?: ArtModelKey; line?: string | null } = {}
): Promise<string | null> {
  try {
    // Never touch a character that isn't in this story.
    if (!(await storyCharacterIds(storyId, [characterId])).includes(characterId)) {
      console.warn(`⚠️ ensureReferenceSheet: ${characterId} is not in story ${storyId}`);
      return null;
    }
    const c = await db.query.characters.findFirst({
      where: eq(characters.id, characterId),
      columns: { id: true, name: true, species: true, breed: true, appearance: true, portraitImageUrl: true, referenceImageUrl: true, visualDetails: true },
    });
    if (!c) return null;
    const existing = currentSheetUrl(c, storyId);
    if (existing) return existing;
    if (!usable(c.portraitImageUrl) && !usable(c.referenceImageUrl)) return null;

    const NAME = c.name.toUpperCase();
    const isAnimal = !!c.species && c.species !== "human";
    const parts: any[] = [];
    const photoParts: any[] = [];

    if (usable(c.portraitImageUrl)) {
      parts.push(await urlToPart(c.portraitImageUrl, 1536), {
        text: `↑ CHARACTER CARD for ${NAME}: exactly how ${c.name} is drawn in this book. Copy the clothes, colours, ${isAnimal ? "coat, markings" : "head covering, hairstyle"} and art style. ↑`,
      });
    }
    if (usable(c.referenceImageUrl)) {
      const img = await urlToPart(c.referenceImageUrl, 1024);
      const label = {
        text: `↑ REAL PHOTO of ${NAME}: the actual ${isAnimal ? "animal" : "person"}. Match the face, ${isAnimal ? "coat colour and markings" : "hair colour, length and texture, skin tone"} and build, rendered in the book's illustration style. ↑`,
      };
      parts.push(img, label);
      photoParts.push(img, label);
    }
    const plate = await ensureStylePlate(storyId, opts.modelKey);
    if (plate.url) {
      try {
        parts.push(await urlToPart(plate.url, 1024), {
          text: plate.clean
            ? "↑ STYLE: illustration technique only (brushwork, line, colour). ↑"
            : "↑ STYLE: illustration technique only (brushwork, line, colour). Ignore any people in it; they are not this character. ↑",
        });
      } catch {}
    }

    const line = opts.line || c.appearance || "";
    parts.push({
      text: `Create a CHARACTER REFERENCE SHEET of ONE ${isAnimal ? "animal" : "person"}: ${NAME}.
Two panels side by side on a plain white background with a clear white gap between them:
- LEFT panel: ${isAnimal ? "head" : "head and shoulders"}, facing the viewer, friendly neutral expression, face large and clear.
- RIGHT panel: the same ${isAnimal ? "animal" : "person"} full length from the top of the head to the ${isAnimal ? "paws and tail" : "feet"}, standing, facing the viewer, ${isAnimal ? "" : "arms relaxed, "}hair shown at its full length.
Both panels show the SAME single ${isAnimal ? "animal" : "person"} with identical ${isAnimal ? "coat and accessories" : "clothes and head covering"}. Correct proportions for their age and size.
${line ? `Details: ${line}` : ""}
Where the card and the photo disagree: clothes and colours come from the card; ${isAnimal ? "coat and markings" : "face, hair and skin tone"} come from the photo.
No text, labels, captions, borders, other people or props beyond what they wear or always carry.`,
    });

    const m = artModel(opts.modelKey);
    const out = await generateImage({ model: m.id, parts, aspectRatio: "3:2", imageSize: "2K", label: `sheet-${c.name}`, photoParts });
    const url = await upload(out.data, `flipwhizz/characters/${c.id}/sheet`);

    const info: SheetInfo = { url, from: sheetKey(c), v: SHEET_VERSION };
    await db
      .update(characters)
      .set({
        visualDetails: sql`jsonb_set(
          coalesce(${characters.visualDetails}, '{}'::jsonb),
          '{sheets}',
          coalesce(${characters.visualDetails}->'sheets', '{}'::jsonb) || ${JSON.stringify({ [storyId]: info })}::jsonb
        )`,
        updatedAt: new Date(),
      })
      .where(eq(characters.id, c.id));
    console.log(`🧾 Reference sheet for ${c.name}: ${url}`);
    return url;
  } catch (err) {
    console.warn(`⚠️ Reference sheet failed for ${characterId}:`, err);
    return null;
  }
}

/**
 * Style sample with all people removed. If that edit fails, the sample is
 * used as-is (clean: false, so callers can say "ignore the people in it"),
 * and the failure is remembered so it isn't retried on every call.
 */
export async function ensureStylePlate(storyId: string, modelKey?: ArtModelKey): Promise<{ url: string | null; clean: boolean }> {
  const style = await db.query.storyStyleGuide.findFirst({ where: eq(storyStyleGuide.storyId, storyId) });
  const sample = style?.sampleIllustrationUrl;
  if (!style || !usable(sample)) return { url: null, clean: false };
  const from = `${sample}|v${PLATE_VERSION}`;
  if (style.stylePlateUrl && style.stylePlateFrom === from) return { url: style.stylePlateUrl, clean: true };
  if (style.stylePlateFrom === `${from}|fallback`) return { url: sample, clean: false };
  try {
    const buf = await fetchImage(sample);
    const out = await generateImage({
      model: artModel(modelKey).id,
      parts: [
        await toPart(buf, 2048),
        {
          text: `Edit this illustration: remove EVERY person and animal from it and fill the spaces with background that continues naturally (ground, grass, trees, sky, furniture, whatever surrounds them). Keep the illustration style, brushwork, line work, colour palette, lighting and every non-living object exactly the same. No text.`,
        },
      ],
      aspectRatio: "16:9",
      imageSize: "2K",
      label: "style-plate",
    });
    const url = await upload(out.data, `flipwhizz/stories/${storyId}/style`);
    await db.update(storyStyleGuide).set({ stylePlateUrl: url, stylePlateFrom: from }).where(eq(storyStyleGuide.id, style.id));
    console.log(`🎨 Style plate for ${storyId}: ${url}`);
    return { url, clean: true };
  } catch (err) {
    console.warn("⚠️ Style plate failed; using the style sample as-is:", err);
    try {
      await db.update(storyStyleGuide).set({ stylePlateUrl: null, stylePlateFrom: `${from}|fallback` }).where(eq(storyStyleGuide.id, style.id));
    } catch {}
    return { url: sample, clean: false };
  }
}

/**
 * Cast references for a set of characters (sheet if current, else card),
 * limited to characters that belong to this story.
 * `outfits` optionally overrides what someone wears on this page.
 */
export async function loadCast(
  ids: string[],
  sheet: CastSheet | null,
  storyId: string,
  outfits: Record<string, string> = {}
): Promise<CastRef[]> {
  // Keep the caller's order (most important first).
  const wanted = [...new Set(ids.filter(Boolean))];
  const allowed = new Set(await storyCharacterIds(storyId, wanted));
  const uniq = wanted.filter((id) => allowed.has(id));
  if (uniq.length === 0) return [];
  const rows = await db
    .select({
      id: characters.id,
      name: characters.name,
      species: characters.species,
      breed: characters.breed,
      appearance: characters.appearance,
      portraitImageUrl: characters.portraitImageUrl,
      referenceImageUrl: characters.referenceImageUrl,
      visualDetails: characters.visualDetails,
    })
    .from(characters)
    .where(inArray(characters.id, uniq));
  return uniq
    .map((id) => rows.find((r) => r.id === id))
    .filter(Boolean)
    .map((r) => ({
      id: r!.id,
      name: r!.name,
      species: r!.species,
      breed: r!.breed,
      line:
        (sheet?.lines?.[r!.id] || r!.appearance || r!.name) +
        (outfits[r!.id] ? ` ON THIS PAGE wearing: ${outfits[r!.id]} (this outfit is correct here, even if the reference shows other clothes).` : ""),
      sheetUrl: currentSheetUrl(r!, storyId),
      cardUrl: usable(r!.portraitImageUrl) ? r!.portraitImageUrl : null,
      photoUrl: usable(r!.referenceImageUrl) ? r!.referenceImageUrl : null,
    }));
}
