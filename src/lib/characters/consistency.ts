// src/lib/characters/consistency.ts
//
// Keeps characters looking the same on every spread.
//
// 1. getCastSheet(storyId)
//    One dense, specific line per character (age, height relative to the
//    others, hair LENGTH + texture, skin, eyes, signature features, default
//    outfit) plus a relative-size note for the whole cast. Built once by a
//    vision model that looks at the actual portraits, cached per story in
//    characters.visual_details.castSheets[storyId], and rebuilt automatically
//    whenever a portrait, description or default outfit changes (hash).
//
// 2. ensureFullBody(characterId, storyId)
//    A head-to-toe image of the character drawn from their portrait, so the
//    spread model can see height, proportions, hair length and outfit, not
//    just a face. Cached in characters.full_body_image_url and regenerated
//    when the portrait changes (visual_details.fullBodyFrom).
//
// 3. loadRefCharacters / planCharacterImages / pushCharacterReferenceParts
//    One place that decides which pictures of a character go to the image
//    model (portrait, then the REAL reference photo, then full body) within
//    Gemini's input-image budget, with the same wording for spreads and the
//    cover. The reference photo is what makes the drawing look like the
//    actual child; without it, every page is a copy of a copy.
//
// Everything fails soft: on any error the spread or cover still generates
// the way it did before.

import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from "@google/genai";
import sharp from "sharp";
import { createHash } from "node:crypto";
import { Readable } from "node:stream";
import { v2 as cloudinary } from "cloudinary";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  characters,
  storyCharacters,
  characterStoryOutfits,
  storyStyleGuide,
} from "@/db/schema";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
  api_key: process.env.CLOUDINARY_API_KEY!,
  api_secret: process.env.CLOUDINARY_API_SECRET!,
});

const gemini = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
const TEXT_MODEL = "gemini-2.5-flash";
const IMAGE_MODEL = "gemini-3-pro-image-preview";
const MAX_SHEET_IMAGES = 40; // flash handles many; 13 characters x 2 pictures fits
const SHEET_VERSION = 3; // bump to force every story to rebuild its sheet
// Bump to force every full-body image to be redrawn. v2: v1 images were drawn
// from sheet lines that copied clothes from the written description, so they
// could disagree with the character card.
const FULL_BODY_VERSION = 2;

// Gemini 3 Pro Image: "blend up to 14 images" and "maintain the appearance
// of up to five people". The limit is 5 PEOPLE per request, not 5 pictures:
// each of those people can have several pictures (portrait, real photo,
// full body) as long as the request stays within 14 images in total.
export const MAX_INPUT_IMAGES = 14;
export const MAX_PEOPLE_PER_REQUEST = 5;
// Reference photos come straight off phones (several MB each); shrink before
// sending so five of them don't blow the request size limit.
const MAX_REF_PX = 1024;

export type CastSheet = {
  hash: string;
  lines: Record<string, string>; // characterId -> sheet line
  sizeOrder: string[]; // names, tallest -> shortest
  sizeNotes: string;
  fallback?: boolean; // true when built from text only after a model error
};

type CastMember = {
  id: string;
  name: string;
  species: string | null;
  breed: string | null;
  appearance: string | null;
  description: string | null;
  portraitImageUrl: string | null;
  referenceImageUrl: string | null;
  visualDetails: any;
  role: string | null;
  defaultOutfit: string | null;
};

/* -------------------------------------------------------------------------- */
/*                                   HELPERS                                  */
/* -------------------------------------------------------------------------- */

