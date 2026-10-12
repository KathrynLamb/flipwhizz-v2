import { PDFDocument } from "pdf-lib";
import sharp from "sharp";

export const TRIM_PT = 8.5 * 72;
export const BLEED_PT = 9; // Lulu: 0.125 inches on every side.
const PAGE_PT = TRIM_PT + BLEED_PT * 2;
const SAFE_PT = 36; // Half-inch inset inside trim, including the binding side.
export function interiorPageCount(storyPages: number) {
  if (!Number.isInteger(storyPages) || storyPages < 1 || storyPages > 798) throw new Error("Invalid story page count");
  // Page 1 is a title image. First left/right spread then starts on verso (page 2).
  return Math.max(32, Math.ceil((storyPages + 1) / 2) * 2);
}
async function halfImage(buffer: Buffer, side: "left" | "right") {
  const meta = await sharp(buffer).metadata();
  if (!meta.width || !meta.height) throw new Error("Invalid book image");
  const width = Math.floor(meta.width / 2);
  return sharp(buffer).extract({ left: side === "left" ? 0 : meta.width - width, top: 0, width, height: meta.height }).png().toBuffer();
}
async function drawContained(pdf: PDFDocument, buffer: Buffer, page: ReturnType<PDFDocument["addPage"]>, x: number, y: number, width: number, height: number) {
  const png = await sharp(buffer).png().toBuffer();
  const image = await pdf.embedPng(png);
  const scale = Math.min(width / image.width, height / image.height);
  const w = image.width * scale, h = image.height * scale;
  page.drawImage(image, { x: x + (width - w) / 2, y: y + (height - h) / 2, width: w, height: h });
}
export async function buildColouringInterior(input: { title: string; cover: Buffer; titleInColour?: boolean; spreads: { image: Buffer; hasRightPage: boolean }[] }) {
  const pdf = await PDFDocument.create();
  pdf.setTitle(input.title); pdf.setAuthor("FlipWhizz");
  const first = pdf.addPage([PAGE_PT, PAGE_PT]);
  const titleArt = await halfImage(input.cover, "right");
  await drawContained(pdf, input.titleInColour ? titleArt : await sharp(titleArt).greyscale().png().toBuffer(), first, BLEED_PT + SAFE_PT, BLEED_PT + SAFE_PT, TRIM_PT - SAFE_PT * 2, TRIM_PT - SAFE_PT * 2);
  for (const spread of input.spreads) {
    for (const side of (spread.hasRightPage ? ["left", "right"] : ["left"]) as ("left" | "right")[]) {
      const page = pdf.addPage([PAGE_PT, PAGE_PT]);
      // Preserve the whole composition and lettering. Never stretch or crop to square.
      const art = await sharp(await halfImage(spread.image, side)).greyscale().png().toBuffer();
      await drawContained(pdf, art, page, BLEED_PT + SAFE_PT, BLEED_PT + SAFE_PT, TRIM_PT - SAFE_PT * 2, TRIM_PT - SAFE_PT * 2);
    }
  }
  const count = interiorPageCount(pdf.getPageCount() - 1);
  while (pdf.getPageCount() < count) pdf.addPage([PAGE_PT, PAGE_PT]);
  for (const page of pdf.getPages()) page.setTrimBox(BLEED_PT, BLEED_PT, TRIM_PT, TRIM_PT);
  return { buffer: Buffer.from(await pdf.save()), pageCount: count };
}
export async function buildColouringCover(cover: Buffer, dimensions: { width: number; height: number }) {
  const { width, height } = dimensions;
  const spine = width - 2 * TRIM_PT - 2 * BLEED_PT;
  if (!Number.isFinite(width) || !Number.isFinite(height) || spine < 0 || spine > 144 || Math.abs(height - PAGE_PT) > 1) throw new Error("Unexpected Lulu cover dimensions");
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([width, height]);
  // White spine; existing cover halves are inset so existing text is never cut at trim.
  await drawContained(pdf, await halfImage(cover, "left"), page, BLEED_PT + SAFE_PT, BLEED_PT + SAFE_PT, TRIM_PT - 2 * SAFE_PT, TRIM_PT - 2 * SAFE_PT);
  await drawContained(pdf, await halfImage(cover, "right"), page, BLEED_PT + TRIM_PT + spine + SAFE_PT, BLEED_PT + SAFE_PT, TRIM_PT - 2 * SAFE_PT, TRIM_PT - 2 * SAFE_PT);
  return Buffer.from(await pdf.save());
}
