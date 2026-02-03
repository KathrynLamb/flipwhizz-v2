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
       2. Validate cover (SINGLE WRAP SPREAD MODEL)
    -------------------------------------------------- */

    if (!story.coverSpreadUrl) {
      return NextResponse.json(
        { error: "Cover not generated yet" },
        { status: 400 }
      );
    }

    /* --------------------------------------------------
       3. Load interior pages
    -------------------------------------------------- */

    const pages = await db.query.storyPages.findMany({
      where: eq(storyPages.storyId, storyId),
      orderBy: asc(storyPages.pageNumber),
    });

    // ✅ NEW: Group pages into spreads (pairs of 2)
    const spreads: Array<{ left: typeof pages[0], right: typeof pages[0] | null }> = [];
    for (let i = 0; i < pages.length; i += 2) {
      spreads.push({
        left: pages[i],
        right: pages[i + 1] || null,
      });
    }

    // ✅ NEW: Convert spreads into individual printable pages with side info
    const printable: Array<{ 
      pageNumber: number; 
      spreadImageUrl: string; 
      side: 'left' | 'right' 
    }> = [];

    for (const spread of spreads) {
      if (spread.left.imageUrl) {
        // Add left page
        printable.push({
          pageNumber: spread.left.pageNumber,
          spreadImageUrl: spread.left.imageUrl,
          side: 'left',
        });

        // Add right page if it exists (using same spread image)
        if (spread.right) {
          printable.push({
            pageNumber: spread.right.pageNumber,
            spreadImageUrl: spread.left.imageUrl, // Same spread image!
            side: 'right',
          });
        }
      }
    }

    if (!printable.length) {
      return NextResponse.json(
        { error: "No illustrated pages to export" },
        { status: 400 }
      );
    }

    /* --------------------------------------------------
       4. Generate complete Gelato-ready PDF
       (Cover wrap + interior pages)
    -------------------------------------------------- */

    const pdfBuffer = await exportCompletePDF(
      {
        coverSpreadUrl: story.coverSpreadUrl,
        interiorPages: printable,
      },
      process.env.GELATO_PRODUCT_UID!,
      process.env.GELATO_API_KEY!
    );

    /* --------------------------------------------------
       5. Upload to Firebase
    -------------------------------------------------- */

    const pdfUrl = await uploadPdfToFirebase(pdfBuffer, storyId);

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