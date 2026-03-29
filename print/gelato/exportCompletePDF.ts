import { fetchGelatoCoverDimensions } from "@/lib/fetchGelatoCoverDimensions";

export type ExportData = {
  coverSpreadUrl: string | null;
  interiorPages: {
    pageNumber: number;
    spreadImageUrl: string;
    side: "left" | "right";
  }[];
  storyTitle?: string;
  readerName?: string;
};

export type PrintSpec = {
  productType: "print" | "gift";
  coverType: "softcover" | "hardcover";
  gelatoProductUid: string;
  trimSize: "8x8";
  interiorPageTarget: number;
  totalProductPageCount: number;
};

/* -------------------------------------------------------------------------- */
/*  Optimize Cloudinary URLs for print                                        */
/* -------------------------------------------------------------------------- */

function optimizeForPrint(url: string): string {
  if (!url.includes("res.cloudinary.com")) return url;
  return url.replace("/upload/", "/upload/q_85,w_2400,f_jpg/");
}

/* -------------------------------------------------------------------------- */
/*  Normalize Gelato cover dimensions                                         */
/* -------------------------------------------------------------------------- */

function getCoverCanvasSize(dims: any): { width: number; height: number } {
  if (dims?.bleedSize?.width && dims?.bleedSize?.height) {
    return {
      width: dims.bleedSize.width,
      height: dims.bleedSize.height,
    };
  }

  if (dims?.wraparoundInsideSize?.width && dims?.wraparoundInsideSize?.height) {
    return {
      width: dims.wraparoundInsideSize.width,
      height: dims.wraparoundInsideSize.height,
    };
  }

  throw new Error(
    `Gelato response missing usable cover dimensions: ${JSON.stringify(dims)}`
  );
}

/* -------------------------------------------------------------------------- */
/*  Lazy browser launch                                                       */
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
/*  Main export                                                               */
/* -------------------------------------------------------------------------- */

