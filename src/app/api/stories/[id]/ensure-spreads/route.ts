import { NextResponse } from "next/server";
import { db } from "@/db";
import { stories, storySpreads } from "@/db/schema";
import { eq } from "drizzle-orm";
import { inngest } from "@/inngest/client";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: storyId } = await params;

  const story = await db.query.stories.findFirst({
    where: eq(stories.id, storyId),
    columns: { id: true, status: true },
  });

  if (!story) {
    return NextResponse.json({ error: "Story not found" }, { status: 404 });
  }

  // Already done → no-op
  if (story.status === "spreads_ready") {
    return NextResponse.json({ status: "ready" });
  }

  // Dispatch ONCE
  if (story.status !== "building_spreads") {
    await db
      .update(stories)
      .set({ status: "building_spreads", updatedAt: new Date() })
      .where(eq(stories.id, storyId));

    await inngest.send({
      name: "story/build.spreads",
      data: { storyId },
    });
  }

  return NextResponse.json({ status: "building_spreads" });
}
