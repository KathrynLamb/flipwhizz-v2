import puppeteer from "puppeteer";
import fs from "fs/promises";
import { renderCoverHTML } from "./renderCoverHTML";
import { GELATO_HARDCOVER_20x20_30P as spec } from "./coverSpec";

type ExportInput = {
  title: string;
  author?: string;
  backgroundImageUrl: string;
  spineText?: string;
  outputPath: string;
};

export async function exportCoverPDF(input: ExportInput) {
  const html = renderCoverHTML(input);

  const browser = await puppeteer.launch({
    headless: "new"
  });

  const page = await browser.newPage();

  await page.setContent(html, { waitUntil: "networkidle0" });

  await page.pdf({
    path: input.outputPath,
    width: `${spec.pdf.widthMm}mm`,
    height: `${spec.pdf.heightMm}mm`,
    printBackground: true,
    preferCSSPageSize: true
  });

  await browser.close();

  // 🚨 NEXT STEP (not optional in prod):
  // Convert RGB → CMYK
  // Enforce PDF/X-4
}
