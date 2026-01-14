import { NextResponse } from "next/server";
import { db } from "@/db";
import { stories, orders } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { inngest } from "@/inngest/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: storyId } = await params;

  /* -------------------------------------------------
     1️⃣ Story exists
  -------------------------------------------------- */

  const story = await db.query.stories.findFirst({
    where: eq(stories.id, storyId),
  });

  if (!story) {
    return NextResponse.json({ error: "Story not found" }, { status: 404 });
  }

  /* -------------------------------------------------
     2️⃣ Purchase gate
  -------------------------------------------------- */

  const paid = await db.query.orders.findFirst({
    where: and(
      eq(orders.storyId, storyId),
      eq(orders.paymentStatus, "completed")
    ),
  });

  if (!paid) {
    return NextResponse.json(
      { error: "Story not purchased" },
      { status: 403 }
    );
  }

  /* -------------------------------------------------
     3️⃣ Dispatch background job
  -------------------------------------------------- */

  await inngest.send({
    name: "story/generate.character.avatars",
    data: { storyId },
  });

  return NextResponse.json({
    status: "queued",
    message: "Character avatar generation started",
  });
}
