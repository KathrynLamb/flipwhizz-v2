import puppeteer from "puppeteer";
// import fs from "fs/promises";
// import path from "path";
import { renderInteriorHTML } from "./renderInteriorHTML";

export async function exportInteriorPDF(
  pages: { pageNumber: number; imageUrl: string }[],
  outPath: string
) {
  const browser = await puppeteer.launch({
    headless: true,
  });

  const page = await browser.newPage();

  const html = renderInteriorHTML(pages);

  await page.setContent(html, { 
    waitUntil: "domcontentloaded", // Don't wait for all network requests
    timeout: 60000 // 60 seconds instead of 30
  });
  
  await page.pdf({
    path: outPath,
    printBackground: true,
    preferCSSPageSize: true,
  });

  await browser.close();
}
