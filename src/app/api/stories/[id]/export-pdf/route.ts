// src/app/api/stories/[id]/export-pdf/route.ts
import { NextResponse } from "next/server";
import { db } from "@/db";
import { storyPages } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import path from "path";
import fs from "fs/promises";
import { exportInteriorPDF } from "print/gelato/exportInteriorPDF";

export const runtime = "nodejs";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: storyId } = await params;

    if (!storyId) {
      return NextResponse.json({ error: "Missing story id" }, { status: 400 });
    }

    const pages = await db.query.storyPages.findMany({
      where: eq(storyPages.storyId, storyId),
      orderBy: asc(storyPages.pageNumber),
    });

    console.log("📄 Total pages from DB:", pages.length);
    console.log("📄 Pages:", pages.map(p => ({ 
      pageNumber: p.pageNumber, 
      hasImage: !!p.imageUrl,
      imageUrl: p.imageUrl?.substring(0, 60) + '...'
    })));

    if (!pages.length) {
      return NextResponse.json({ error: "No pages found" }, { status: 404 });
    }

    // Group pages into spreads (pairs of 2)
    const spreads: Array<{ left: typeof pages[0], right: typeof pages[0] | null }> = [];
    for (let i = 0; i < pages.length; i += 2) {
      spreads.push({
        left: pages[i],
        right: pages[i + 1] || null,
      });
    }

    console.log("📖 Total spreads:", spreads.length);
    console.log("📖 Spreads structure:", spreads.map((s, i) => ({
      spreadIndex: i,
      leftPage: s.left.pageNumber,
      rightPage: s.right?.pageNumber || null,
      leftHasImage: !!s.left.imageUrl,
      rightHasImage: !!s.right?.imageUrl,
    })));

    // Convert spreads into individual printable pages
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

        // Add right page if it exists
        if (spread.right) {
          printable.push({
            pageNumber: spread.right.pageNumber,
            spreadImageUrl: spread.left.imageUrl, // Same spread image!
            side: 'right',
          });
        }
      }
    }

    console.log("🖨️  Total printable pages:", printable.length);
    console.log("🖨️  Printable structure:", printable.map(p => ({
      pageNumber: p.pageNumber,
      side: p.side,
      imageUrl: p.spreadImageUrl.substring(0, 60) + '...'
    })));

    if (!printable.length) {
      return NextResponse.json(
        { error: "No illustrated pages to export" },
        { status: 400 }
      );
    }

    const outDir = path.join(process.cwd(), "tmp");
    await fs.mkdir(outDir, { recursive: true });

    const filename = `story-${storyId}.pdf`;
    const outPath = path.join(outDir, filename);

    await exportInteriorPDF(printable, outPath);

    return NextResponse.json({
      url: `/api/stories/${storyId}/export-pdf/download`,
    });
  } catch (err) {
    console.error("❌ Export PDF failed:", err);
    return NextResponse.json(
      { error: "Failed to export PDF" },
      { status: 500 }
    );
  }
}