function guessMime(url: string) {
  const s = url.toLowerCase().split("?")[0];
  if (s.endsWith(".png")) return "image/png";
  if (s.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}

async function imagePart(url: string, maxPx: number | null = null) {
  if (!url || url.startsWith("data:")) throw new Error("not a fetchable URL");
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (maxPx) {
    try {
      // .rotate() applies the EXIF orientation first, so phone photos taken
      // sideways arrive the right way up.
      const out = await sharp(buf)
        .rotate()
        .resize({ width: maxPx, height: maxPx, fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toBuffer();
      return { inlineData: { data: out.toString("base64"), mimeType: "image/jpeg" } };
    } catch (err) {
      console.warn("⚠️ Image resize failed, sending original:", err);
    }
  }
  return { inlineData: { data: buf.toString("base64"), mimeType: guessMime(url) } };
}

/** Public wrapper: fetch an image for Gemini, shrunk to a sane size. */
export async function fetchImagePart(url: string, maxPx: number = MAX_REF_PX) {
  return imagePart(url, maxPx);
}

function responseText(response: any): string {
  const parts = response?.candidates?.[0]?.content?.parts ?? [];
  return parts
    .filter((p: any) => typeof p.text === "string" && !p.thought)
    .map((p: any) => p.text)
    .join("\n")
    .trim();
}

function parseJson<T>(text: string): T | null {
  const cleaned = text.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (!m) return null;
    try {
      return JSON.parse(m[0]) as T;
    } catch {
      return null;
    }
  }
}

function clean(s: string | null | undefined) {
  return (s ?? "").replace(/\s+/g, " ").trim();
}

async function loadCast(storyId: string): Promise<CastMember[]> {
  const rows = await db
    .select({
      id: characters.id,
      name: characters.name,
      species: characters.species,
      breed: characters.breed,
      appearance: characters.appearance,
      description: characters.description,
      portraitImageUrl: characters.portraitImageUrl,
      referenceImageUrl: characters.referenceImageUrl,
      visualDetails: characters.visualDetails,
      role: storyCharacters.role,
    })
    .from(storyCharacters)
    .innerJoin(characters, eq(characters.id, storyCharacters.characterId))
    .where(eq(storyCharacters.storyId, storyId));

  if (rows.length === 0) return [];

  const outfits = await db
    .select({
      characterId: characterStoryOutfits.characterId,
      outfitDescription: characterStoryOutfits.outfitDescription,
    })
    .from(characterStoryOutfits)
    .where(
      and(
        eq(characterStoryOutfits.storyId, storyId),
        eq(characterStoryOutfits.isDefault, true),
        inArray(
          characterStoryOutfits.characterId,
          rows.map((r) => r.id)
        )
      )
    );

  const outfitBy = new Map(outfits.map((o) => [o.characterId, o.outfitDescription]));

  // A character can be linked twice (bad data); keep one row each.
  const seen = new Set<string>();
  return rows
    .filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)))
    .map((r) => ({ ...r, defaultOutfit: outfitBy.get(r.id) ?? null }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

function hashCast(cast: CastMember[]) {
  const payload = cast.map((c) => [
    c.id,
    c.name,
    c.species,
    c.breed,
    clean(c.appearance),
    clean(c.description),
    c.portraitImageUrl ?? "",
    c.referenceImageUrl ?? "",
    clean(c.defaultOutfit),
  ]);
  return createHash("sha1")
    .update(JSON.stringify({ v: SHEET_VERSION, payload }))
    .digest("hex");
}

function fallbackSheet(cast: CastMember[], hash: string): CastSheet {
  const lines: Record<string, string> = {};
  for (const c of cast) {
    const kind = c.species && c.species !== "human" ? ` (${c.breed || c.species})` : "";
    const outfit = c.defaultOutfit ? ` Default outfit: ${clean(c.defaultOutfit)}.` : "";
    lines[c.id] = `${c.name}${kind}: ${clean(c.appearance) || clean(c.description)}.${outfit}`;
  }
  return { hash, lines, sizeOrder: [], sizeNotes: "", fallback: true };
}

async function saveSheet(storyId: string, cast: CastMember[], sheet: CastSheet) {
  for (const c of cast) {
    const entry = {
      [storyId]: {
        hash: sheet.hash,
        line: sheet.lines[c.id] ?? "",
        sizeOrder: sheet.sizeOrder,
        sizeNotes: sheet.sizeNotes,
        builtAt: new Date().toISOString(),
      },
    };
    // Atomic jsonb merge so we never clobber animalProfile, photoAnalysis etc.
    await db
      .update(characters)
      .set({
        visualDetails: sql`jsonb_set(
          coalesce(${characters.visualDetails}, '{}'::jsonb),
          '{castSheets}',
          coalesce(${characters.visualDetails}->'castSheets', '{}'::jsonb) || ${JSON.stringify(entry)}::jsonb
        )`,
      })
      .where(eq(characters.id, c.id));
  }
}

function readCachedSheet(storyId: string, cast: CastMember[], hash: string): CastSheet | null {
  const lines: Record<string, string> = {};
  let sizeOrder: string[] = [];
  let sizeNotes = "";
  for (const c of cast) {
    const cached = c.visualDetails?.castSheets?.[storyId];
    if (!cached || cached.hash !== hash || !cached.line) return null;
    lines[c.id] = cached.line;
    sizeOrder = cached.sizeOrder ?? sizeOrder;
    sizeNotes = cached.sizeNotes ?? sizeNotes;
  }
  return { hash, lines, sizeOrder, sizeNotes };
}

/* -------------------------------------------------------------------------- */
/*                                 CAST SHEET                                 */
/* -------------------------------------------------------------------------- */

export async function getCastSheet(storyId: string): Promise<CastSheet | null> {
  const cast = await loadCast(storyId);
  if (cast.length === 0) return null;

  const hash = hashCast(cast);
  const cached = readCachedSheet(storyId, cast, hash);
  if (cached) return cached;

  try {
    const parts: any[] = [];
    let imagesSent = 0;

    // Main characters' pictures first, so they get the image budget.
    const ordered = [...cast].sort((a, b) => {
      // Roles in the DB are main / supporting / minor (older rows: protagonist).
      const rank = (r: string | null) => {
        const v = (r ?? "").toLowerCase();
        if (v === "main" || v === "protagonist") return 0;
        if (v === "supporting") return 1;
        return 2;
      };
      return rank(a.role) - rank(b.role);
    });

    for (const c of ordered) {
      if (c.referenceImageUrl && imagesSent < MAX_SHEET_IMAGES) {
        try {
          parts.push(await imagePart(c.referenceImageUrl, MAX_REF_PX));
          parts.push({
            text: `↑ REAL PHOTO of ${c.name.toUpperCase()} (id ${c.id}). Source of truth for face, hair, skin and build.`,
          });
          imagesSent++;
        } catch {
          /* fall through to the portrait */
        }
      }
      if (c.portraitImageUrl && imagesSent < MAX_SHEET_IMAGES) {
        try {
          parts.push(await imagePart(c.portraitImageUrl, MAX_REF_PX));
          parts.push({
            text: `↑ ${c.name.toUpperCase()} (id ${c.id}) as illustrated in this book. Shows outfit and art style; where it disagrees with the photo, the photo wins.`,
          });
          imagesSent++;
        } catch {
          /* text-only for this character */
        }
      }
    }

    const roster = cast
      .map((c) => {
        const kind = c.species && c.species !== "human" ? `${c.breed || c.species}` : "human";
        return [
          `ID: ${c.id}`,
          `NAME: ${c.name}`,
          `KIND: ${kind}`,
          `ROLE: ${c.role ?? "unknown"}`,
          `APPEARANCE: ${clean(c.appearance) || "(none)"}`,
          `DESCRIPTION: ${clean(c.description) || "(none)"}`,
          `DEFAULT OUTFIT: ${clean(c.defaultOutfit) || "(none given)"}`,
        ].join("\n");
      })
      .join("\n\n");

    parts.push({
      text: `You are the continuity supervisor for a children's picture book. The illustrator draws every double-page spread separately, so characters drift (hair gets shorter, sizes change). Write a CHARACTER SHEET that will be pasted into every spread prompt so each character looks identical on every page.

CAST:
${roster}

For EACH character write ONE dense line (max ~70 words) covering:
- approximate age
- height in cm AND compared with the rest of the cast (e.g. "the top of her head reaches Yosor's chin")
- build
- hair: colour, LENGTH measured against the body (e.g. "falls to mid-back"), texture (e.g. "soft loose ringlet curls"), usual style. Never just "long hair".
- skin tone, eye colour
- face: shape, eyebrows, nose, mouth, anything that makes this person recognisable (e.g. "round face, full cheeks, wide gap-toothed smile, thick straight brows")
- signature features (glasses, freckles, gap tooth, birthmark, accessories)
- default outfit, only if given or clearly visible
For animals: species/breed, size against the children (e.g. "comes up to Talia's knee"), coat colour, pattern, markings.

Rules:
- A REAL PHOTO is the source of truth for everything it shows. Never contradict it.
- An illustrated portrait shows the outfit and art style. Use it only for things the photo does not show.
- OUTFIT: if a DEFAULT OUTFIT is given, use it. Otherwise describe EXACTLY the clothes, colours and head covering in the illustrated portrait. If the written APPEARANCE or DESCRIPTION mentions different clothes (e.g. "wears dresses" but the portrait shows trousers), IGNORE the written clothes. The portrait is how this character is drawn throughout the book.
- HAIR: copy the length from the picture; if the hair runs out of frame, say it continues beyond the shoulders rather than guessing shorter.
- Written text fills in what the picture cannot show (height, outfit, age).
- Be concrete and visual. No personality, no story events.
- Heights must be mutually consistent across the whole cast. If heights are not stated, infer them from age and keep them plausible.
- Do not invent clothing that is neither given nor visible.

Return JSON only:
{
  "characters": [{ "id": "<ID>", "line": "<sheet line starting with the name>" }],
  "sizeOrder": ["<name tallest>", "...", "<name shortest>"],
  "sizeNotes": "<1-2 sentences on relative heights, e.g. 'Yosor is about a head taller than Talia; Pip the cat reaches their knees.'>"
}`,
    });

    const response = await gemini.models.generateContent({
      model: TEXT_MODEL,
      contents: [{ role: "user", parts }],
      config: { temperature: 0.2, responseMimeType: "application/json" },
    });

    const parsed = parseJson<{
      characters?: { id: string; line: string }[];
      sizeOrder?: string[];
      sizeNotes?: string;
    }>(responseText(response));

    if (!parsed?.characters?.length) throw new Error("cast sheet: empty or unparseable reply");

    const fb = fallbackSheet(cast, hash);
    const lines: Record<string, string> = {};
    for (const c of cast) {
      const hit = parsed.characters.find((x) => x.id === c.id);
      lines[c.id] = clean(hit?.line) || fb.lines[c.id];
    }

    const sheet: CastSheet = {
      hash,
      lines,
      sizeOrder: Array.isArray(parsed.sizeOrder) ? parsed.sizeOrder.map(clean).filter(Boolean) : [],
      sizeNotes: clean(parsed.sizeNotes),
    };

    await saveSheet(storyId, cast, sheet);
    console.log(`🧾 Cast sheet built for story ${storyId} (${cast.length} characters, ${imagesSent} images)`);
    return sheet;
  } catch (err) {
    // Not cached, so the next spread tries again.
    console.warn("⚠️ Cast sheet build failed, using text fallback:", err);
    return fallbackSheet(cast, hash);
  }
}

/** The text block that goes into a spread prompt. */
export function castSheetBlock(
  sheet: CastSheet | null,
  characterIds: string[]
): string {
  if (!sheet) return "";
  const lines = characterIds.map((id) => sheet.lines[id]).filter(Boolean);
  if (lines.length === 0) return "";

  const size =
    sheet.sizeNotes || sheet.sizeOrder.length > 1
      ? `\nRELATIVE SIZES (identical on every page, never change them):${
          sheet.sizeNotes ? ` ${sheet.sizeNotes}` : ""
        }${sheet.sizeOrder.length > 1 ? ` Tallest to shortest: ${sheet.sizeOrder.join(" > ")}.` : ""}`
      : "";

  return `CHARACTER SHEET (must match exactly on every page; hair length, hair texture, skin tone, height and proportions never change):
${lines.map((l) => `- ${l}`).join("\n")}${size}`;
}

/* -------------------------------------------------------------------------- */
/*                                 FULL BODY                                  */
/* -------------------------------------------------------------------------- */

/** True when the stored full-body image was drawn from the current portrait. */
export function fullBodyIsCurrent(c: {
  fullBodyUrl?: string | null;
  fullBodyImageUrl?: string | null;
  portraitUrl?: string | null;
  portraitImageUrl?: string | null;
  referenceUrl?: string | null;
  referenceImageUrl?: string | null;
  visualDetails?: any;
}) {
  const full = c.fullBodyUrl ?? c.fullBodyImageUrl;
  const source =
    c.portraitUrl ?? c.portraitImageUrl ?? c.referenceUrl ?? c.referenceImageUrl ?? null;
  return (
    !!full &&
    !!source &&
    c.visualDetails?.fullBodyFrom === source &&
    c.visualDetails?.fullBodyVersion === FULL_BODY_VERSION
  );
}

async function uploadFullBody(base64: string, characterId: string) {
  const buffer = Buffer.from(base64, "base64");
  return new Promise<string>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: `flipwhizz/characters/${characterId}/fullbody`,
        resource_type: "image",
        format: "jpeg",
      },
      (err, res) => (err ? reject(err) : resolve(res?.secure_url ?? ""))
    );
    Readable.from(buffer).pipe(stream);
  });
}

