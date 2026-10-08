// src/lib/typeset/render.ts
//
// Draw laid-out text as vector outlines (SVG paths from the font files), and
// decide how it sits on the picture: dark or light ink, and on a busy
// background a soft halo or a painterly wash behind it. The same SVG is
// baked into the page picture and used as a separate vector layer in the
// print PDF, so print text is sharp at any size.

import sharp from "sharp";
import type { Font, Glyph } from "opentype.js";
import type { FontSet } from "./fonts";
import type { Box, LaidBlock, LaidPiece, Measurer } from "./layout";

/* -------------------------------------------------------------------------- */
/*                                  Measuring                                 */
/* -------------------------------------------------------------------------- */

function glyphRun(font: Font, text: string): Glyph[] {
  return font.stringToGlyphs(text);
}

export function fontMeasurer(fonts: FontSet): Measurer {
  return {
    width(text, style, size, tracking) {
      const font = fonts[style];
      if (!tracking) return font.getAdvanceWidth(text, size, { kerning: true });
      const glyphs = glyphRun(font, text);
      return font.getAdvanceWidth(text, size, { kerning: true }) + Math.max(0, glyphs.length - 1) * tracking * size;
    },
    ascent: (style) => fonts[style].ascender / fonts[style].unitsPerEm,
    descent: (style) => -fonts[style].descender / fonts[style].unitsPerEm,
  };
}

/* -------------------------------------------------------------------------- */
/*                                 Treatment                                  */
/* -------------------------------------------------------------------------- */

export type Treatment = {
  ink: string;
  /** Soft outline in the opposite tone, for slightly busy backgrounds. */
  halo: { color: string; opacity: number } | null;
  /** Blurred patch of paper behind the text, for busy backgrounds. */
  wash: { color: string; opacity: number } | null;
};

export const INK_DARK = "#2a1f17";
export const INK_LIGHT = "#fffcf5";

export type RegionStats = {
  /** Mean luminance 0-1. */
  mean: number;
  /** Fine detail 0-1: average difference from a blurred copy (texture, edges). */
  busy: number;
  rgb: [number, number, number];
};

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

export async function regionStats(art: Buffer, box: Box): Promise<RegionStats> {
  const meta = await sharp(art).metadata();
  const W = meta.width ?? 0;
  const H = meta.height ?? 0;
  const left = Math.max(0, Math.floor(box.left));
  const top = Math.max(0, Math.floor(box.top));
  const width = Math.max(1, Math.min(W - left, Math.ceil(box.width)));
  const height = Math.max(1, Math.min(H - top, Math.ceil(box.height)));
  const region = sharp(art).extract({ left, top, width, height }).resize({ width: 320, height: 320, fit: "inside" });

  const { data: rgbData, info } = await region.clone().removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const grey = await region.clone().greyscale().raw().toBuffer();
  const blurred = await sharp(grey, { raw: { width: info.width, height: info.height, channels: 1 } }).blur(3).raw().toBuffer();

  let lum = 0;
  let diff = 0;
  for (let i = 0; i < grey.length; i++) {
    lum += grey[i];
    diff += Math.abs(grey[i] - blurred[i]);
  }
  const n = grey.length || 1;
  let r = 0;
  let g = 0;
  let b = 0;
  for (let i = 0; i < rgbData.length; i += info.channels) {
    r += rgbData[i];
    g += rgbData[i + 1];
    b += rgbData[i + 2];
  }
  const px = rgbData.length / info.channels || 1;
  return { mean: lum / n / 255, busy: diff / n / 255, rgb: [r / px, g / px, b / px] };
}

const hex = (rgb: [number, number, number]) => "#" + rgb.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");
const mix = (a: [number, number, number], b: [number, number, number], t: number): [number, number, number] => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

/**
 * Dark ink on light backgrounds, light ink on dark ones. Calm areas get
 * nothing extra (like a printed book); textured ones a soft halo; busy or
 * mid-tone ones a wash of paper tinted from the picture itself.
 */
export function decideTreatment(s: RegionStats): Treatment {
  const dark = s.mean >= 0.47;
  const ink = dark ? INK_DARK : INK_LIGHT;
  const midTone = s.mean > 0.36 && s.mean < 0.6;
  const paper: [number, number, number] = dark ? [255, 251, 242] : [24, 20, 34];

  if (s.busy >= 0.05 || (midTone && s.busy >= 0.025)) {
    return { ink, halo: null, wash: { color: hex(mix(s.rgb, paper, 0.72)), opacity: 0.86 } };
  }
  if (s.busy >= 0.022 || midTone) {
    return { ink, halo: { color: dark ? "#fffbf2" : "#1e1a26", opacity: dark ? 0.8 : 0.6 }, wash: null };
  }
  return { ink, halo: null, wash: null };
}

