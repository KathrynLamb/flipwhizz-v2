// src/services/book-binder.ts
import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";

interface BookPage {
  imageUrl: string;
  text: string;
}

export class BookBinder {
  static async generatePdf(pages: BookPage[]): Promise<Buffer> {
    // ✅ chromium.defaultViewport is not reliably typed/available anymore
    // PDF sizing is controlled by page.pdf({ width, height }) below, so we can omit it safely.

    const executablePath =
      process.env.PUPPETEER_EXECUTABLE_PATH || (await chromium.executablePath());

    const browser = await puppeteer.launch({
      args: chromium.args,
      executablePath,
      headless: true,
    });

    try {
      const page = await browser.newPage();

      const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&display=swap');

    body, html { margin: 0; padding: 0; width: 100%; height: 100%; }

    .sheet {
      width: 206mm;  /* 200mm trim + 3mm bleed each side */
      height: 206mm;
      position: relative;
      overflow: hidden;
      page-break-after: always;
    }

    .bg-img {
      position: absolute;
      top: 0; left: 0;
      width: 206mm;
      height: 206mm;
      object-fit: cover;
      z-index: 1;
    }

    .text-box {
      position: absolute;
      bottom: 25mm;
      left: 15mm;
      right: 15mm;
      z-index: 2;
      background: rgba(255, 255, 255, 0.9);
      padding: 10mm;
      border-radius: 4mm;
      box-shadow: 0 4px 20px rgba(0,0,0,0.1);
    }

    .story-text {
      font-family: 'Playfair Display', serif;
      font-size: 18pt;
      color: #2c1810;
      text-align: center;
      line-height: 1.5;
      margin: 0;
      white-space: pre-wrap;
    }
  </style>
</head>
<body>
  ${pages
    .map(
      (p) => `
    <div class="sheet">
      <img src="${p.imageUrl}" class="bg-img" />
      <div class="text-box">
        <p class="story-text">${p.text}</p>
      </div>
    </div>`
    )
    .join("")}
</body>
</html>`;

      await page.setContent(htmlContent, { waitUntil: "networkidle0" });

      const pdfBuffer = await page.pdf({
        printBackground: true,
        width: "206mm",
        height: "206mm",
        preferCSSPageSize: true,
      });

      return Buffer.from(pdfBuffer);
    } finally {
      await browser.close();
    }
  }
}
