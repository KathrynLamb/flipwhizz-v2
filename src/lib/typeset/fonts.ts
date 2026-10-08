// src/lib/typeset/fonts.ts
//
// Loads the book typefaces (listed in ./faces) for the server: from disk, or
// from the site's own /fonts/book URL if the files weren't bundled with the
// function.

import { readFile } from "fs/promises";
import path from "path";
import { parse as parseFont, type Font } from "opentype.js";

import { TYPEFACES, type FontStyle, type TypefaceKey } from "./faces";

export * from "./faces";

/** Where the files live in the repo (and so at /fonts/book on the site). */
export const FONT_DIR = "public/fonts/book";

const SITE = (process.env.NEXT_PUBLIC_BASE_URL || "https://flipwhizz.com").replace(/\/+$/, "");

async function readFontFile(file: string): Promise<ArrayBuffer> {
  try {
    const buf = await readFile(path.join(process.cwd(), FONT_DIR, file));
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
  } catch {
    const res = await fetch(`${SITE}/fonts/book/${file}`);
    if (!res.ok) throw new Error(`Font ${file} not found on disk or at ${SITE}/fonts/book (${res.status})`);
    return await res.arrayBuffer();
  }
}

const cache = new Map<string, Promise<Font>>();

export function loadFont(key: TypefaceKey, style: FontStyle): Promise<Font> {
  const file = TYPEFACES[key].files[style];
  let p = cache.get(file);
  if (!p) {
    p = readFontFile(file).then((ab) => parseFont(ab));
    p.catch(() => cache.delete(file));
    cache.set(file, p);
  }
  return p;
}

export type FontSet = Record<FontStyle, Font>;

export async function loadFontSet(key: TypefaceKey): Promise<FontSet> {
  const [regular, italic, bold] = await Promise.all([loadFont(key, "regular"), loadFont(key, "italic"), loadFont(key, "bold")]);
  return { regular, italic, bold };
}