/* -------------------------------------------------------------------------- */
/*                                    SVG                                     */
/* -------------------------------------------------------------------------- */

const f2 = (n: number) => (Math.round(n * 100) / 100).toString();

/** Path data for one piece of text. */
function piecePaths(fonts: FontSet, p: LaidPiece, baseline: number): string[] {
  const font = fonts[p.font];
  if (!p.tracking && !p.bounce) {
    return [font.getPath(p.text, p.x, baseline, p.size, { kerning: true }).toPathData(2)];
  }
  // Letter by letter: tracking, and for sound effects a bounce and a tilt.
  const glyphs = glyphRun(font, p.text);
  const scale = p.size / font.unitsPerEm;
  const out: string[] = [];
  let x = p.x;
  glyphs.forEach((g, i) => {
    const adv = g.advanceWidth * scale;
    const kern = i < glyphs.length - 1 ? font.getKerningValue(g, glyphs[i + 1]) * scale : 0;
    if (p.bounce) {
      const dy = Math.sin(i * 1.7 + 0.6) * 0.075 * p.size;
      const tilt = (i % 2 === 0 ? -1 : 1) * (4 + (i % 3) * 1.5);
      const cx = x + adv / 2;
      const cy = baseline - 0.36 * p.size;
      const d = g.getPath(x, baseline + dy, p.size).toPathData(2);
      if (d) out.push(`<g transform="rotate(${f2(tilt)} ${f2(cx)} ${f2(cy)})"><path d="${d}"/></g>`);
    } else {
      const d = g.getPath(x, baseline, p.size).toPathData(2);
      if (d) out.push(d);
    }
    x += adv + kern + p.tracking * p.size;
  });
  return out;
}

function blockShapes(fonts: FontSet, block: LaidBlock): string {
  const parts: string[] = [];
  for (const line of block.lines) {
    for (const p of line.pieces) {
      for (const d of piecePaths(fonts, p, line.baseline)) {
        parts.push(d.startsWith("<g") ? d : `<path d="${d}"/>`);
      }
    }
  }
  return parts.join("");
}

export type DrawnBlock = { block: LaidBlock; treatment: Treatment };

export function spreadSvg(fonts: FontSet, width: number, height: number, blocks: DrawnBlock[]): string {
  const defs: string[] = [];
  const body: string[] = [];
  blocks.forEach(({ block, treatment }, i) => {
    if (!block.lines.length) return;
    const s = block.size;
    if (treatment.wash) {
      // A soft oval of paper: solid behind the words, fading to nothing.
      // A gradient (not a blur) so it is smooth everywhere and stays vector in print.
      const id = `wash${i}`;
      const pageLeft = block.x + block.width / 2 < width / 2 ? 0 : width / 2;
      const room = Math.max(0, Math.min(block.x - pageLeft, pageLeft + width / 2 - (block.x + block.width)));
      const padX = Math.min(0.35 * block.width + s, room);
      const padY = 0.6 * block.height + s;
      const o = treatment.wash.opacity;
      defs.push(
        `<radialGradient id="${id}" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="${treatment.wash.color}" stop-opacity="${o}"/><stop offset="0.68" stop-color="${treatment.wash.color}" stop-opacity="${o}"/><stop offset="1" stop-color="${treatment.wash.color}" stop-opacity="0"/></radialGradient>`
      );
      body.push(
        `<rect x="${f2(block.x - padX)}" y="${f2(block.y - padY)}" width="${f2(block.width + padX * 2)}" height="${f2(block.height + padY * 2)}" fill="url(#${id})"/>`
      );
    }
    const shapes = blockShapes(fonts, block);
    if (treatment.halo) {
      body.push(
        `<g fill="${treatment.halo.color}" stroke="${treatment.halo.color}" stroke-width="${f2(0.16 * s)}" stroke-linejoin="round" opacity="${treatment.halo.opacity}">${shapes}</g>`
      );
    }
    body.push(`<g fill="${treatment.ink}">${shapes}</g>`);
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${defs.length ? `<defs>${defs.join("")}</defs>` : ""}${body.join("")}</svg>`;
}

/** Bake the text layer into the picture. */
export async function bake(art: Buffer, svg: string): Promise<Buffer> {
  return sharp(art)
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .jpeg({ quality: 92, mozjpeg: true })
    .toBuffer();
}

export { clamp01 };
