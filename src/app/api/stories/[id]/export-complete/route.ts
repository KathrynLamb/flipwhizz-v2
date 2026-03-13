// src/app/api/stories/[id]/export-complete/route.ts

import { NextResponse } from "next/server";
import { db } from "@/db";
import { stories, storyPages, storyProducts } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { uploadPdfToR2 } from "@/lib/uploadPdfToR2";
import { postProcessPdf } from "@/lib/postProcessPdf";
import { exportCompletePDF } from "print/gelato/exportCompletePDF";
import { getPrintSpec } from "@/lib/printSpecs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
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
    });

    if (!story) {
      return NextResponse.json({ error: "Story not found" }, { status: 404 });
    }

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

    stage = "build-interior-pages";
    const interiorPages: Array<{
      pageNumber: number;
      spreadImageUrl: string;
      side: "left" | "right";
    }> = [];

    for (let i = 0; i < pages.length; i += 2) {
      const leftPage = pages[i];
      const rightPage = pages[i + 1];

      if (!leftPage?.imageUrl) continue;

      interiorPages.push({
        pageNumber: leftPage.pageNumber,
        spreadImageUrl: leftPage.imageUrl,
        side: "left",
      });

      if (rightPage) {
        interiorPages.push({
          pageNumber: rightPage.pageNumber,
          spreadImageUrl: leftPage.imageUrl,
          side: "right",
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
    console.log("🟡 export-complete: calling exportCompletePDF");

    const rawPdfBuffer = await exportCompletePDF(
      {
        coverSpreadUrl: story.coverSpreadUrl,
        interiorPages,
        storyTitle: story.title ?? undefined,
        childName: story.childName ?? "child",
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