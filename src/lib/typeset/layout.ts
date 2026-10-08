// src/lib/typeset/layout.ts
//
// Line breaking and positioning for one page's text block. Pure: it only
// needs a Measurer (widths and heights from the font), so it is unit-tested
// without images.
//
// House style (what makes every page match):
// - one body size for the whole book; emphasis changes style or size by
//   fixed steps, never freely
// - centred lines, balanced so no line is left with one lonely word
// - a single line break in the text is kept, a blank line starts a new
//   paragraph with a half-line gap

import type { FontStyle } from "./fonts";
import type { Run, RunStyle } from "./runs";

export type StyleSpec = {
  font: FontStyle;
  /** Size relative to the body size. */
  scale: number;
  caps: boolean;
  /** Extra space between letters, in ems. */
  tracking: number;
  /** Letters bob up and down and tilt (sound effects). */
  bounce: boolean;
};

export const STYLE_SPECS: Record<RunStyle, StyleSpec> = {
  plain: { font: "regular", scale: 1, caps: false, tracking: 0, bounce: false },
  caps: { font: "regular", scale: 1, caps: true, tracking: 0.03, bounce: false },
  italic: { font: "italic", scale: 1.12, caps: false, tracking: 0, bounce: false },
  big: { font: "regular", scale: 1.5, caps: false, tracking: 0, bounce: false },
  shout: { font: "bold", scale: 1.25, caps: true, tracking: 0.02, bounce: false },
  burst: { font: "bold", scale: 1.9, caps: true, tracking: 0.04, bounce: true },
};

/** Line spacing as a multiple of the body size. */
export const LEADING = 1.34;

export interface Measurer {
  /** Advance width in px of text in this font at this size, kerning on, plus tracking (ems) between letters. */
  width(text: string, font: FontStyle, size: number, tracking: number): number;
  /** Ascender and descender as positive fractions of the size. */
  ascent(font: FontStyle): number;
  descent(font: FontStyle): number;
}

export type LaidPiece = {
  /** As drawn (capitals applied). */
  text: string;
  style: RunStyle;
  x: number;
  size: number;
  font: FontStyle;
  tracking: number;
  bounce: boolean;
  width: number;
};

export type LaidLine = { baseline: number; x: number; width: number; height: number; pieces: LaidPiece[] };

export type LaidBlock = { x: number; y: number; width: number; height: number; size: number; lines: LaidLine[] };

type Piece = { text: string; style: RunStyle; spec: StyleSpec; width: number; size: number };
type Word = { pieces: Piece[]; width: number };
type Token = Word | "br" | "para";

/* -------------------------------------------------------------------------- */
/*                                  Tokenise                                  */
/* -------------------------------------------------------------------------- */

function tokenise(runs: Run[], size: number, m: Measurer): Token[] {
  // Character stream with a style per character.
  const chars: { c: string; s: RunStyle }[] = [];
  for (const r of runs) for (const c of r.t.replace(/\r\n?/g, "\n")) chars.push({ c, s: r.s });

  const tokens: Token[] = [];
  let i = 0;
  const isSpace = (c: string) => /\s/.test(c);
  while (i < chars.length) {
    if (isSpace(chars[i].c)) {
      let newlines = 0;
      while (i < chars.length && isSpace(chars[i].c)) {
        if (chars[i].c === "\n") newlines++;
        i++;
      }
      if (newlines >= 2) tokens.push("para");
      else if (newlines === 1) tokens.push("br");
      continue;
    }
    const pieces: Piece[] = [];
    while (i < chars.length && !isSpace(chars[i].c)) {
      const style = chars[i].s;
      let text = "";
      while (i < chars.length && !isSpace(chars[i].c) && chars[i].s === style) text += chars[i++].c;
      const spec = STYLE_SPECS[style];
      const drawn = spec.caps ? text.toLocaleUpperCase("en-GB") : text;
      const ps = size * spec.scale;
      pieces.push({ text: drawn, style, spec, size: ps, width: m.width(drawn, spec.font, ps, spec.tracking) });
    }
    tokens.push({ pieces, width: pieces.reduce((a, p) => a + p.width, 0) });
  }
  // No breaks at the very start or end.
  while (tokens.length && typeof tokens[0] === "string") tokens.shift();
  while (tokens.length && typeof tokens.at(-1) === "string") tokens.pop();
  return tokens;
}

