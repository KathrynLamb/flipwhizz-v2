// src/lib/illustrate/checkfix.ts
//
// Model calls for the check-and-fix pipeline:
//   inspectArt   - vision: find every person/animal, match to the cast,
//                  list differences from their reference
//   fixCrop      - redraw ONE person inside a crop with their references
//   addMissing   - whole-picture edit to add characters nobody drew
//   letterArt    - hand-letter the page text onto finished art (Pro)
//   readText     - vision: transcribe lettering with boxes
//   compositeText- paste only the lettered areas onto the checked art
//
// Every function takes and returns image Buffers; uploads happen in the
// Inngest steps that call these.

import { generateImage, generateJson } from "./gemini";
import { box2dToPx, planCrop, judgeLettering, isValidBox2d, type Box2d, type TextBlock, type TextVerdict, type CropPlan } from "./geometry";
import { normaliseReport, type CastRef, type CropFix, type InspectReport } from "./plan";
import { enlarge, extract, imageSize, matchSize, pastePatch, toPart, urlToPart } from "./images";
import { LETTERING_MODEL } from "./models";

const kindOf = (c: CastRef) => (c.species && c.species !== "human" ? `${c.breed || c.species}` : "person");

/* -------------------------------------------------------------------------- */
/*                                  INSPECT                                   */
/* -------------------------------------------------------------------------- */

export async function inspectArt(args: {
  art: Buffer;
  cast: CastRef[]; // everyone who might appear (featured, background, forbidden)
  expectedIds: string[]; // who must appear
  sceneHint?: string;
}): Promise<InspectReport> {
  const { art, cast, expectedIds } = args;
  const parts: any[] = [await toPart(art, 2048), { text: "IMAGE A: the illustration to check." }];

  for (const c of cast) {
    const url = c.sheetUrl || c.cardUrl;
    if (!url) continue;
    try {
      parts.push(await urlToPart(url, 768));
      parts.push({ text: `REFERENCE for ${c.name.toUpperCase()} (id: ${c.id}, ${kindOf(c)}). ${c.line}` });
    } catch {
      parts.push({ text: `REFERENCE for ${c.name.toUpperCase()} (id: ${c.id}, ${kindOf(c)}), text only: ${c.line}` });
    }
  }

  const expectedNames = cast.filter((c) => expectedIds.includes(c.id)).map((c) => c.name);
  parts.push({
    text: `You are the continuity checker for a personalised children's picture book. Every character must look identical on every page.

Find EVERY person and animal in IMAGE A, including small, partly hidden, faded or half-drawn ones.
For each one:
- characterId: which cast member it is (use the ids above), matched by clothes, hair, colours, build, age and species. null if it is nobody from the cast.
- name: the cast member's name, or a short description if unknown.
- box_2d: a tight box around their WHOLE body as [ymin, xmin, ymax, xmax], normalised 0-1000.
- issues: concrete differences from their REFERENCE that a parent would notice: hair colour, hair length, hair texture or style, skin tone, facial hair, glasses, head covering, each clothing item and colour, apparent age, build, height compared with the others, species, breed, coat colour and markings. Write each as "what it is in the picture; what the reference shows".
  Ignore pose, expression, viewing angle, lighting and normal art-style rendering.
  If a reference says what someone wears ON THIS PAGE, judge their clothes against that, not against the reference picture.
- Also list as issues any rendering faults on that figure: see-through or faded parts, a half-drawn or cut-off body, a head or limb that doesn't join up, two figures merged together, extra or missing limbs.
- matches: true only if there are no such differences or faults.
- isDuplicate: true if this cast member appears more than once and this is NOT the copy that best matches the scene. Exactly one copy of each character is the original.
${args.sceneHint ? `\nScene: ${args.sceneHint}` : ""}
Expected in this picture: ${expectedNames.length ? expectedNames.join(", ") : "(no specific cast members)"}.

Return JSON only:
{"people":[{"characterId":"id or null","name":"...","box_2d":[0,0,0,0],"matches":true,"isDuplicate":false,"issues":["..."]}],"missing":["ids of expected characters you could not find"]}`,
  });

  const raw = await generateJson<any>(parts, "inspect");
  return normaliseReport(raw, cast, expectedIds);
}

