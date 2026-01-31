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

  // await page.setContent(html, { 
  //   waitUntil: "domcontentloaded", // Don't wait for all network requests
  //   timeout: 60000 // 60 seconds instead of 30
  // });

  await page.setContent(html, { 
    waitUntil: "networkidle0",
    timeout: 60000
  });
  
// exportInteriorPDF.ts
await page.pdf({
  path: outPath,
  printBackground: true,
  width: '11in',  // Single page width
  height: '11in', // Single page height
  margin: { top: 0, right: 0, bottom: 0, left: 0 }, 
  preferCSSPageSize: true,
});

  await browser.close();
}