export async function ensureFullBody(
  characterId: string,
  storyId: string,
  sheet?: CastSheet | null
): Promise<string | null> {
  try {
    const c = await db.query.characters.findFirst({
      where: eq(characters.id, characterId),
      columns: {
        id: true,
        name: true,
        species: true,
        breed: true,
        appearance: true,
        portraitImageUrl: true,
        referenceImageUrl: true,
        fullBodyImageUrl: true,
        visualDetails: true,
      },
    });
    if (!c) return null;

    const source = c.portraitImageUrl || c.referenceImageUrl;
    if (!source || source.startsWith("data:")) return null;
    if (fullBodyIsCurrent(c)) return c.fullBodyImageUrl!;

    const style = await db.query.storyStyleGuide.findFirst({
      where: eq(storyStyleGuide.storyId, storyId),
      columns: { sampleIllustrationUrl: true, summary: true },
    });

    const castSheet = sheet ?? (await getCastSheet(storyId));
    const line = castSheet?.lines[c.id] || clean(c.appearance);
    const isAnimal = !!c.species && c.species !== "human";

    const parts: any[] = [
      await imagePart(source),
      {
        text: `↑ THIS IS ${c.name.toUpperCase()}, exactly as drawn on their character card. Reproduce exactly this character: same face, same hair colour, length and texture, same skin tone, same ${isAnimal ? "coat and markings" : "clothes, colours and head covering"}, same art style. This picture overrides any written description below. ↑`,
      },
    ];

    const styleUrl = style?.sampleIllustrationUrl;
    if (styleUrl && !styleUrl.startsWith("data:")) {
      try {
        parts.push(await imagePart(styleUrl));
        parts.push({ text: "↑ STYLE REFERENCE: match this illustration style." });
      } catch {
        /* style ref optional */
      }
    }

    parts.push({
      text: `Draw a FULL-BODY CHARACTER REFERENCE of ${c.name} for a children's picture book.

${line ? `CHARACTER SHEET: ${line}\n` : ""}${style?.summary ? `STYLE: ${clean(style.summary)}\n` : ""}
REQUIREMENTS:
- Whole body visible from the top of the head to the feet${isAnimal ? " / paws and tail" : ""}, with a small margin all round
- Standing in a relaxed neutral pose, body turned slightly towards the viewer
- Natural, accurate proportions for their age and size; hair shown at its full length
- Clothes, colours and head covering exactly as in the character picture above; where the picture is cropped, continue the same outfit naturally
- Plain white background, no scenery, no props unless part of the outfit
- Only this one character. No text, labels or watermark.`,
    });

    let data: string | null = null;
    for (let attempt = 1; attempt <= 2 && !data; attempt++) {
      const response = await gemini.models.generateContent({
        model: IMAGE_MODEL,
        contents: [{ role: "user", parts }],
        config: {
          responseModalities: ["IMAGE"],
          imageConfig: { aspectRatio: "3:4", imageSize: "1K" },
          safetySettings: [
            { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
            { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
            { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
            { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
          ],
        },
      });
      const img = (response?.candidates?.[0]?.content?.parts ?? []).find(
        (p: any) => p.inlineData?.data && !p.thought
      );
      data = img?.inlineData?.data ?? null;
      if (!data && attempt === 1) await new Promise((r) => setTimeout(r, 1500));
    }
    if (!data) throw new Error("no image returned");

    const url = await uploadFullBody(data, c.id);
    if (!url) throw new Error("upload returned no URL");

    await db
      .update(characters)
      .set({
        fullBodyImageUrl: url,
        visualDetails: sql`coalesce(${characters.visualDetails}, '{}'::jsonb) || ${JSON.stringify({ fullBodyFrom: source, fullBodyVersion: FULL_BODY_VERSION })}::jsonb`,
        updatedAt: new Date(),
      })
      .where(eq(characters.id, c.id));

    console.log(`🧍 Full-body reference created for ${c.name}: ${url}`);
    return url;
  } catch (err) {
    console.warn(`⚠️ Full-body generation failed for character ${characterId}:`, err);
    return null;
  }
}

/* -------------------------------------------------------------------------- */
/*                    REFERENCE IMAGES FOR SPREADS AND COVERS                 */
/* -------------------------------------------------------------------------- */

export type RefCharacter = {
  id: string;
  name: string;
  species: string | null;
  breed: string | null;
  appearance: string | null;
  portraitImageUrl: string | null;
  referenceImageUrl: string | null;
  fullBodyImageUrl: string | null;
  visualDetails: any;
};

export type PlannedImage = {
  characterId: string;
  name: string;
  kind: "portrait" | "photo" | "fullBody";
  url: string;
};

export async function loadRefCharacters(ids: string[]): Promise<RefCharacter[]> {
  if (ids.length === 0) return [];
  const rows = await db
    .select({
      id: characters.id,
      name: characters.name,
      species: characters.species,
      breed: characters.breed,
      appearance: characters.appearance,
      portraitImageUrl: characters.portraitImageUrl,
      referenceImageUrl: characters.referenceImageUrl,
      fullBodyImageUrl: characters.fullBodyImageUrl,
      visualDetails: characters.visualDetails,
    })
    .from(characters)
    .where(inArray(characters.id, ids));
  // Keep the caller's order (featured first).
  return ids.map((id) => rows.find((r) => r.id === id)).filter(Boolean) as RefCharacter[];
}

function usable(url: string | null | undefined): url is string {
  return !!url && !url.startsWith("data:");
}

/**
 * Decide which pictures of each character to send, within `budget` images.
 * Round-robin so every character gets its portrait before anyone gets a
 * second picture: portrait (in-style face) -> real photo (likeness) ->
 * full body (height, proportions, hair length).
 * A character with no portrait falls back to photo, then full body, as the
 * first picture, so nobody is sent with no image at all.
 */
export function planCharacterImages(chars: RefCharacter[], budget: number): PlannedImage[] {
  const out: PlannedImage[] = [];
  const sent = new Map<string, Set<string>>();
  const mark = (c: RefCharacter, kind: PlannedImage["kind"], url: string) => {
    if (!sent.has(c.id)) sent.set(c.id, new Set());
    sent.get(c.id)!.add(kind);
    out.push({ characterId: c.id, name: c.name, kind, url });
  };
  const has = (c: RefCharacter, kind: string) => sent.get(c.id)?.has(kind) ?? false;

  // Pass 1: one picture each, best available.
  for (const c of chars) {
    if (usable(c.portraitImageUrl)) mark(c, "portrait", c.portraitImageUrl);
    else if (usable(c.referenceImageUrl)) mark(c, "photo", c.referenceImageUrl);
    else if (usable(c.fullBodyImageUrl)) mark(c, "fullBody", c.fullBodyImageUrl);
  }

  // Pass 2: the real photo for likeness.
  for (const c of chars) {
    if (out.length >= budget) break;
    if (!has(c, "photo") && usable(c.referenceImageUrl)) mark(c, "photo", c.referenceImageUrl);
  }

  // Pass 3: full body for proportions, only if drawn from the current portrait.
  for (const c of chars) {
    if (out.length >= budget) break;
    if (!has(c, "fullBody") && usable(c.fullBodyImageUrl) && fullBodyIsCurrent(c)) {
      mark(c, "fullBody", c.fullBodyImageUrl);
    }
  }

  return out;
}

export function characterImageLabel(img: PlannedImage, c: RefCharacter, sheetLine?: string | null): string {
  const NAME = c.name.toUpperCase();
  const isAnimal = !!c.species && c.species !== "human";
  const kind = isAnimal ? ` (${c.breed || c.species})` : "";
  const who = isAnimal ? "animal" : "person";
  switch (img.kind) {
    case "photo":
      return `↑ REAL PHOTO of ${NAME}${kind}. This is the actual ${who} the book is about. ${c.name} must be recognisable as this ${who}: same face shape, eyes, nose, mouth, skin tone, ${
        isAnimal ? "coat colour and markings" : "hair colour, hair length and hair texture"
      }. Keep the book's illustration style; do not make it photorealistic. ↑`;
    case "fullBody":
      return `↑ ${NAME} FULL BODY: use this for height, body proportions, hair length and outfit. ↑`;
    default:
      return `↑ FEATURED CHARACTER: ${NAME}${kind}. This is how ${c.name} is drawn in this book.${
        sheetLine ? ` ${sheetLine}` : ""
      } Preserve this character's identity exactly. ↑`;
  }
}

/**
 * Push the planned pictures (+ labels) for these characters onto `parts`.
 * Returns the photo parts separately so a caller can retry without them if
 * the image model refuses a request that contains real photos.
 */
export async function pushCharacterReferenceParts(
  parts: any[],
  chars: RefCharacter[],
  budget: number,
  sheet?: CastSheet | null
): Promise<{ photoParts: any[]; missing: string[]; counts: Record<string, number> }> {
  const plan = planCharacterImages(chars, budget);
  const photoParts: any[] = [];
  const counts: Record<string, number> = { portrait: 0, photo: 0, fullBody: 0 };
  const got = new Set<string>();

  for (const img of plan) {
    const c = chars.find((x) => x.id === img.characterId)!;
    try {
      const part = await imagePart(img.url, MAX_REF_PX);
      const label = { text: characterImageLabel(img, c, sheet?.lines?.[c.id]) };
      parts.push(part, label);
      if (img.kind === "photo") photoParts.push(part, label);
      counts[img.kind]++;
      got.add(c.id);
    } catch (err) {
      console.warn(`⚠️ Could not fetch ${img.kind} for ${c.name}:`, err);
    }
  }

  const missing = chars.filter((c) => !got.has(c.id)).map((c) => c.name);
  return { photoParts, missing, counts };
}

/** Drop the real-photo parts (by identity) for a retry. */
export function withoutParts(parts: any[], drop: any[]): any[] {
  const set = new Set(drop);
  return parts.filter((p) => !set.has(p));
}
