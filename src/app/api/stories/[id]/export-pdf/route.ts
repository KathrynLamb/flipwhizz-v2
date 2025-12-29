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

    if (!pages.length) {
      return NextResponse.json({ error: "No pages found" }, { status: 404 });
    }

    const printable = pages
      .filter(p => p.imageUrl)
      .map(p => ({
        pageNumber: p.pageNumber,
        imageUrl: p.imageUrl!,
      }));

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