export async function exportCompletePDF(
  data: ExportData,
  gelatoProductUid: string,
  gelatoApiKey: string,
  printSpec: PrintSpec
): Promise<Buffer> {
  if (data.interiorPages.length > printSpec.interiorPageTarget) {
    throw new Error(
      `Too many interior pages: got ${data.interiorPages.length}, max supported is ${printSpec.interiorPageTarget}`
    );
  }

  const paddingPages = printSpec.interiorPageTarget - data.interiorPages.length;

  console.log("📐 Fetching Gelato cover dimensions", {
    gelatoProductUid,
    coverType: printSpec.coverType,
    totalProductPageCount: printSpec.totalProductPageCount,
    interiorPageTarget: printSpec.interiorPageTarget,
    actualInteriorPages: data.interiorPages.length,
    paddingPages,
  });

  const dims = await fetchGelatoCoverDimensions(
    gelatoProductUid,
    gelatoApiKey,
    printSpec.totalProductPageCount
  );

  console.log("📐 Gelato cover dimensions response:", dims);

  const coverCanvas = getCoverCanvasSize(dims);
  const coverWidth = coverCanvas.width;
  const coverHeight = coverCanvas.height;

  /* ------------------------------------------------------------------------ */
  /*  Interior page geometry                                                  */
  /* ------------------------------------------------------------------------ */
  /* 8x8 book:
     - trim/content area = 206 x 206 mm
     - bleed = 4 mm each side
     - full PDF page = 214 x 214 mm
  */

  const BLEED_MM = 4;
  const CONTENT_MM = 206;
  const SAFE_MARGIN_MM = 10;

  const interiorPageSize = CONTENT_MM + BLEED_MM * 2; // 214mm
  const spreadWidth = interiorPageSize * 2; // 428mm
  const spreadHeight = interiorPageSize; // 214mm

  // We render the spread slightly smaller inside the page so text stays away
  // from trim. This creates a safety inset all around each page.
  const insetPageWidth = interiorPageSize - SAFE_MARGIN_MM * 2;
  const insetPageHeight = interiorPageSize - SAFE_MARGIN_MM * 2;
  const insetSpreadWidth = insetPageWidth * 2;
  const insetSpreadHeight = insetPageHeight;

  if (insetPageWidth <= 0 || insetPageHeight <= 0) {
    throw new Error(
      `Invalid inset geometry. interiorPageSize=${interiorPageSize}, SAFE_MARGIN_MM=${SAFE_MARGIN_MM}`
    );
  }

  const browser = await launchBrowser();

  try {
    const page = await browser.newPage();

    const titlePageHtml = `
<div class="page dedication">
  <div class="dedication-content">
    ${data.storyTitle ? `<p class="dedication-title">${data.storyTitle}</p>` : ""}
    ${data.readerName ? `<p class="dedication-sub">Made especially for ${data.readerName}</p>` : ""}  </div>
</div>`;

    const endPageHtml = `
<div class="page the-end">
  <div class="end-content">
    <p class="end-text">The End</p>
  </div>
</div>`;

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
  html, body { background: white; }

  @page cover {
    size: ${coverWidth}mm ${coverHeight}mm;
    margin: 0;
  }

  @page interior {
    size: ${interiorPageSize}mm ${interiorPageSize}mm;
    margin: 0;
  }

  .cover {
    page: cover;
    width: ${coverWidth}mm;
    height: ${coverHeight}mm;
    page-break-after: always;
    overflow: hidden;
    position: relative;
    background: white;
  }

  .cover img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .page {
    page: interior;
    width: ${interiorPageSize}mm;
    height: ${interiorPageSize}mm;
    page-break-after: always;
    position: relative;
    overflow: hidden;
    background: white;
  }

  .page.blank {
    background: white;
  }

  .page.dedication,
  .page.the-end {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .dedication-content,
  .end-content {
    text-align: center;
    padding: 20mm;
  }

  .dedication-title {
    font-family: Georgia, "Times New Roman", serif;
    font-size: 24pt;
    color: #333;
    margin-bottom: 8mm;
    line-height: 1.2;
  }

  .dedication-sub {
    font-family: Georgia, "Times New Roman", serif;
    font-size: 14pt;
    font-style: italic;
    color: #666;
    line-height: 1.4;
  }

  .end-text {
    font-family: Georgia, "Times New Roman", serif;
    font-size: 28pt;
    font-style: italic;
    color: #333;
    line-height: 1.2;
  }

  /* ---------------------------------------------------------------------- */
  /* Interior spread slicing with safety inset                              */
  /* ---------------------------------------------------------------------- */

  .page img {
    position: absolute;
    top: ${SAFE_MARGIN_MM}mm;
    width: ${insetSpreadWidth}mm;
    height: ${insetSpreadHeight}mm;
    object-fit: cover;
    display: block;
  }

  /* Left page shows left half of the spread, inset from all edges */
  .page.left img {
    left: ${SAFE_MARGIN_MM}mm;
  }

  /* Right page shows right half of the spread, also inset */
  .page.right img {
    left: -${insetPageWidth - SAFE_MARGIN_MM}mm;
  }

  /* Optional debug guides: uncomment if needed
  .page::after {
    content: "";
    position: absolute;
    left: ${SAFE_MARGIN_MM}mm;
    top: ${SAFE_MARGIN_MM}mm;
    width: ${interiorPageSize - SAFE_MARGIN_MM * 2}mm;
    height: ${interiorPageSize - SAFE_MARGIN_MM * 2}mm;
    border: 0.3mm dashed rgba(255,0,0,0.5);
    pointer-events: none;
  }
  */
</style>
</head>
<body>

${
  data.coverSpreadUrl
    ? `<div class="cover"><img src="${optimizeForPrint(data.coverSpreadUrl)}" /></div>`
    : ""
}

<div class="page blank"></div>

${paddingPages >= 1 ? titlePageHtml : ""}

${data.interiorPages
  .map(
    (p) =>
      `<div class="page ${p.side}"><img src="${optimizeForPrint(
        p.spreadImageUrl
      )}" /></div>`
  )
  .join("\n")}

${paddingPages >= 2 ? endPageHtml : ""}

${extraBlanksHtml}

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