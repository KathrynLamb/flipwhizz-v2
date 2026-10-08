// src/lib/typeset/typeset.ts
//
// Typeset a spread: lay each page's text out in the book's typeface, find
// a calm place for it, choose how it sits on the picture, and draw it.
// The layout is saved with the spread so the same lettering can be drawn
// again exactly (after a character fix, or for the print PDF).

import sharp from "sharp";
import { loadFontSet, TYPEFACES, type TypefaceKey } from "./fonts";
import { fitInBox, layoutBlock, type Box, type LaidBlock } from "./layout";
import { MAX_MEASURE, MIN_MEASURE, boxToBox2d, boxesFromReply, pageArea, placementPrompt, type Side } from "./place";
import { bake, decideTreatment, fontMeasurer, regionStats, spreadSvg, type RegionStats, type Treatment } from "./render";
import type { Run } from "./runs";

/** Body text size as a fraction of the picture height (about 18pt in the printed 8x8 book). */
export const BODY_SIZE = 0.031;

export type PageText = { side: Side; text: string; runs: Run[] };

export type TypesetPage = {
  side: Side;
  text: string;
  runs: Run[];
  /** The area chosen for the text, and who chose it. */
  box: Box;
  boxSource: "vision" | "default" | "kept";
  block: LaidBlock;
  treatment: Treatment;
  stats: RegionStats;
  warnings: string[];
};

export type TypesetLayout = {
  v: 1;
  typeface: TypefaceKey;
  width: number;
  height: number;
  /** Body size in px. */
  size: number;
  pages: TypesetPage[];
};

/** Asks a vision model a question about the picture; returns parsed JSON. */
export type AskVision = (prompt: string, art: Buffer) => Promise<unknown>;

export function bodySize(typeface: TypefaceKey, H: number): number {
  return Math.round(H * BODY_SIZE * TYPEFACES[typeface].sizeScale * 10) / 10;
}

async function sizeOf(art: Buffer) {
  const meta = await sharp(art).metadata();
  return { W: meta.width ?? 0, H: meta.height ?? 0 };
}

export async function layoutSpread(
  art: Buffer,
  pages: PageText[],
  typeface: TypefaceKey,
  opts: { boxes?: Partial<Record<Side, Box>>; askVision?: AskVision } = {}
): Promise<TypesetLayout> {
  const { W, H } = await sizeOf(art);
  const fonts = await loadFontSet(typeface);
  const m = fontMeasurer(fonts);
  const size = bodySize(typeface, H);
  const withText = pages.filter((p) => p.text.trim());

  // Places: kept from before (re-lettering), else asked for, else the default.
  const boxes: Partial<Record<Side, { box: Box; source: TypesetPage["boxSource"] }>> = {};
  const need: Partial<Record<Side, { w: number; h: number }>> = {};
  for (const p of withText) {
    const kept = opts.boxes?.[p.side];
    if (kept) boxes[p.side] = { box: kept, source: "kept" };
    else {
      const b = layoutBlock(p.runs, m, size, W * MAX_MEASURE);
      need[p.side] = { w: b.width / W, h: b.height / H };
    }
  }
  const toFind = Object.keys(need) as Side[];
  if (toFind.length) {
    let reply: unknown = null;
    if (opts.askVision) {
      try {
        reply = await opts.askVision(placementPrompt(need), art);
      } catch (err) {
        console.warn("⚠️ text placement: vision failed, using the default places:", err instanceof Error ? err.message : err);
      }
    }
    Object.assign(boxes, boxesFromReply(reply, toFind, W, H));
  }

  const out: TypesetPage[] = [];
  for (const p of withText) {
    const { box, source } = boxes[p.side]!;
    const fit = fitInBox(p.runs, m, {
      size,
      box,
      area: pageArea(p.side, W, H),
      minWidth: W * MIN_MEASURE,
      maxWidth: W * MAX_MEASURE,
    });
    const b = fit.block;
    const pad = fit.size * 0.5;
    const stats = await regionStats(art, { left: b.x - pad, top: b.y - pad, width: b.width + pad * 2, height: b.height + pad * 2 });
    out.push({ side: p.side, text: p.text, runs: p.runs, box, boxSource: source, block: b, treatment: decideTreatment(stats), stats, warnings: fit.warnings });
  }
  return { v: 1, typeface, width: W, height: H, size, pages: out };
}

/** Draw a layout onto a picture of the same size. Returns the picture and the text layer alone. */
export async function renderLayout(art: Buffer, layout: TypesetLayout): Promise<{ image: Buffer; svg: string }> {
  const fonts = await loadFontSet(layout.typeface);
  const { W, H } = await sizeOf(art);
  const base = W === layout.width && H === layout.height ? art : await sharp(art).resize(layout.width, layout.height, { fit: "fill" }).toBuffer();
  const svg = spreadSvg(fonts, layout.width, layout.height, layout.pages.map((p) => ({ block: p.block, treatment: p.treatment })));
  return { image: await bake(base, svg), svg };
}

/** The area each page's text covers (wash included), as box_2d, for tools that only need "where is the text". */
export function textBlocks(layout: TypesetLayout): { box_2d: [number, number, number, number]; text: string }[] {
  return layout.pages.map((p) => {
    const pad = p.treatment.wash ? p.block.size * 1.2 : p.block.size * 0.3;
    const b = p.block;
    return {
      box_2d: boxToBox2d({ left: b.x - pad, top: b.y - pad, width: b.width + pad * 2, height: b.height + pad * 2 }, layout.width, layout.height),
      text: p.text,
    };
  });
}

/** Re-use a layout's places for the same spread (re-lettering after a text or typeface change). */
export function keptBoxes(layout: unknown): Partial<Record<Side, Box>> | undefined {
  const l = layout as TypesetLayout | null | undefined;
  if (!l || l.v !== 1 || !Array.isArray(l.pages)) return undefined;
  const out: Partial<Record<Side, Box>> = {};
  for (const p of l.pages) if (p?.box && (p.side === "left" || p.side === "right")) out[p.side] = p.box;
  return Object.keys(out).length ? out : undefined;
}

export function layoutWarnings(layout: TypesetLayout): string[] {
  return layout.pages.flatMap((p) => p.warnings.map((w) => `${p.side === "left" ? "Left" : "Right"} page: ${w}`));
}
