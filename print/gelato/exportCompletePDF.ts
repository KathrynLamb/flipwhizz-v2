import { fetchGelatoCoverDimensions } from "@/lib/fetchGelatoCoverDimensions";

export type ExportData = {
  coverSpreadUrl: string | null;
  interiorPages: {
    pageNumber: number;
    spreadImageUrl: string;
    side: "left" | "right";
  }[];
};

/* -------------------------------------------------------------------------- */
/*  Lazy browser launch                                                        */
/*  - Production (Vercel/Linux): uses @sparticuz/chromium                     */
/*  - Local (Mac/Windows): uses regular puppeteer with bundled Chromium        */
/* -------------------------------------------------------------------------- */

async function launchBrowser() {
  const isProduction = process.env.NODE_ENV === "production";

  if (isProduction) {
    const [{ default: puppeteer }, { default: chromium }] = await Promise.all([
      import("puppeteer-core"),
      import("@sparticuz/chromium-min"),
    ]);
  
    return puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(
        "https://github.com/nicholasgasior/chromium-brotli/releases/download/v143.0.0/chromium-v143.0.0-pack.tar"
      ),
      headless: true,
    });
  
  } else {
    const { default: puppeteer } = await import("puppeteer");
    return puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
  }
}

/* -------------------------------------------------------------------------- */
/*  Main export                                                                */
/* -------------------------------------------------------------------------- */

export async function exportCompletePDF(
  data: ExportData,
  gelatoProductUid: string,
  gelatoApiKey: string
): Promise<Buffer> {
  // 1️⃣ Fetch exact Gelato dimensions
  const dims = await fetchGelatoCoverDimensions(gelatoProductUid, gelatoApiKey);

  const wrapWidth = dims.wraparoundEdgeSize.width;
  const wrapHeight = dims.wraparoundEdgeSize.height;

  // 2️⃣ Launch browser lazily — never at import/build time
  const browser = await launchBrowser();

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
    position: relative;
    overflow: hidden;
  }

  .page img {
    position: absolute;
    width: 412mm;
    height: 206mm;
    object-fit: cover;
  }

  .page.left img {
    left: 0;
    object-position: left center;
  }

  .page.right img {
    right: 0;
    object-position: right center;
  }
</style>
</head>
<body>

${
  data.coverSpreadUrl
    ? `<div class="cover"><img src="${data.coverSpreadUrl}" /></div>`
    : ""
}

${data.interiorPages
  .map(
    (p) => `<div class="page ${p.side}"><img src="${p.spreadImageUrl}" /></div>`
  )
  .join("\n")}

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