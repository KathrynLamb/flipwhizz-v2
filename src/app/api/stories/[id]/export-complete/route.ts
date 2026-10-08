// src/app/api/stories/[id]/export-complete/route.ts

import { NextResponse } from "next/server";
import { db } from "@/db";
import { stories, storyPages, storyProducts, readers, storySpreads } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { uploadPdfToR2 } from "@/lib/uploadPdfToR2";
import { postProcessPdf } from "@/lib/postProcessPdf";
import { exportCompletePDF } from "print/gelato/exportCompletePDF";
import { getPrintSpec } from "@/lib/printSpecs";
import { withAccess } from "@/lib/authz";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function _POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  let stage = "start";

  try {
    stage = "params";
    const { id: storyId } = await params;

    console.log("🟡 export-complete: params", { storyId });

    if (!storyId) {
      return NextResponse.json({ error: "Missing story id" }, { status: 400 });
    }

    stage = "load-story";
    const story = await db.query.stories.findFirst({
      where: eq(stories.id, storyId),
    });

    console.log("🟡 export-complete: story loaded", {
      found: !!story,
      title: story?.title,
      hasCover: !!story?.coverSpreadUrl,
      readerId: story?.readerId ?? null,
    });

    if (!story) {
      return NextResponse.json({ error: "Story not found" }, { status: 404 });
    }

    stage = "load-reader";
    const reader = story.readerId
      ? await db.query.readers.findFirst({
          where: eq(readers.id, story.readerId),
          columns: {
            id: true,
            name: true,
          },
        })
      : null;

    console.log("🟡 export-complete: reader loaded", {
      found: !!reader,
      readerName: reader?.name ?? null,
    });

    stage = "load-product";
    const [storyProduct] = await db
      .select()
      .from(storyProducts)
      .where(eq(storyProducts.storyId, storyId))
      .limit(1);

    console.log("🟡 export-complete: story product", {
      productType: storyProduct?.productType,
      requiresShipping: storyProduct?.requiresShipping,
    });

    stage = "resolve-print-spec";
    const printSpec = getPrintSpec(storyProduct?.productType);

    console.log("🟡 export-complete: print spec", {
      productType: printSpec.productType,
      coverType: printSpec.coverType,
      uidPresent: !!printSpec.gelatoProductUid,
      uid: printSpec.gelatoProductUid,
      totalProductPageCount: printSpec.totalProductPageCount,
      interiorPageTarget: printSpec.interiorPageTarget,
      apiKeyPresent: !!process.env.GELATO_API_KEY,
    });

    if (!printSpec.gelatoProductUid) {
      throw new Error(
        `Missing Gelato product UID for ${printSpec.productType}. Check environment variables.`
      );
    }

    if (!process.env.GELATO_API_KEY) {
      throw new Error("Missing GELATO_API_KEY environment variable");
    }

    stage = "validate-cover";
    if (!story.coverSpreadUrl) {
      return NextResponse.json(
        { error: "Cover not generated yet" },
        { status: 400 }
      );
    }

    stage = "load-pages";
    const pages = await db.query.storyPages.findMany({
      where: eq(storyPages.storyId, storyId),
      orderBy: asc(storyPages.pageNumber),
    });

    console.log("🟡 export-complete: pages loaded", {
      count: pages.length,
      first: pages[0]?.pageNumber,
      last: pages[pages.length - 1]?.pageNumber,
    });

    if (!pages.length) {
      return NextResponse.json(
        { error: "No story pages found" },
        { status: 400 }
      );
    }

    const allGenerated = pages.every((p) => !!p.imageUrl);
    console.log("🟡 export-complete: allGenerated", { allGenerated });

    if (!allGenerated) {
      return NextResponse.json(
        { error: "Not all pages have been illustrated yet" },
        { status: 400 }
      );
    }

    // Typeset spreads print as picture + vector text layer (sharp text).
    // Only when the saved text-free art is exactly what's on the page.
    stage = "load-text-layers";
    const layers = new Map<string, { artUrl: string; textSvgUrl: string }>();
    try {
      const spreadRows = await db
        .select({ leftPageId: storySpreads.leftPageId, qa: storySpreads.qa })
        .from(storySpreads)
        .where(eq(storySpreads.storyId, storyId));
      const pageUrl = new Map(pages.map((p) => [p.id, p.imageUrl]));
      for (const r of spreadRows) {
        const qa = (r.qa ?? null) as { artUrl?: string; finalUrl?: string; typeset?: { svgUrl?: string | null } } | null;
        if (r.leftPageId && qa?.artUrl && qa.typeset?.svgUrl && qa.finalUrl && qa.finalUrl === pageUrl.get(r.leftPageId)) {
          layers.set(r.leftPageId, { artUrl: qa.artUrl, textSvgUrl: qa.typeset.svgUrl });
        }
      }
    } catch (err) {
      console.warn("export-complete: text layers unavailable, printing page pictures", err);
    }

    stage = "build-interior-pages";
    const interiorPages: Array<{
      pageNumber: number;
      spreadImageUrl: string;
      side: "left" | "right";
      artUrl?: string;
      textSvgUrl?: string;
    }> = [];

    for (let i = 0; i < pages.length; i += 2) {
      const leftPage = pages[i];
      const rightPage = pages[i + 1];

      if (!leftPage?.imageUrl) continue;

      const layer = layers.get(leftPage.id);
      interiorPages.push({
        pageNumber: leftPage.pageNumber,
        spreadImageUrl: leftPage.imageUrl,
        side: "left",
        ...(layer ?? {}),
      });

      if (rightPage) {
        interiorPages.push({
          pageNumber: rightPage.pageNumber,
          spreadImageUrl: leftPage.imageUrl,
          side: "right",
          ...(layer ?? {}),
        });
      }
    }

    console.log("🟡 export-complete: interior pages built", {
      count: interiorPages.length,
      target: printSpec.interiorPageTarget,
    });

    if (interiorPages.length > printSpec.interiorPageTarget) {
      return NextResponse.json(
        {
          error: `Too many interior pages for ${printSpec.productType}. Got ${interiorPages.length}, max supported is ${printSpec.interiorPageTarget}.`,
        },
        { status: 400 }
      );
    }

    stage = "export-pdf";
    console.log("🟡 export-complete: calling exportCompletePDF", {
      storyTitle: story.title ?? null,
      readerName: reader?.name ?? null,
    });

    const rawPdfBuffer = await exportCompletePDF(
      {
        coverSpreadUrl: story.coverSpreadUrl,
        interiorPages,
        storyTitle: story.title ?? undefined,
        readerName: reader?.name ?? undefined,
      },
      printSpec.gelatoProductUid,
      process.env.GELATO_API_KEY,
      printSpec
    );

    console.log("🟢 export-complete: raw PDF generated", {
      bytes: rawPdfBuffer.length,
    });

    stage = "post-process";
    const pdfBuffer = await postProcessPdf(rawPdfBuffer);

    console.log("🟢 export-complete: PDF post-processed", {
      bytes: pdfBuffer.length,
    });

    stage = "upload-r2";
    const pdfUrl = await uploadPdfToR2(pdfBuffer, storyId);

    console.log("🟢 export-complete: PDF uploaded", { pdfUrl });

    stage = "persist-url";
    await db
      .update(stories)
      .set({
        pdfUrl,
        pdfUpdatedAt: new Date(),
      })
      .where(eq(stories.id, storyId));

    console.log("🟢 export-complete: complete");

    return NextResponse.json({
      url: pdfUrl,
      productType: printSpec.productType,
      coverType: printSpec.coverType,
      readerName: reader?.name ?? null,
    });
  } catch (err) {
    console.error("❌ Export complete PDF failed", {
      stage,
      error: err instanceof Error ? err.message : err,
      stack: err instanceof Error ? err.stack : undefined,
    });

    return NextResponse.json(
      {
        error: "Failed to export PDF",
        stage,
        details: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export const POST = withAccess({ story: { param: "id" } }, _POST);
