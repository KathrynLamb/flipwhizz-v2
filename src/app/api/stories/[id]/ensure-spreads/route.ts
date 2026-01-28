import { NextResponse } from "next/server";
import { db } from "@/db";
import { stories, storySpreads } from "@/db/schema";
import { eq } from "drizzle-orm";
import { inngest } from "@/inngest/client";

function log(step: string, data?: any) {
  const ts = new Date().toISOString();
  if (data !== undefined) {
    console.log(`🧱 [ensure-spreads] ${ts} ${step}`, data);
  } else {
    console.log(`🧱 [ensure-spreads] ${ts} ${step}`);
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: storyId } = await params;

  log("POST called", { storyId });

  try {
    log("loading story + existing spreads");

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

    log("db query results", {
      storyFound: Boolean(story),
      storyStatus: story?.status,
      spreadsFound: existingSpreads.length,
    });

    if (!story) {
      log("story not found – aborting");
      return NextResponse.json({ error: "Story not found" }, { status: 404 });
    }

    /* --------------------------------------------------
       CASE 1: spreads already exist AND marked ready
    -------------------------------------------------- */
    if (existingSpreads.length > 0 && story.status === "spreads_ready") {
      log("spreads already exist and story already ready – returning");
      return NextResponse.json({
        status: "ready",
        spreadsExist: true,
      });
    }

    /* --------------------------------------------------
       CASE 2: spreads exist but status wrong
    -------------------------------------------------- */
    if (existingSpreads.length > 0 && story.status !== "spreads_ready") {
      log("spreads exist but status incorrect – fixing status");

      await db
        .update(stories)
        .set({ status: "spreads_ready", updatedAt: new Date() })
        .where(eq(stories.id, storyId));

      log("status fixed to spreads_ready");

      return NextResponse.json({
        status: "ready",
        spreadsExist: true,
        statusFixed: true,
      });
    }

    /* --------------------------------------------------
       CASE 3: already building
    -------------------------------------------------- */
    if (story.status === "building_spreads") {
      log("already building spreads – returning early");
      return NextResponse.json({ status: "building_spreads" });
    }

    /* --------------------------------------------------
       CASE 4: error → retry
    -------------------------------------------------- */
    if (story.status === "error") {
      log("story in error state – resetting + re-triggering");

      await db
        .update(stories)
        .set({ status: "building_spreads", updatedAt: new Date() })
        .where(eq(stories.id, storyId));

      log("status set to building_spreads (retry)");

      log("sending inngest event (retry)");
      const sendResult = await inngest.send({
        name: "story/build.spreads",
        data: { storyId },
      });

      log("inngest.send result (retry)", sendResult);

      return NextResponse.json({
        status: "building_spreads",
        retry: true,
      });
    }

    /* --------------------------------------------------
       CASE 5: fresh start
    -------------------------------------------------- */
    log("starting fresh spread build");

    await db
      .update(stories)
      .set({ status: "building_spreads", updatedAt: new Date() })
      .where(eq(stories.id, storyId));

    log("status set to building_spreads");

    log("sending inngest event");
    const sendResult = await inngest.send({
      name: "story/build.spreads",
      data: { storyId },
    });

    log("inngest.send result", sendResult);

    log("returning building_spreads response");

    return NextResponse.json({ status: "building_spreads" });
  } catch (error) {
    log("🔥 UNCAUGHT ERROR", error);

    try {
      log("attempting to set story status = error");

      await db
        .update(stories)
        .set({ status: "error", updatedAt: new Date() })
        .where(eq(stories.id, storyId));

      log("status set to error");
    } catch (updateError) {
      log("❌ failed to update error status", updateError);
    }

    return NextResponse.json(
      {
        error: "Failed to ensure spreads",
        details: String(error),
      },
      { status: 500 }
    );
  }
}
