// src/types/opentype.d.ts
//
// The small part of opentype.js (v1.3) the book typesetter uses.

declare module "opentype.js" {
  export interface PathCommand {
    type: string;
  }

  export class Path {
    commands: PathCommand[];
    fill: string | null;
    stroke: string | null;
    strokeWidth: number;
    toPathData(decimalPlaces?: number): string;
    getBoundingBox(): BoundingBox;
  }

  export class BoundingBox {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  }

  export class Glyph {
    index: number;
    name: string | null;
    unicode: number | undefined;
    advanceWidth: number;
    getPath(x?: number, y?: number, fontSize?: number): Path;
    getBoundingBox(): BoundingBox;
  }

  export interface RenderOptions {
    kerning?: boolean;
    features?: Record<string, boolean>;
    letterSpacing?: number;
  }

  export class Font {
    unitsPerEm: number;
    ascender: number;
    descender: number;
    names: Record<string, Record<string, string>>;
    tables: Record<string, any>;
    charToGlyph(c: string): Glyph;
    charToGlyphIndex(c: string): number;
    stringToGlyphs(s: string, options?: RenderOptions): Glyph[];
    getKerningValue(left: Glyph | number, right: Glyph | number): number;
    getAdvanceWidth(text: string, fontSize?: number, options?: RenderOptions): number;
    getPath(text: string, x: number, y: number, fontSize: number, options?: RenderOptions): Path;
  }

  export function parse(buffer: ArrayBuffer): Font;
  export function loadSync(path: string): Font;
}
