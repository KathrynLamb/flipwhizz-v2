// src/app/api/stories/[id]/export-home-print/route.ts

import { NextResponse } from "next/server";
import { db } from "@/db";
import { stories, storyPages } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { uploadPdfToR2 } from "@/lib/uploadPdfToR2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// A4 landscape in points (72 DPI)
const A4_W = 841.89;
const A4_H = 595.28;

// Brand colours
const PURPLE = rgb(0.69, 0.36, 0.9); // #B05CE6
const DEEP = rgb(0.176, 0.133, 0.208); // #2D2235
const MID = rgb(0.353, 0.302, 0.42); // #5A4D6B
const LIGHT = rgb(0.482, 0.412, 0.569); // #7B6E90
const MUTED = rgb(0.659, 0.592, 0.741); // #A897BD
const CREAM_R = 0.996;
const CREAM_G = 0.988;
const CREAM_B = 0.98;

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  let stage = "start";

  try {
    stage = "params";
    const { id: storyId } = await params;
    if (!storyId) {
      return NextResponse.json({ error: "Missing story id" }, { status: 400 });
    }

    stage = "load-story";
    const story = await db.query.stories.findFirst({
      where: eq(stories.id, storyId),
    });
    if (!story) {
      return NextResponse.json({ error: "Story not found" }, { status: 404 });
    }

    stage = "load-pages";
    const pages = await db.query.storyPages.findMany({
      where: eq(storyPages.storyId, storyId),
      orderBy: asc(storyPages.pageNumber),
    });

    if (!pages.length) {
      return NextResponse.json({ error: "No pages found" }, { status: 400 });
    }

    const allGenerated = pages.every((p) => !!p.imageUrl);
    if (!allGenerated) {
      return NextResponse.json(
        { error: "Not all pages illustrated yet" },
        { status: 400 }
      );
    }

    stage = "collect-images";

    // Collect spread image URLs
    const spreads: { label: string; url: string }[] = [];

    if (story.coverSpreadUrl) {
      spreads.push({ label: "Cover", url: story.coverSpreadUrl });
    }

    for (let i = 0; i < pages.length; i += 2) {
      const left = pages[i];
      if (!left.imageUrl) continue;
      const right = pages[i + 1];
      spreads.push({
        label: right
          ? `Pages ${left.pageNumber}–${right.pageNumber}`
          : `Page ${left.pageNumber}`,
        url: left.imageUrl,
      });
    }

    console.log(`📄 Home print: ${spreads.length} spreads to export`);

    stage = "fetch-images";

    // Fetch all images in parallel
    const imageData = await Promise.all(
      spreads.map(async ({ label, url }) => {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Failed to fetch: ${label}`);
        const buf = await res.arrayBuffer();
        const ct = res.headers.get("content-type") || "";
        return { label, bytes: new Uint8Array(buf), isJpg: ct.includes("jpeg") || ct.includes("jpg") || url.endsWith(".jpg") };
      })
    );

    stage = "build-pdf";

    const pdf = await PDFDocument.create();
    pdf.setTitle(story.title || "FlipWhizz Storybook");
    pdf.setAuthor("FlipWhizz");
    pdf.setSubject("Print-at-home children's storybook");
    pdf.setCreator("FlipWhizz — flipwhizz.com");

    const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const fontReg = await pdf.embedFont(StandardFonts.Helvetica);

    // ── PAGE 1: Instructions ──────────────────────────────────────────
    const instrPage = pdf.addPage([A4_W, A4_H]);

    // Cream background
    instrPage.drawRectangle({
      x: 0, y: 0, width: A4_W, height: A4_H,
      color: rgb(CREAM_R, CREAM_G, CREAM_B),
    });

    // Title
    const title = "How to Print Your Book";
    const titleW = fontBold.widthOfTextAtSize(title, 26);
    instrPage.drawText(title, {
      x: (A4_W - titleW) / 2,
      y: A4_H - 60,
      size: 26,
      font: fontBold,
      color: DEEP,
    });

    // Subtitle (story title)
    if (story.title) {
      const subW = fontReg.widthOfTextAtSize(story.title, 12);
      instrPage.drawText(story.title, {
        x: (A4_W - subW) / 2,
        y: A4_H - 82,
        size: 12,
        font: fontReg,
        color: LIGHT,
      });
    }

    // Instructions
    const steps = [
      {
        n: "1", t: "Print this PDF",
        b: "Use Landscape orientation and Fit to Page. For best results use thick paper (160-200gsm). Print double-sided if your printer supports it.",
      },
      {
        n: "2", t: "Cut out the cover",
        b: "The first printed page after this one is your wraparound cover (back, spine, front). Set it aside.",
      },
      {
        n: "3", t: "Fold each spread in half",
        b: "Take each interior page and fold it in half along the centre. The illustration faces outward. Left half = one page, right half = next page.",
      },
      {
        n: "4", t: "Stack the folded sheets",
        b: "Place all folded sheets inside each other in order. First spread on the outside, last in the centre.",
      },
      {
        n: "5", t: "Staple or sew the spine",
        b: "Staple 2-3 times along the fold. Or use a needle and thread through the crease. Or punch holes and tie with ribbon.",
      },
      {
        n: "6", t: "Wrap the cover around",
        b: "Fold the cover page along the spine, wrap it around the booklet, and glue or tape the edges. Your book is done!",
      },
    ];

    let y = A4_H - 120;
    const leftMargin = 110;
    const textWidth = A4_W - 200;

    for (const s of steps) {
      // Purple circle with step number
      instrPage.drawCircle({
        x: 80, y: y - 2,
        size: 11,
        color: PURPLE,
      });
      const nW = fontBold.widthOfTextAtSize(s.n, 11);
      instrPage.drawText(s.n, {
        x: 80 - nW / 2,
        y: y - 6,
        size: 11,
        font: fontBold,
        color: rgb(1, 1, 1),
      });

      // Step title
      instrPage.drawText(s.t, {
        x: leftMargin,
        y: y,
        size: 13,
        font: fontBold,
        color: DEEP,
      });

      // Step body — simple line wrapping
      const words = s.b.split(" ");
      let line = "";
      let lineY = y - 18;
      const fontSize = 10;
      const lineHeight = 14;

      for (const word of words) {
        const test = line ? `${line} ${word}` : word;
        if (fontReg.widthOfTextAtSize(test, fontSize) > textWidth) {
          instrPage.drawText(line, { x: leftMargin, y: lineY, size: fontSize, font: fontReg, color: MID });
          lineY -= lineHeight;
          line = word;
        } else {
          line = test;
        }
      }
      if (line) {
        instrPage.drawText(line, { x: leftMargin, y: lineY, size: fontSize, font: fontReg, color: MID });
        lineY -= lineHeight;
      }

      y = lineY - 16;
    }

    // Footer
    const footer = "Made with love on FlipWhizz — flipwhizz.com";
    const footerW = fontReg.widthOfTextAtSize(footer, 9);
    instrPage.drawText(footer, {
      x: (A4_W - footerW) / 2,
      y: 30,
      size: 9,
      font: fontReg,
      color: MUTED,
    });

    // ── SPREAD PAGES ──────────────────────────────────────────────────
    for (const img of imageData) {
      const page = pdf.addPage([A4_W, A4_H]);

      try {
        const embedded = img.isJpg
          ? await pdf.embedJpg(img.bytes)
          : await pdf.embedPng(img.bytes);

        // Scale to fill the page while maintaining aspect ratio
        const imgAspect = embedded.width / embedded.height;
        const pageAspect = A4_W / A4_H;

        let drawW: number, drawH: number, drawX: number, drawY: number;

        if (imgAspect > pageAspect) {
          // Image is wider — fit to width
          drawW = A4_W;
          drawH = A4_W / imgAspect;
          drawX = 0;
          drawY = (A4_H - drawH) / 2;
        } else {
          // Image is taller — fit to height
          drawH = A4_H;
          drawW = A4_H * imgAspect;
          drawX = (A4_W - drawW) / 2;
          drawY = 0;
        }

        page.drawImage(embedded, { x: drawX, y: drawY, width: drawW, height: drawH });
      } catch (err) {
        console.warn(`⚠️ Could not embed ${img.label}:`, err);
        // Grey placeholder
        page.drawRectangle({ x: 0, y: 0, width: A4_W, height: A4_H, color: rgb(0.94, 0.93, 0.96) });
        const errText = `Could not load: ${img.label}`;
        const errW = fontReg.widthOfTextAtSize(errText, 14);
        page.drawText(errText, { x: (A4_W - errW) / 2, y: A4_H / 2, size: 14, font: fontReg, color: MUTED });
      }
    }

    // ── BACK PAGE ─────────────────────────────────────────────────────
    const backPage = pdf.addPage([A4_W, A4_H]);
    backPage.drawRectangle({
      x: 0, y: 0, width: A4_W, height: A4_H,
      color: rgb(CREAM_R, CREAM_G, CREAM_B),
    });

    const msg1 = "This book was made for you.";
    const msg1W = fontBold.widthOfTextAtSize(msg1, 18);
    backPage.drawText(msg1, {
      x: (A4_W - msg1W) / 2,
      y: A4_H / 2 + 20,
      size: 18,
      font: fontBold,
      color: DEEP,
    });

    const msg2 = `"${story.title}" — created with FlipWhizz`;
    const msg2W = fontReg.widthOfTextAtSize(msg2, 11);
    backPage.drawText(msg2, {
      x: (A4_W - msg2W) / 2,
      y: A4_H / 2 - 5,
      size: 11,
      font: fontReg,
      color: LIGHT,
    });

    const msg3 = "flipwhizz.com";
    const msg3W = fontReg.widthOfTextAtSize(msg3, 10);
    backPage.drawText(msg3, {
      x: (A4_W - msg3W) / 2,
      y: A4_H / 2 - 25,
      size: 10,
      font: fontReg,
      color: MUTED,
    });

    stage = "serialize";
    const pdfBytes = await pdf.save();
    
    console.log(`✅ Home print PDF: ${pdfBytes.length} bytes, ${pdf.getPageCount()} pages`);
    
    stage = "upload-r2";
    const pdfUrl = await uploadPdfToR2(Buffer.from(pdfBytes), `${storyId}-home-print`);
    
    stage = "persist-url";
    await db
      .update(stories)
      .set({
        homePrintPdfUrl: pdfUrl,
        homePrintPdfUpdatedAt: new Date(),
      })
      .where(eq(stories.id, storyId));
    
    console.log(`✅ Home print PDF uploaded: ${pdfUrl}`);
    
    return NextResponse.json({ url: pdfUrl });

  } catch (err) {
    console.error("❌ Home print export failed", {
      stage,
      error: err instanceof Error ? err.message : err,
    });

    return NextResponse.json(
      {
        error: "Failed to export print-at-home PDF",
        stage,
        details: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}