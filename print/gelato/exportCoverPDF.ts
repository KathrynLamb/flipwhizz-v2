import puppeteer from "puppeteer";
import fs from "fs/promises";
import path from "path";
import { renderCoverHTML } from "./renderCoverHTML";
import { GELATO_HARDCOVER_20x20_30P as spec } from "./coverSpec";
import { convertToPrintPDF } from "./convertToPrintPDF";

type ExportInput = {
  title: string;
  author?: string;
  backgroundImageUrl: string;
  spineText?: string;
  outputPath: string; // final CMYK PDF
};

export async function exportCoverPDF(input: ExportInput) {
  const tempRgbPath = input.outputPath.replace(".pdf", ".rgb.pdf");

  const html = renderCoverHTML(input);

  const browser = await puppeteer.launch({
    headless: "new"
  });

  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "networkidle0" });

  await page.pdf({
    path: tempRgbPath,
    width: `${spec.pdf.widthMm}mm`,
    height: `${spec.pdf.heightMm}mm`,
    printBackground: true,
    preferCSSPageSize: true
  });

  await browser.close();

  // Convert to CMYK + PDF/X-4
  await convertToPrintPDF({
    inputPdfPath: tempRgbPath,
    outputPdfPath: input.outputPath
  });

  // Cleanup temp file
  await fs.unlink(tempRgbPath);
}
