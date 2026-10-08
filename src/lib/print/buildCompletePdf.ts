// src/lib/print/buildCompletePdf.ts
//
// Builds the complete book PDF (cover + interior, at Gelato's sizes),
// uploads it to R2 and, when asked, saves it as the book's print PDF
// (stories.pdf_url, the file new print orders send to Gelato).
//
// Used by the customer's "Export PDF" (/api/stories/[id]/export-complete)
// and by the admin Book page, so what admin previews is exactly what prints.
//
// A preview is never saved on the book. It also works for books that
// aren't finished (a page or cover without a picture is a grey placeholder
// page, so everything stays in its place) and for digital books (laid out
// as the standard printed book).

import { db } from "@/db";
import { stories, storyPages, storyProducts, readers } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { uploadPdfToR2 } from "@/lib/uploadPdfToR2";
import { postProcessPdf } from "@/lib/postProcessPdf";
import { exportCompletePDF, type ExportData } from "print/gelato/exportCompletePDF";
import { getPrintSpec } from "@/lib/printSpecs";

/** A refusal the caller should show as it is (status 400/404), or a failure (500). */
export class PdfBuildError extends Error {
  constructor(
    public status: 400 | 404 | 500,
    message: string,
    public stage: string
  ) {
    super(message);
    this.name = "PdfBuildError";
  }
}

export type PdfBuildResult = {
  url: string;
  productType: "print" | "gift";
  coverType: string;
  readerName: string | null;
  /** Interior pages in the PDF, placeholders included. */
  interiorPages: number;
  /** Page numbers shown as placeholders because they have no picture yet (previews only). */
  missingPages: number[];
  hasCover: boolean;
  /** A digital book laid out as the standard printed book (previews only). */
  specFallback: boolean;
  /** Same file a print build would make right now: cover, every page, the book's own product. */
  complete: boolean;
  /** The pictures it was made from, to tell later whether they've changed since. */
  sources: { cover: string | null; pictures: string[] };
  saved: boolean;
};

export async function buildCompletePdf(storyId: string, opts: { save: boolean; preview?: boolean }): Promise<PdfBuildResult> {
  const preview = !!opts.preview;
  let stage = "load-story";
  try {
    const story = await db.query.stories.findFirst({ where: eq(stories.id, storyId) });
    if (!story) throw new PdfBuildError(404, "Story not found", stage);

    stage = "load-reader";
    const reader = story.readerId
      ? await db.query.readers.findFirst({ where: eq(readers.id, story.readerId), columns: { id: true, name: true } })
      : null;

    stage = "load-product";
    const [storyProduct] = await db.select().from(storyProducts).where(eq(storyProducts.storyId, storyId)).limit(1);

    stage = "resolve-print-spec";
    let printSpec: ReturnType<typeof getPrintSpec>;
    let specFallback = false;
    try {
      printSpec = getPrintSpec(storyProduct?.productType);
    } catch (err) {
      // A digital book has no print product; a preview lays it out as the standard printed book.
      if (!preview) throw err;
      printSpec = getPrintSpec("print");
      specFallback = true;
    }
    if (!printSpec.gelatoProductUid) {
      throw new Error(`Missing Gelato product UID for ${printSpec.productType}. Check environment variables.`);
    }
    if (!process.env.GELATO_API_KEY) throw new Error("Missing GELATO_API_KEY environment variable");

    stage = "validate-cover";
    if (!story.coverSpreadUrl && !preview) throw new PdfBuildError(400, "Cover not generated yet", stage);

    stage = "load-pages";
    const pages = await db.query.storyPages.findMany({ where: eq(storyPages.storyId, storyId), orderBy: asc(storyPages.pageNumber) });
    if (!pages.length) throw new PdfBuildError(400, "No story pages found", stage);
    if (!preview && !pages.every((p) => !!p.imageUrl)) {
      throw new PdfBuildError(400, "Not all pages have been illustrated yet", stage);
    }

    stage = "build-interior-pages";
    // Pages go in pairs; the spread picture is on the left page of each pair.
    const interiorPages: ExportData["interiorPages"] = [];
    const missingPages: number[] = [];
    const pictures: string[] = [];
    for (let i = 0; i < pages.length; i += 2) {
      const leftPage = pages[i];
      const rightPage = pages[i + 1];
      const url = leftPage.imageUrl || null;
      if (url) pictures.push(url);
      const numbers = rightPage ? `Pages ${leftPage.pageNumber}-${rightPage.pageNumber}` : `Page ${leftPage.pageNumber}`;
      for (const p of rightPage ? [leftPage, rightPage] : [leftPage]) {
        if (!url) missingPages.push(p.pageNumber);
        interiorPages.push({
          pageNumber: p.pageNumber,
          spreadImageUrl: url,
          side: p === leftPage ? "left" : "right",
          ...(url ? {} : { label: `${numbers}: not drawn yet` }),
        });
      }
    }
    if (missingPages.length === interiorPages.length) throw new PdfBuildError(400, "No pages have pictures yet", stage);
    if (interiorPages.length > printSpec.interiorPageTarget) {
      throw new PdfBuildError(
        400,
        `Too many interior pages for ${printSpec.productType}. Got ${interiorPages.length}, max supported is ${printSpec.interiorPageTarget}.`,
        stage
      );
    }

    stage = "export-pdf";
    const rawPdfBuffer = await exportCompletePDF(
      {
        coverSpreadUrl: story.coverSpreadUrl,
        ...(preview ? { coverLabel: "No cover yet" } : {}),
        interiorPages,
        storyTitle: story.title ?? undefined,
        readerName: reader?.name ?? undefined,
      },
      printSpec.gelatoProductUid,
      process.env.GELATO_API_KEY,
      printSpec
    );

    stage = "post-process";
    const pdfBuffer = await postProcessPdf(rawPdfBuffer);

    stage = "upload-r2";
    const url = await uploadPdfToR2(pdfBuffer, storyId);

    if (opts.save) {
      stage = "persist-url";
      await db.update(stories).set({ pdfUrl: url, pdfUpdatedAt: new Date() }).where(eq(stories.id, storyId));
    }

    return {
      url,
      productType: printSpec.productType,
      coverType: printSpec.coverType,
      readerName: reader?.name ?? null,
      interiorPages: interiorPages.length,
      missingPages,
      hasCover: !!story.coverSpreadUrl,
      specFallback,
      complete: !!story.coverSpreadUrl && missingPages.length === 0 && !specFallback,
      sources: { cover: story.coverSpreadUrl ?? null, pictures },
      saved: opts.save,
    };
  } catch (err) {
    if (err instanceof PdfBuildError) throw err;
    throw new PdfBuildError(500, err instanceof Error ? err.message : String(err), stage);
  }
}
