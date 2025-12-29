import puppeteer from "puppeteer";
import { fetchGelatoCoverDimensions } from "@/lib/fetchGelatoCoverDimensions";

export type ExportData = {
  frontCoverUrl: string;
  backCoverUrl: string;
  title: string;
  interiorPages: { pageNumber: number; imageUrl: string }[];
};

/**
 * Generates a complete Gelato-ready PDF and returns it as a Buffer:
 * - Page 1: Cover wrap spread (back | spine | front) using Gelato dimensions
 * - Pages 2+: Interior pages EXACTLY like the working interior exporter
 */
export async function exportCompletePDF(
  data: ExportData,
  gelatoProductUid: string,
  gelatoApiKey: string
): Promise<Buffer> {
  // 👉 Fetch exact cover dimensions from Gelato
  const dims = await fetchGelatoCoverDimensions(
    gelatoProductUid,
    gelatoApiKey
  );

  const wrapWidth = dims.wraparoundEdgeSize.width;     // total wrap width incl bleed
  const wrapHeight = dims.wraparoundEdgeSize.height;   // total wrap height incl bleed
  const spineWidth = dims.wraparoundInsideSize.thickness; // spine thickness

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();

    const html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8" />
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }

  body { background: white; }

  /* =======================
     INTERIOR PAGES (default)
     ======================= */
  @page {
    size: 206mm 206mm;
    margin: 0;
  }

  .page {
    position: relative;
    width: 206mm;
    height: 206mm;
    overflow: hidden;
    page-break-after: always;
  }

  .page img {
    position: absolute;
    top: 0;
    left: 0;
    width: 200%;
    height: 100%;
    object-fit: cover;
  }

  .left img { transform: translateX(0); }
  .right img { transform: translateX(-50%); }

  /* =======================
     COVER PAGE
     ======================= */
  @page cover {
    size: ${wrapWidth}mm ${wrapHeight}mm;
    margin: 0;
  }

  .cover {
    page: cover;
    width: ${wrapWidth}mm;
    height: ${wrapHeight}mm;
    display: flex;
    position: relative;
    page-break-after: always;
  }

  .cover img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  /* Bleed & safe guides (debug only – remove for production) */
  .bleed-guide {
    position: absolute;
    top: 3mm;
    left: 3mm;
    right: 3mm;
    bottom: 3mm;
    border: 0.5mm dashed red;
    pointer-events: none;
  }

  .safe-guide {
    position: absolute;
    top: 10mm;
    left: 10mm;
    right: 10mm;
    bottom: 10mm;
    border: 0.5mm dashed green;
    pointer-events: none;
  }
</style>
</head>
<body>

<!-- =======================
     PAGE 1: COVER WRAP
     ======================= -->
<div class="cover">
  <img
    src="${data.backCoverUrl}"
    style="width: calc((100% - ${spineWidth}mm) / 2)"
  />
  <div style="width: ${spineWidth}mm;"></div>
  <img
    src="${data.frontCoverUrl}"
    style="width: calc((100% - ${spineWidth}mm) / 2)"
  />
  <div class="bleed-guide"></div>
  <div class="safe-guide"></div>
</div>

<!-- =======================
     INTERIOR PAGES
     ======================= -->
${
  (() => {
    let out = "";
    const pages = data.interiorPages;

    for (let i = 0; i < pages.length; i += 2) {
      const left = pages[i];
      const right = pages[i + 1];

      if (!left) continue;

      out += `
<div class="page left">
  <img src="${left.imageUrl}" />
</div>
`;

      if (right) {
        out += `
<div class="page right">
  <img src="${right.imageUrl}" />
</div>
`;
      }
    }
    return out;
  })()
}

</body>
</html>
    `;

    await page.setContent(html, {
      waitUntil: "networkidle0",
      timeout: 120_000, // 2 minutes
    });

    // 👉 Return buffer (no path)
    // const pdfBuffer = await page.pdf({
    //   printBackground: true,
    //   preferCSSPageSize: true,
    //   timeout: 120_000,
    // });

    // 👉 Puppeteer returns Uint8Array, convert to Buffer
const pdfUint8 = await page.pdf({
  printBackground: true,
  preferCSSPageSize: true,
  timeout: 120_000,
});

return Buffer.from(pdfUint8);

    

    // return pdfBuffer;
  } finally {
    await browser.close();
  }
}
