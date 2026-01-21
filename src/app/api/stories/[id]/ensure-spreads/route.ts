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

  try {
    // Load story and check spreads
    const [story, existingSpreads] = await Promise.all([
      db.query.stories.findFirst({
        where: eq(stories.id, storyId),
        columns: { id: true, status: true },
      }),
      db.query.storySpreads.findMany({
        where: eq(storySpreads.storyId, storyId),
        limit: 1,
      }),
    ]);

    if (!story) {
      return NextResponse.json({ error: "Story not found" }, { status: 404 });
    }

    // If spreads exist and story is marked ready, we're done
    if (existingSpreads.length > 0 && story.status === "spreads_ready") {
      return NextResponse.json({ 
        status: "ready",
        spreadsExist: true,
      });
    }

    // If spreads exist but status is wrong, fix it
    if (existingSpreads.length > 0 && story.status !== "spreads_ready") {
      await db
        .update(stories)
        .set({ status: "spreads_ready", updatedAt: new Date() })
        .where(eq(stories.id, storyId));

      return NextResponse.json({ 
        status: "ready",
        spreadsExist: true,
        statusFixed: true,
      });
    }

    // If currently building, return building status
    if (story.status === "building_spreads") {
      return NextResponse.json({ status: "building_spreads" });
    }

    // If error state, reset and try again
    if (story.status === "error") {
      await db
        .update(stories)
        .set({ status: "building_spreads", updatedAt: new Date() })
        .where(eq(stories.id, storyId));

      await inngest.send({
        name: "story/build.spreads",
        data: { storyId },
      });

      return NextResponse.json({ 
        status: "building_spreads",
        retry: true,
      });
    }

    // Start building spreads
    await db
      .update(stories)
      .set({ status: "building_spreads", updatedAt: new Date() })
      .where(eq(stories.id, storyId));

    await inngest.send({
      name: "story/build.spreads",
      data: { storyId },
    });

    return NextResponse.json({ status: "building_spreads" });
  } catch (error) {
    console.error("[ensure-spreads] Error:", error);
    
    // Try to set error status
    try {
      await db
        .update(stories)
        .set({ status: "error", updatedAt: new Date() })
        .where(eq(stories.id, storyId));
    } catch (updateError) {
      console.error("[ensure-spreads] Failed to update error status:", updateError);
    }
    
    return NextResponse.json(
      { error: "Failed to ensure spreads", details: String(error) },
      { status: 500 }
    );
  }
}