/* -------------------------------------------------------------------------- */
/*                                  FIX CROP                                  */
/* -------------------------------------------------------------------------- */

async function refParts(c: CastRef): Promise<{ parts: any[]; photoParts: any[] }> {
  const parts: any[] = [];
  const photoParts: any[] = [];
  const NAME = c.name.toUpperCase();
  if (c.sheetUrl) {
    try {
      parts.push(await urlToPart(c.sheetUrl, 1536), { text: `↑ REFERENCE SHEET for ${NAME}: their face and their whole body as drawn in this book. ↑` });
    } catch {}
  }
  if (!c.sheetUrl && c.cardUrl) {
    try {
      parts.push(await urlToPart(c.cardUrl, 1536), { text: `↑ CHARACTER CARD for ${NAME}: how they are drawn in this book. ↑` });
    } catch {}
  }
  if (c.photoUrl) {
    try {
      const img = await urlToPart(c.photoUrl, 1024);
      const label = { text: `↑ REAL PHOTO of ${NAME}: the actual ${kindOf(c)} the book is about. Match this likeness, in the book's illustration style (never photorealistic). ↑` };
      parts.push(img, label);
      photoParts.push(img, label);
    } catch {}
  }
  return { parts, photoParts };
}

export async function fixCrop(args: {
  art: Buffer;
  fix: CropFix;
  cast: CastRef[];
  model: string;
  styleBlock: string;
  /** The image already has lettering/titles that must survive (covers, lettered pages). */
  preserveText?: boolean;
}): Promise<{ patch: Buffer; plan: CropPlan; model: string; grow: number }> {
  const { art, fix, cast } = args;
  const { width: W, height: H } = await imageSize(art);
  const person = box2dToPx(fix.box_2d, W, H);
  const plan = planCrop(person, W, H);
  const crop = await enlarge(await extract(art, plan.crop), 1280);

  // Where the target is inside the crop, as a 0-1000 box: at image edges the
  // target is often not in the centre, and group scenes have neighbours.
  const sb = plan.subject;
  const cw = plan.crop.width;
  const ch = plan.crop.height;
  const where = [
    Math.round((sb.top / ch) * 1000),
    Math.round((sb.left / cw) * 1000),
    Math.round(((sb.top + sb.height) / ch) * 1000),
    Math.round(((sb.left + sb.width) / cw) * 1000),
  ];
  const target = `the figure inside the box [ymin, xmin, ymax, xmax] = [${where.join(", ")}] (0-1000 of this image)`;
  const parts: any[] = [await toPart(crop, 1536), { text: `↑ IMAGE TO EDIT: a section cut from a page of the book. The one to change is ${target}. ↑` }];
  let photoParts: any[] = [];
  let instruction = "";

  if (fix.kind === "likeness" || fix.kind === "replace") {
    const c = cast.find((x) => x.id === fix.characterId);
    if (!c) throw new Error(`fixCrop: unknown character ${fix.characterId}`);
    const refs = await refParts(c);
    parts.push(...refs.parts);
    photoParts = refs.photoParts;
    const NAME = c.name.toUpperCase();
    instruction =
      fix.kind === "likeness"
        ? `Edit the first image. ${target[0].toUpperCase() + target.slice(1)} is ${NAME}. Redraw ONLY ${NAME} so they exactly match their reference: ${fix.issues.join("; ")}.
Character sheet: ${c.line}
Keep their position, pose, gesture, size and what they are doing. Keep the lighting and illustration style of the first image.`
        : `Edit the first image. ${target[0].toUpperCase() + target.slice(1)} is a mistake and must become ${NAME}. Replace that figure with ${NAME}, exactly as in their reference, in a natural pose that fits what is happening around them, at the right size for ${NAME} and in the same place.
Character sheet: ${c.line}`;
  } else {
    instruction = `Edit the first image. Remove ${target} completely, including their shadow, and fill the space with background that continues naturally from its surroundings (ground, grass, trees, sky, furniture: whatever is around it).`;
  }

  parts.push({
    text: `${instruction}
Change nothing else: every other person, animal and object and the whole background stay exactly as they are. Do not add anyone.
${args.preserveText ? "Keep any existing text, titles or lettering exactly as they are, letter for letter." : "No text, letters or words."}
Style: ${args.styleBlock}`,
  });

  const longSide = Math.max(plan.crop.width, plan.crop.height);
  const out = await generateImage({
    model: args.model,
    parts,
    aspectRatio: plan.aspect,
    imageSize: longSide > 1100 ? "2K" : "1K",
    label: `fix-${fix.kind}`,
    photoParts,
  });
  // Replacements can be a different size (an adult where a child was) and
  // removals leave shadows: give them a bigger blend area.
  const grow = fix.kind === "replace" ? 0.35 : fix.kind === "remove" ? 0.25 : 0.12;
  return { patch: out.data, plan, model: out.model, grow };
}

