
// api/orders/check-ready/route.ts - Check if story is ready to order
import { NextResponse } from "next/server";
import { db } from "@/db";
import { stories } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const storyId = searchParams.get("storyId");

  if (!storyId) {
    return NextResponse.json({ error: "Missing storyId" }, { status: 400 });
  }

  const story = await db.query.stories.findFirst({
    where: eq(stories.id, storyId),
  });

  if (!story) {
    return NextResponse.json({ error: "Story not found" }, { status: 404 });
  }

  const readiness = {
    hasPdf: !!story.pdfUrl,
    hasPayment: story.paymentStatus === "paid",
    hasCovers: !!(story.frontCoverUrl && story.backCoverUrl),
    isReady: false,
    missingItems: [] as string[],
  };

  if (!readiness.hasPdf) readiness.missingItems.push("PDF not generated");
  if (!readiness.hasPayment) readiness.missingItems.push("Payment required");
  if (!readiness.hasCovers) readiness.missingItems.push("Covers not ready");

  readiness.isReady = 
    readiness.hasPdf && 
    readiness.hasPayment && 
    readiness.hasCovers;

  return NextResponse.json(readiness);
}