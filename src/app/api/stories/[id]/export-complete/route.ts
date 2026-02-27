import { NextResponse } from "next/server";
import { db } from "@/db";
import { stories, storyPages } from "@/db/schema";
import { eq, asc } from "drizzle-orm";

import { exportCompletePDF } from "print/gelato/exportCompletePDF";
import { uploadPdfToFirebase } from "@/lib/uploadPdfToFirebase";

export const runtime = "nodejs";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: storyId } = await params;

    if (!storyId) {
      return NextResponse.json(
        { error: "Missing story id" },
        { status: 400 }
      );
    }

    /* --------------------------------------------------
       1. Load story
    -------------------------------------------------- */

    const story = await db.query.stories.findFirst({
      where: eq(stories.id, storyId),
    });

    if (!story) {
      return NextResponse.json(
        { error: "Story not found" },
        { status: 404 }
      );
    }

    /* --------------------------------------------------
       2. Validate cover
    -------------------------------------------------- */

    // if (!story.coverSpreadUrl) {
    //   return NextResponse.json(
    //     { error: "Cover not generated yet" },
    //     { status: 400 }
    //   );
    // }

    /* --------------------------------------------------
       3. Load interior pages
    -------------------------------------------------- */

    const pages = await db.query.storyPages.findMany({
      where: eq(storyPages.storyId, storyId),
      orderBy: asc(storyPages.pageNumber),
    });

    // Check all pages have images
    const allGenerated = pages.every(p => p.imageUrl);
    if (!allGenerated) {
      return NextResponse.json(
        { error: "Not all pages have been illustrated yet" },
        { status: 400 }
      );
    }

    // ✅ Build the correct structure: each spread image becomes TWO pages
    const interiorPages: Array<{
      pageNumber: number;
      spreadImageUrl: string;
      side: 'left' | 'right';
    }> = [];

    // Group pages into spreads
    for (let i = 0; i < pages.length; i += 2) {
      const leftPage = pages[i];
      const rightPage = pages[i + 1];

      if (!leftPage.imageUrl) continue;

      // Left side of spread
      interiorPages.push({
        pageNumber: leftPage.pageNumber,
        spreadImageUrl: leftPage.imageUrl,
        side: 'left',
      });

      // Right side of spread (if it exists)
      if (rightPage) {
        interiorPages.push({
          pageNumber: rightPage.pageNumber,
          spreadImageUrl: leftPage.imageUrl, // Same spread image!
          side: 'right',
        });
      }
    }

    console.log("📄 Exporting PDF:", {
      storyId,
      coverUrl: story.coverSpreadUrl,
      totalPages: interiorPages.length,
    });

    console.log("🔑 Env check:", {
      hasGelatoKey: !!process.env.GELATO_API_KEY,
      hasGelatoProduct: !!process.env.GELATO_PRODUCT_UID,
      keyPrefix: process.env.GELATO_API_KEY?.substring(0, 8), // just first 8 chars
    });

    /* --------------------------------------------------
       4. Generate complete Gelato-ready PDF
    -------------------------------------------------- */

    const pdfBuffer = await exportCompletePDF(

      {
        coverSpreadUrl: story.coverSpreadUrl,
        interiorPages,
      },
      process.env.GELATO_PRODUCT_UID!,
      process.env.GELATO_API_KEY!
    );

    console.log("✅ PDF generated, size:", pdfBuffer.length, "bytes");

    /* --------------------------------------------------
       5. Upload to Firebase
    -------------------------------------------------- */

    const pdfUrl = await uploadPdfToFirebase(pdfBuffer, storyId);

    console.log("✅ PDF uploaded to:", pdfUrl);

    /* --------------------------------------------------
       6. Persist PDF URL
    -------------------------------------------------- */

    await db
      .update(stories)
      .set({
        pdfUrl,
        pdfUpdatedAt: new Date(),
      })
      .where(eq(stories.id, storyId));

    return NextResponse.json({ url: pdfUrl });
  } catch (err) {
    console.error("❌ Export complete PDF failed:", err);

    return NextResponse.json(
      {
        error: "Failed to export PDF",
        details:
          err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}