// app/api/inngest/job-status/[jobId]/route.ts
//
// Polls by checking storyPages.imageUrl for leftPageId.
// No extra DB table needed.
// jobId format: "leftPageId__storyId" (storyId part is ignored here)

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { storyPages } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;

  // Format: "leftPageId__storyId" — we only need the leftPageId
  const leftPageId = jobId.split("__")[0];

  if (!leftPageId) {
    return NextResponse.json(
      { status: "error", error: "Invalid jobId format" },
      { status: 400 }
    );
  }

  try {
    const rows = await db
      .select({ imageUrl: storyPages.imageUrl })
      .from(storyPages)
      .where(eq(storyPages.id, leftPageId))
      .limit(1);

    const page = rows[0];

    if (!page) {
      return NextResponse.json(
        { status: "error", error: "Page not found" },
        { status: 404 }
      );
    }

    if (page.imageUrl) {
      return NextResponse.json({ status: "done", imageUrl: page.imageUrl });
    }

    // Image not yet written — Inngest is still working
    return NextResponse.json({ status: "generating" });

  } catch (err: any) {
    console.error("[job-status]", err);
    return NextResponse.json(
      { status: "error", error: err.message },
      { status: 500 }
    );
  }
}