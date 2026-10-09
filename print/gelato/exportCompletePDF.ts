// print/gelato/exportCompletePDF.ts

import { fetchGelatoCoverDimensions } from "@/lib/fetchGelatoCoverDimensions";

export type ExportData = {
  coverSpreadUrl: string | null;
  /** Previews only: with no cover, a grey cover page saying this instead. */
  coverLabel?: string;
  interiorPages: {
    pageNumber: number;
    /** null (previews only): a grey page saying `label`, for a page not drawn yet. */
    spreadImageUrl: string | null;
    side: "left" | "right";
    label?: string;
  }[];
  storyTitle?: string;
  readerName?: string;
};

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

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

/* Gelato wants pictures between 150 and 300 dpi at print size. A spread
   prints about 37cm wide and the cover about 41cm, so 300 dpi is about
   4400px. "c_limit" never enlarges, so a 2K picture (2752px) keeps every
   pixel (about 170-190 dpi) instead of being shrunk to 2400px (149 dpi on
   the cover, under Gelato's minimum). */
function optimizeForPrint(url: string): string {
  if (!url.includes("res.cloudinary.com")) return url;
  return url.replace("/upload/", "/upload/c_limit,w_4400,q_90,f_jpg/");
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
/*  Interior page size, from Gelato's own numbers                             */
/* -------------------------------------------------------------------------- */

/**
 * Gelato wants each inner page at the product's trim size plus bleed on all
 * four sides. The trim size is in the product UID ("pf_200x200-mm"); the
 * bleed is what Gelato's cover-dimensions API reports for the softcover
 * (bleedSize.thickness: 3mm for the 20x20cm photo books). So a 20x20cm book
 * has 206 x 206mm inner pages.
 */
export function interiorGeometry(productUid: string, dims: any) {
  const m = /_pf_(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)-mm/.exec(productUid);
  const trimW = m ? Number(m[1]) : 200;
  const trimH = m ? Number(m[2]) : 200;
  const bleed = Number(dims?.bleedSize?.thickness) > 0 ? Number(dims.bleedSize.thickness) : 3;
  const front = dims?.contentFrontSize;
  if (dims?.bleedSize && front?.width && (Math.abs(front.width - trimW) > 0.5 || Math.abs(front.height - trimH) > 0.5)) {
    console.warn(`⚠️ Gelato's front cover is ${front.width}x${front.height}mm but the product UID says ${trimW}x${trimH}mm`);
  }
  return { trimW, trimH, bleed, pageW: trimW + bleed * 2, pageH: trimH + bleed * 2 };
}

/**
 * Where the cover picture goes on the cover sheet. Softcover: the whole
 * sheet (only the 3mm bleed is trimmed off). Hardcover: the sheet also has
 * turn-ins that fold behind the boards (about 17mm a side), so the picture
 * goes on the visible outside (boards, spine and their edges) and a
 * zoomed copy fills the turn-ins, so no title or face disappears round
 * the back of the board.
 */
export function coverArtRect(dims: any, canvas: { width: number; height: number }) {
  const full = { left: 0, top: 0, width: canvas.width, height: canvas.height };
  if (dims?.bleedSize?.width) return { art: full, turnIns: false };
  const edge = dims?.wraparoundEdgeSize;
  if (edge?.width && edge?.height) {
    return { art: { left: Number(edge.left) || 0, top: Number(edge.top) || 0, width: Number(edge.width), height: Number(edge.height) }, turnIns: true };
  }
  const back = dims?.contentBackSize;
  const front = dims?.contentFrontSize;
  if (back?.width && front?.width) {
    const left = Number(back.left) || 0;
    const top = Number(front.top) || 0;
    return { art: { left, top, width: Number(front.left) + Number(front.width) - left, height: Number(front.height) }, turnIns: true };
  }
  return { art: full, turnIns: false };
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
  const coverPlacement = coverArtRect(dims, coverCanvas);

  /* ------------------------------------------------------------------------ */
  /*  Interior page geometry                                                  */
  /* ------------------------------------------------------------------------ */
  /* 20x20cm book (Gelato's numbers): trim 200 x 200mm, bleed 3mm a side, so
     each PDF page is 206 x 206mm. (Until Oct 2026 this was 214mm: 206 was
     taken as the trim and 4mm bleed added, so Gelato had to shrink every
     page to fit.) */

  const geo = interiorGeometry(gelatoProductUid, dims);
  // The picture sits 10mm in from the page edge on the top, bottom and
  // outer side: after the 3mm bleed is trimmed that's a 7mm white frame,
  // clear of Gelato's 4mm safe zone and of trimming wobble. At the spine
  // each page carries 10mm of the other half, so the binding doesn't
  // swallow the middle of the picture.
  const SAFE_MARGIN_MM = 10;

  const interiorPageSize = geo.pageW; // 206mm for 20x20cm

  console.log("📐 Interior pages", { ...geo, safeMarginMm: SAFE_MARGIN_MM });

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
    ${data.storyTitle ? `<p class="dedication-title">${escapeHtml(data.storyTitle)}</p>` : ""}
    ${data.readerName ? `<p class="dedication-sub">Made especially for ${escapeHtml(data.readerName)}</p>` : ""}  </div>
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
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;1,400&display=block" />
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
    position: absolute;
    display: block;
  }

  /* The picture, stretched to its area like the inside pages. */
  .cover img.cover-art {
    left: ${coverPlacement.art.left}mm;
    top: ${coverPlacement.art.top}mm;
    width: ${coverPlacement.art.width}mm;
    height: ${coverPlacement.art.height}mm;
    object-fit: fill;
  }

  /* Hardcover only: a zoomed copy under it fills the turn-ins. */
  .cover img.cover-turnins {
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
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

  /* Previews of unfinished books: a grey page where a picture will go. */
  .cover.missing,
  .page.missing {
    display: flex;
    align-items: center;
    justify-content: center;
    background: #f1f1f1;
  }

  .missing-text {
    font-family: "Playfair Display", Georgia, "Times New Roman", serif;
    font-size: 14pt;
    color: #999;
    text-align: center;
    padding: 20mm;
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
    font-family: "Playfair Display", Georgia, "Times New Roman", serif;
    font-size: 24pt;
    color: #333;
    margin-bottom: 8mm;
    line-height: 1.2;
  }

  .dedication-sub {
    font-family: "Playfair Display", Georgia, "Times New Roman", serif;
    font-size: 14pt;
    font-style: italic;
    color: #666;
    line-height: 1.4;
  }

  .end-text {
    font-family: "Playfair Display", Georgia, "Times New Roman", serif;
    font-size: 28pt;
    font-style: italic;
    color: #333;
    line-height: 1.2;
  }

  /* ---------------------------------------------------------------------- */
  /* Interior spread slicing with safety inset                              */
  /* ---------------------------------------------------------------------- */

  /* The art is 16:9 and the two printed pages are 2:1. "fill" stretches the
     whole picture to the box (about 12.5% wider), so the margins stay 10mm
     all round and nothing is trimmed. Don't use "cover": it trims the top
     and bottom, and Gemini's lettering can sit right at the top edge
     (tried twice, Apr and Oct 2026). "contain" keeps the shape but leaves a
     31mm white margin at the outer edges. */
  .page img {
    position: absolute;
    top: ${SAFE_MARGIN_MM}mm;
    width: ${insetSpreadWidth}mm;
    height: ${insetSpreadHeight}mm;
    object-fit: fill;
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
    ? `<div class="cover">${
        coverPlacement.turnIns ? `<img class="cover-turnins" src="${optimizeForPrint(data.coverSpreadUrl)}" />` : ""
      }<img class="cover-art" src="${optimizeForPrint(data.coverSpreadUrl)}" /></div>`
    : data.coverLabel
      ? `<div class="cover missing"><p class="missing-text">${escapeHtml(data.coverLabel)}</p></div>`
      : ""
}

<div class="page blank"></div>

${paddingPages >= 1 ? titlePageHtml : ""}

${data.interiorPages
  .map((p) =>
    p.spreadImageUrl
      ? `<div class="page ${p.side}"><img src="${optimizeForPrint(p.spreadImageUrl)}" /></div>`
      : `<div class="page missing"><p class="missing-text">${escapeHtml(p.label ?? "")}</p></div>`
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