/** Paste fixed patches (from the same wave) onto the art in order. */
export async function applyPatches(art: Buffer, patches: { patch: Buffer; plan: CropPlan }[]): Promise<Buffer> {
  let out = art;
  for (const p of patches) out = await pastePatch(out, p.patch, p.plan.crop, p.plan.subject);
  return out;
}

/* -------------------------------------------------------------------------- */
/*                                ADD MISSING                                 */
/* -------------------------------------------------------------------------- */

export async function addMissing(args: {
  art: Buffer;
  missing: CastRef[];
  model: string;
  aspectRatio: string;
  imageSize: string;
  sceneHint: string;
  sizeNotes?: string;
  styleBlock: string;
}): Promise<{ art: Buffer; model: string }> {
  const parts: any[] = [await toPart(args.art, 2048), { text: "↑ CURRENT ILLUSTRATION. ↑" }];
  let photoParts: any[] = [];
  for (const c of args.missing) {
    const r = await refParts(c);
    parts.push(...r.parts);
    photoParts = photoParts.concat(r.photoParts);
  }
  const names = args.missing.map((c) => c.name.toUpperCase()).join(", ");
  parts.push({
    text: `Edit the current illustration: add ${names}, exactly as in their references, where they naturally belong in this scene. ${args.sceneHint}
${args.sizeNotes ? `Relative sizes: ${args.sizeNotes}` : ""}
${args.missing.map((c) => `- ${c.name}: ${c.line}`).join("\n")}
Keep every existing person and animal, the background, colours, composition and empty areas exactly as they are. Make sure to only have one of each character in the image. No text, letters or words.
Style: ${args.styleBlock}`,
  });
  const out = await generateImage({
    model: args.model,
    parts,
    aspectRatio: args.aspectRatio,
    imageSize: args.imageSize,
    label: "add-missing",
    photoParts,
  });
  const { width, height } = await imageSize(args.art);
  return { art: await matchSize(out.data, width, height), model: out.model };
}

/* -------------------------------------------------------------------------- */
/*                                 LETTERING                                  */
/* -------------------------------------------------------------------------- */

const quote = (t?: string | null) => (t && t.trim() ? `"${t.trim()}"` : "(no text on this page)");

