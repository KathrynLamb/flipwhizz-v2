// src/app/api/inngest/job-status/[jobId]/route.ts
//
// The preview page polls this while a spread is being drawn.
// jobId format: "leftPageId__storyId" (storyId part is ignored here)
//
// "done"       → the left page has an image
// "error"      → the drawing job gave up (spreadWorker's markGaveUp stamped
//                qa.failedRun on the spread) after this request started, so the
//                customer gets "try again" straight away instead of a 25-minute
//                spinner
// "generating" → still working
//
// Optional ?since=<ms epoch>: when the client started waiting. A failure stamped
// before that belongs to an older attempt and is ignored.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { storyPages, storySpreads } from "@/db/schema";
import { eq } from "drizzle-orm";
import { withAccess } from "@/lib/authz";

// The job's run stamp is the Inngest event time, which can be a little earlier
// than the browser's clock when it started polling. Allow for that.
const CLOCK_SKEW_MS = 60_000;

async function _GET(
  req: NextRequest,
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

  const sinceParam = Number(req.nextUrl.searchParams.get("since"));
  const since = Number.isFinite(sinceParam) && sinceParam > 0 ? sinceParam : 0;

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

    // No image yet. Did the job give up?
    if (since) {
      const spread = await db
        .select({ qa: storySpreads.qa })
        .from(storySpreads)
        .where(eq(storySpreads.leftPageId, leftPageId))
        .limit(1)
        .then((r) => r[0] ?? null);

      const qa = (spread?.qa && typeof spread.qa === "object" ? spread.qa : {}) as Record<string, unknown>;
      const failedRun = Number(qa.failedRun ?? 0);
      const latestRun = Number(qa.latestRun ?? 0);

      if (failedRun > 0 && failedRun >= latestRun && failedRun >= since - CLOCK_SKEW_MS) {
        return NextResponse.json({ status: "error" });
      }
    }

    // Image not yet written — Inngest is still working
    return NextResponse.json({ status: "generating" });

  } catch (err) {
    console.error("[job-status]", err);
    // Keep polling rather than showing a raw error to the customer.
    return NextResponse.json({ status: "generating" });
  }
}

export const GET = withAccess({ login: true }, _GET);
