import { fetchGelatoCoverDimensions } from "@/lib/fetchGelatoCoverDimensions";

export type ExportData = {
  coverSpreadUrl: string | null;
  interiorPages: {
    pageNumber: number;
    spreadImageUrl: string;
    side: "left" | "right";
  }[];
  storyTitle?: string;
  childName?: string;
};

/* -------------------------------------------------------------------------- */
/*  Optimize Cloudinary URLs for print (300 DPI, high quality)                */
/* -------------------------------------------------------------------------- */

function optimizeForPrint(url: string): string {
  if (!url.includes("res.cloudinary.com")) return url;
  return url.replace("/upload/", "/upload/q_85,w_2400,f_jpg/");
}

/* -------------------------------------------------------------------------- */
/*  Lazy browser launch                                                        */
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
        "https://github.com/Sparticuz/chromium/releases/download/v143.0.0/chromium-v143.0.0-pack.x64.tar"
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
  /* ---- Fetch Gelato dimensions ---- */
  const dims = await fetchGelatoCoverDimensions(gelatoProductUid, gelatoApiKey);

  // Cover: use wraparoundInsideSize (includes 17mm bleed on all sides)
  const coverWidth = dims.wraparoundInsideSize.width; // 458mm
  const coverHeight = dims.wraparoundInsideSize.height; // 246mm

  // Interior: content is 206x206mm, add 4mm bleed on each side = 214x214mm
  const BLEED_MM = 4;
  const CONTENT_MM = 206;
  const interiorPageSize = CONTENT_MM + BLEED_MM * 2; // 214mm

  // The spread image covers two pages including bleed
  const spreadWidth = interiorPageSize * 2; // 428mm
  const spreadHeight = interiorPageSize; // 214mm

  // Gelato 30-page product requires exactly 33 PDF pages:
  // 1 cover + 1 blank endpaper + 30 content pages + 1 blank endpaper
  // We have 28 content pages, so we need 2 padding pages
  const REQUIRED_CONTENT_PAGES = 30;
  const paddingPages = REQUIRED_CONTENT_PAGES - data.interiorPages.length;

  const browser = await launchBrowser();

  try {
    const page = await browser.newPage();

    /* ---- Build padding page HTML ---- */
    const titlePageHtml = `
<div class="page dedication">
  <div class="dedication-content">
    ${data.storyTitle ? `<p class="dedication-title">${data.storyTitle}</p>` : ""}
    ${data.childName ? `<p class="dedication-sub">A story for ${data.childName}</p>` : ""}
  </div>
</div>`;

    const endPageHtml = `
<div class="page the-end">
  <div class="end-content">
    <p class="end-text">The End</p>
  </div>
</div>`;

    // If we need more than 2 padding pages, add blanks
    const extraBlankPages = Math.max(0, paddingPages - 2);
    const extraBlanksHtml = Array(extraBlankPages)
      .fill('<div class="page blank"></div>')
      .join("\n");

    const html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8" />
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: white; }

  /* ---- Cover spread (with 17mm bleed) ---- */
  @page cover {
    size: ${coverWidth}mm ${coverHeight}mm;
    margin: 0;
  }

  .cover {
    page: cover;
    width: ${coverWidth}mm;
    height: ${coverHeight}mm;
    page-break-after: always;
    overflow: hidden;
  }

  .cover img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  /* ---- Interior pages (206mm + 4mm bleed each side = 214mm) ---- */
  @page interior {
    size: ${interiorPageSize}mm ${interiorPageSize}mm;
    margin: 0;
  }

  .page {
    page: interior;
    width: ${interiorPageSize}mm;
    height: ${interiorPageSize}mm;
    page-break-after: always;
    position: relative;
    overflow: hidden;
  }

  .page.blank {
    background: white;
  }

  .page.dedication {
    background: white;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .dedication-content {
    text-align: center;
    padding: 20mm;
  }

  .dedication-title {
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 24pt;
    color: #333;
    margin-bottom: 8mm;
  }

  .dedication-sub {
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 14pt;
    font-style: italic;
    color: #666;
  }

  .page.the-end {
    background: white;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .end-content {
    text-align: center;
  }

  .end-text {
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 28pt;
    font-style: italic;
    color: #333;
  }

  /* Spread images: full spread is 428mm x 214mm */
  .page img {
    position: absolute;
    width: ${spreadWidth}mm;
    height: ${spreadHeight}mm;
    object-fit: cover;
    top: 0;
  }

  .page.left img {
    left: 0;
  }

  .page.right img {
    left: -${interiorPageSize}mm;
  }
</style>
</head>
<body>

${
  data.coverSpreadUrl
    ? `<!-- Page 1: Cover spread with bleed -->
<div class="cover"><img src="${optimizeForPrint(data.coverSpreadUrl)}" /></div>`
    : ""
}

<!-- Page 2: Blank endpaper (inside front cover) -->
<div class="page blank"></div>

<!-- Page 3: Dedication / title page -->
${paddingPages >= 1 ? titlePageHtml : ""}

<!-- Pages 4-31: Interior content pages (28 pages) -->
${data.interiorPages
  .map(
    (p) =>
      `<div class="page ${p.side}"><img src="${optimizeForPrint(p.spreadImageUrl)}" /></div>`
  )
  .join("\n")}

<!-- Page 32: The End page -->
${paddingPages >= 2 ? endPageHtml : ""}

<!-- Extra blank pages if needed -->
${extraBlanksHtml}

<!-- Page 33: Blank endpaper (inside back cover) -->
<div class="page blank"></div>

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