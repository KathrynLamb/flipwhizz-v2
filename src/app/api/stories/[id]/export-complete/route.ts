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
      return NextResponse.json({ error: "Missing story id" }, { status: 400 });
    }

    // 👉 Fetch story (covers + title)
    const story = await db.query.stories.findFirst({
      where: eq(stories.id, storyId),
    });

    if (!story) {
      return NextResponse.json({ error: "Story not found" }, { status: 404 });
    }

    if (!story.frontCoverUrl || !story.backCoverUrl) {
      return NextResponse.json(
        { error: "Covers not generated yet" },
        { status: 400 }
      );
    }

    // 👉 Fetch interior pages
    const pages = await db.query.storyPages.findMany({
      where: eq(storyPages.storyId, storyId),
      orderBy: asc(storyPages.pageNumber),
    });

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

    // 👉 Generate complete PDF buffer
    const pdfBuffer = await exportCompletePDF(
      {
        frontCoverUrl: story.frontCoverUrl,
        backCoverUrl: story.backCoverUrl,
        title: story.title ?? "Story",
        interiorPages: printable,
      },
      process.env.GELATO_PRODUCT_UID!,
      process.env.GELATO_API_KEY!
    );
    
    console.log("READY TO SEND YO UPLOAD TO FIREBASE +++++>>", pdfBuffer, storyId)
    // 👉 Upload to Firebase Storage
    const pdfUrl = await uploadPdfToFirebase(pdfBuffer, storyId);


    // 👉 Save URL in DB
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
        details: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
