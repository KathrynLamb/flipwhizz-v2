

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

async function safeUnlink(path: string) {
  try {
    await fs.unlink(path);
  } catch (err: any) {
    if (err.code !== "ENOENT") {
      throw err;
    }
  }
}

export async function exportCoverPDF(input: ExportInput) {
  const tempRgbPath = input.outputPath.replace(".pdf", ".rgb.pdf");

  const html = renderCoverHTML(input);


  const browser = await puppeteer.launch({
    headless: true
  });
  
  const page = await browser.newPage();
  await page.setJavaScriptEnabled(false);
  
  await page.setContent(html, { waitUntil: "load" });
  
  await page.pdf({
    path: input.outputPath,
    width: `${spec.pdf.widthMm}mm`,
    height: `${spec.pdf.heightMm}mm`,
    printBackground: true,
    preferCSSPageSize: true
  });
  
  await page.close();
  await browser.close();
  
  
  await safeUnlink(tempRgbPath);

  // Cleanup temp file

}