/* -------------------------------------------------------------------------- */
/*                                   Breaking                                 */
/* -------------------------------------------------------------------------- */

const firstScale = (w: Word) => w.pieces[0]?.spec.scale ?? 1;
const lastScale = (w: Word) => w.pieces.at(-1)?.spec.scale ?? 1;

function spaceBetween(a: Word, b: Word, space: number) {
  return space * Math.max(lastScale(a), firstScale(b));
}

function lineWidth(words: Word[], space: number) {
  let w = 0;
  words.forEach((word, i) => {
    w += word.width + (i > 0 ? spaceBetween(words[i - 1], word, space) : 0);
  });
  return w;
}

function greedy(words: Word[], maxWidth: number, space: number): Word[][] {
  const lines: Word[][] = [];
  let line: Word[] = [];
  let w = 0;
  for (const word of words) {
    const add = line.length ? spaceBetween(line.at(-1)!, word, space) + word.width : word.width;
    if (line.length && w + add > maxWidth) {
      lines.push(line);
      line = [word];
      w = word.width;
    } else {
      line.push(word);
      w += add;
    }
  }
  if (line.length) lines.push(line);
  return lines;
}

/** Same number of lines as greedy at maxWidth, but as narrow (even) as possible. */
function balanced(words: Word[], maxWidth: number, space: number): Word[][] {
  const first = greedy(words, maxWidth, space);
  if (first.length < 2) return first;
  let lo = Math.max(...words.map((w) => w.width));
  let hi = maxWidth;
  for (let k = 0; k < 18 && hi - lo > 0.5; k++) {
    const mid = (lo + hi) / 2;
    if (greedy(words, mid, space).length <= first.length) hi = mid;
    else lo = mid;
  }
  return greedy(words, hi, space);
}

/* -------------------------------------------------------------------------- */
/*                                    Layout                                  */
/* -------------------------------------------------------------------------- */

/**
 * Lay out one page's text at `size` (the body size in px) within maxWidth.
 * Returns a block positioned at (0, 0); move it with placeBlock.
 */
export function layoutBlock(runs: Run[], m: Measurer, size: number, maxWidth: number): LaidBlock {
  const tokens = tokenise(runs, size, m);
  const space = m.width(" ", "regular", size, 0);

  // Segments between forced breaks; paragraph breaks also add a gap.
  const segments: { words: Word[]; gapBefore: number }[] = [];
  let current: Word[] = [];
  let gap = 0;
  for (const t of tokens) {
    if (t === "br" || t === "para") {
      if (current.length) segments.push({ words: current, gapBefore: gap });
      current = [];
      gap = t === "para" ? 0.5 : 0;
      continue;
    }
    // A sound effect always gets a line of its own.
    if (t.pieces.some((p) => p.spec.bounce)) {
      if (current.length) segments.push({ words: current, gapBefore: gap });
      segments.push({ words: [t], gapBefore: current.length ? 0 : gap });
      current = [];
      gap = 0;
      continue;
    }
    current.push(t);
  }
  if (current.length) segments.push({ words: current, gapBefore: gap });

  const lines: LaidLine[] = [];
  let y = 0;
  for (const seg of segments) {
    if (lines.length && seg.gapBefore) y += size * LEADING * seg.gapBefore;
    for (const words of balanced(seg.words, maxWidth, space)) {
      const maxSize = Math.max(...words.flatMap((w) => w.pieces.map((p) => p.size)));
      const height = Math.max(size * LEADING, maxSize * 1.08);
      const fontOfMax = words.flatMap((w) => w.pieces).find((p) => p.size === maxSize)!.spec.font;
      const asc = m.ascent(fontOfMax);
      const desc = m.descent(fontOfMax);
      const baseline = y + (height - maxSize * (asc + desc)) / 2 + maxSize * asc;

      const pieces: LaidPiece[] = [];
      let x = 0;
      words.forEach((word, i) => {
        if (i > 0) x += spaceBetween(words[i - 1], word, space);
        for (const p of word.pieces) {
          pieces.push({ text: p.text, style: p.style, x, size: p.size, font: p.spec.font, tracking: p.spec.tracking, bounce: p.spec.bounce, width: p.width });
          x += p.width;
        }
      });
      lines.push({ baseline, x: 0, width: lineWidth(words, space), height, pieces });
      y += height;
    }
  }

  const width = lines.length ? Math.max(...lines.map((l) => l.width)) : 0;
  // Centre each line in the block.
  for (const l of lines) {
    const shift = (width - l.width) / 2;
    l.x = shift;
    for (const p of l.pieces) p.x += shift;
  }
  return { x: 0, y: 0, width, height: y, size, lines };
}

