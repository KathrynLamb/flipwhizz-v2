import puppeteer from "puppeteer";
import { renderInteriorHTML } from "./renderInteriorHTML";

type PrintPage = {
  pageNumber: number;
  spreadImageUrl: string;
  side: "left" | "right";
};

export async function exportInteriorPDF(
  pages: PrintPage[],
  outPath: string
) {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  const html = renderInteriorHTML(pages);
  await page.setContent(html, {
    waitUntil: 'domcontentloaded',
    timeout: 120000,
  });
  
  // Wait for all images to finish loading
  await page.waitForFunction(
    () => Array.from(document.images).every(img => img.complete),
    { timeout: 120000 }
  );

  await page.pdf({
    path: outPath,
    printBackground: true,
    width: "11in",
    height: "11in",
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
    preferCSSPageSize: true,
  });

  await browser.close();
}