export async function letterArt(args: {
  art: Buffer;
  leftText: string;
  rightText: string;
  typography: string;
  aspectRatio: string;
  imageSize: string;
  feedback?: string;
}): Promise<Buffer> {
  const parts: any[] = [
    await toPart(args.art, 2752),
    {
      text: `Hand-letter the page text onto this children's book double-page spread. Do NOT change the illustration in any way: same people, faces, animals, colours, composition and background. Only add the lettering.

TEXT. Letter each passage EXACTLY ONCE, word for word, exactly as written between the quotes. Do not repeat, split, shorten or add any words. Each page gets one block of text.
LEFT PAGE (the left half), in its calmest upper area: ${quote(args.leftText)}
RIGHT PAGE (the right half), in its calmest upper area: ${quote(args.rightText)}

Placement: keep every letter at least 8% in from the outer edges and 6% away from the centre fold. Never over faces.
Lettering style: ${args.typography}. Large, high-contrast and easy for a child to read.
${args.feedback ? `Fix from the last attempt: ${args.feedback}` : ""}`,
    },
  ];
  const out = await generateImage({
    model: LETTERING_MODEL,
    parts,
    aspectRatio: args.aspectRatio,
    imageSize: args.imageSize,
    label: "letter",
  });
  const { width, height } = await imageSize(args.art);
  return matchSize(out.data, width, height);
}

export async function readText(img: Buffer): Promise<TextBlock[]> {
  const raw = await generateJson<any>(
    [
      await toPart(img, 2752),
      {
        text: `Transcribe every block of text visible in this image exactly as written, including punctuation. For each block give a tight box_2d [ymin, xmin, ymax, xmax] normalised 0-1000.
Return JSON only: {"blocks":[{"box_2d":[0,0,0,0],"text":"..."}]}`,
      },
    ],
    "read-text"
  );
  const blocks: TextBlock[] = Array.isArray(raw?.blocks) ? raw.blocks : Array.isArray(raw) ? raw : [];
  return blocks.filter((b) => Array.isArray(b?.box_2d) && typeof b?.text === "string");
}

export function judge(blocks: TextBlock[], leftText: string, rightText: string): TextVerdict {
  return judgeLettering(blocks, leftText ?? "", rightText ?? "");
}

/**
 * Paste only the lettered regions onto the checked art, so faces can't change.
 * Blocks are merged into one region per page, so a line the reader skipped
 * between two read lines is still carried across.
 */
export async function compositeText(art: Buffer, lettered: Buffer, blocks: TextBlock[]): Promise<Buffer> {
  const { width: W, height: H } = await imageSize(art);
  const lt = await matchSize(lettered, W, H);
  const valid = blocks.filter((b) => isValidBox2d(b.box_2d));
  const regions: Box2d[] = [];
  for (const side of ["left", "right"] as const) {
    const mine = valid.filter((b) => {
      const cx = (b.box_2d[1] + b.box_2d[3]) / 2;
      return side === "left" ? cx < 500 : cx >= 500;
    });
    if (mine.length === 0) continue;
    regions.push([
      Math.min(...mine.map((b) => b.box_2d[0])),
      Math.min(...mine.map((b) => b.box_2d[1])),
      Math.max(...mine.map((b) => b.box_2d[2])),
      Math.max(...mine.map((b) => b.box_2d[3])),
    ]);
  }
  let out = art;
  const growPx = Math.round(H * 0.025);
  for (const r of regions) {
    const box = box2dToPx(r, W, H);
    const padX = Math.round(box.width * 0.06) + growPx * 2;
    const padY = Math.round(box.height * 0.1) + growPx * 2;
    const crop = {
      left: Math.max(0, box.left - padX),
      top: Math.max(0, box.top - padY),
      width: 0,
      height: 0,
    };
    crop.width = Math.min(W, box.left + box.width + padX) - crop.left;
    crop.height = Math.min(H, box.top + box.height + padY) - crop.top;
    const subject = { left: box.left - crop.left, top: box.top - crop.top, width: box.width, height: box.height };
    const region = await extract(lt, crop);
    out = await pastePatch(out, region, crop, subject, { grow: 0.03, growPx, feather: Math.max(3, growPx / 3), matchColours: false });
  }
  return out;
}