/** Move a block so its top-left corner is at (x, y). */
export function placeBlock(b: LaidBlock, x: number, y: number): LaidBlock {
  const dx = x - b.x;
  const dy = y - b.y;
  return {
    ...b,
    x,
    y,
    lines: b.lines.map((l) => ({
      ...l,
      x: l.x + dx,
      baseline: l.baseline + dy,
      pieces: l.pieces.map((p) => ({ ...p, x: p.x + dx })),
    })),
  };
}

export type Box = { left: number; top: number; width: number; height: number };

export type Fit = {
  block: LaidBlock;
  /** The body size actually used (smaller than asked only when nothing else fitted). */
  size: number;
  warnings: string[];
};

/**
 * Fit text into a box, then centre it there. In order of preference:
 * 1. the box as given, at the book's size
 * 2. widened to `area` (the page's safe area) around the box's centre
 * 3. a slightly smaller size, never below `minScale` of the book size
 * 4. whatever height it needs, moved to stay inside `area` (flagged)
 */
export function fitInBox(
  runs: Run[],
  m: Measurer,
  opts: { size: number; box: Box; area: Box; minWidth: number; maxWidth: number; minScale?: number }
): Fit {
  const warnings: string[] = [];
  const minScale = opts.minScale ?? 0.84;
  const clampW = (w: number) => Math.max(opts.minWidth, Math.min(opts.maxWidth, opts.area.width, w));

  const tryAt = (size: number, width: number) => layoutBlock(runs, m, size, width);

  let size = opts.size;
  let width = clampW(opts.box.width);
  let block = tryAt(size, width);
  let box = { ...opts.box };

  if (block.height > box.height) {
    width = clampW(opts.maxWidth);
    block = tryAt(size, width);
  }
  while (block.height > box.height && size > opts.size * minScale + 0.01) {
    size = Math.max(opts.size * minScale, size * 0.94);
    block = tryAt(size, width);
  }
  if (size < opts.size) warnings.push(`text set ${Math.round((1 - size / opts.size) * 100)}% smaller to fit`);
  if (block.height > box.height) {
    warnings.push("text needed more room than the calm area");
    box = { ...box, height: block.height };
  }

  // Centre in the box horizontally, top-align vertically when the box is
  // much taller than the text (reads as a deliberate block, not floating).
  const cx = box.left + box.width / 2;
  let x = cx - block.width / 2;
  let y = box.height > block.height * 1.6 ? box.top + Math.min(box.height - block.height, box.height * 0.08) : box.top + (box.height - block.height) / 2;

  // Keep inside the safe area.
  x = Math.max(opts.area.left, Math.min(opts.area.left + opts.area.width - block.width, x));
  y = Math.max(opts.area.top, Math.min(opts.area.top + opts.area.height - block.height, y));
  if (block.height > opts.area.height) {
    warnings.push("text is taller than the page's safe area");
    y = opts.area.top;
  }
  return { block: placeBlock(block, x, y), size, warnings };
}
