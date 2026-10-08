// src/lib/typeset/faces.ts
//
// The book typefaces, as data only (no file access), so the admin page can
// show them too. Each book uses ONE family (regular, italic, bold) for all
// of its text. The font files are open-licence (SIL OFL), in
// public/fonts/book with their licences.

export type TypefaceKey = "classic" | "storybook" | "friendly";
export type FontStyle = "regular" | "italic" | "bold";

export type Typeface = {
  label: string;
  family: string;
  detail: string;
  /** Size multiplier so the three faces read at the same visual size (x-height). */
  sizeScale: number;
  files: Record<FontStyle, string>;
};

export const TYPEFACES: Record<TypefaceKey, Typeface> = {
  classic: {
    label: "Classic",
    family: "Libre Caslon Text",
    detail: "A traditional bookshop serif, like most published picture books.",
    sizeScale: 1,
    files: { regular: "classic-regular.ttf", italic: "classic-italic.ttf", bold: "classic-bold.ttf" },
  },
  storybook: {
    label: "Storybook",
    family: "Crimson Text",
    detail: "A softer, slightly narrower book serif. Good for pages with more words.",
    sizeScale: 1.16,
    files: { regular: "storybook-regular.ttf", italic: "storybook-italic.ttf", bold: "storybook-bold.ttf" },
  },
  friendly: {
    label: "Early reader",
    family: "Andika",
    detail: "Made for children learning to read: simple letter shapes and clear spacing.",
    sizeScale: 1.06,
    files: { regular: "friendly-regular.ttf", italic: "friendly-italic.ttf", bold: "friendly-bold.ttf" },
  },
};

export const DEFAULT_TYPEFACE: TypefaceKey = "classic";
export const TYPEFACE_KEYS = Object.keys(TYPEFACES) as TypefaceKey[];

export function isTypefaceKey(v: unknown): v is TypefaceKey {
  return typeof v === "string" && v in TYPEFACES;
}

export function typefaceOf(v: unknown): TypefaceKey {
  return isTypefaceKey(v) ? v : DEFAULT_TYPEFACE;
}
