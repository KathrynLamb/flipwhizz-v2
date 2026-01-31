import puppeteer from "puppeteer";
import { fetchGelatoCoverDimensions } from "@/lib/fetchGelatoCoverDimensions";

export type ExportData = {
  coverSpreadUrl: string; // ✅ single combined image
  interiorPages: { pageNumber: number; imageUrl: string }[];
};

export async function exportCompletePDF(
  data: ExportData,
  gelatoProductUid: string,
  gelatoApiKey: string
): Promise<Buffer> {
  // 1️⃣ Fetch exact Gelato dimensions
  const dims = await fetchGelatoCoverDimensions(
    gelatoProductUid,
    gelatoApiKey
  );

  const wrapWidth = dims.wraparoundEdgeSize.width;
  const wrapHeight = dims.wraparoundEdgeSize.height;

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
    page-break-after: always;
  }

  .cover img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  /* =======================
     INTERIOR PAGES
     ======================= */
  @page {
    size: 206mm 206mm;
    margin: 0;
  }

  .page {
    width: 206mm;
    height: 206mm;
    page-break-after: always;
  }

  .page img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
</style>
</head>
<body>

<!-- =======================
     PAGE 1: COVER WRAP
     ======================= -->
<div class="cover">
  <img src="${data.coverSpreadUrl}" />
</div>

<!-- =======================
     INTERIOR PAGES
     ======================= -->
${data.interiorPages
  .map(
    (p) => `
<div class="page">
  <img src="${p.imageUrl}" />
</div>
`
  )
  .join("")}

</body>
</html>
`;

    await page.setContent(html, {
      waitUntil: "networkidle0",
      timeout: 120_000,
    });

    const pdfUint8 = await page.pdf({
      printBackground: true,
      preferCSSPageSize: true,
      timeout: 120_000,
    });

    return Buffer.from(pdfUint8);
  } finally {
    await browser.close();
  }
}
