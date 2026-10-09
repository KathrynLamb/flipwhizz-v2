// src/lib/print/layout.ts
//
// Which version of the print layout a PDF was built with, saved with every
// PDF made from admin so the PDF tab can flag files from an older layout
// (a PDF is a fixed file: fixing the layout doesn't change files already made).
//
// 1 (8 Oct 2026): pictures cropped top and bottom, so Gemini's lettering
//   could be cut off.
// 2 (9 Oct 2026): the whole picture, but 214mm pages that Gelato had to
//   shrink to fit.
// 3: Gelato's exact sizes (206mm pages: 200mm trim plus 3mm bleed), pictures
//   at full resolution.
// PDFs made before the number was saved are all older than 3.
export const PDF_LAYOUT = 3;

export const isOldLayout = (layout: unknown): boolean => !(Number(layout) >= PDF_LAYOUT);
