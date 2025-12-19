import { NextResponse } from "next/server";
import { db } from "@/db";
import {
  stories,
  storyPages,
  storyCharacters,
  storyLocations,
  storyPageCharacters,
  storyStyleGuide,
} from "@/db/schema";
import { eq, inArray, asc } from "drizzle-orm";
import { inngest } from "@/inngest/client";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: storyId } = await params;

  console.log("🔵 ensure-world called for story:", storyId);

  /* --------------------------------------------------
     1️⃣ Load core story + pages (hard requirement)
  -------------------------------------------------- */

  const story = await db.query.stories.findFirst({
    where: eq(stories.id, storyId),
  });

  if (!story) {
    return NextResponse.json({ error: "Story not found" }, { status: 404 });
  }

  const pages = await db.query.storyPages.findMany({
    where: eq(storyPages.storyId, storyId),
    orderBy: asc(storyPages.pageNumber),
    columns: { id: true, pageNumber: true },
  });

  if (pages.length === 0) {
    return NextResponse.json(
      { error: "Story has no pages" },
      { status: 400 }
    );
  }

  /* --------------------------------------------------
     2️⃣ Inspect current world state
  -------------------------------------------------- */

  const [charJoins, locJoins, presence, styleGuide] = await Promise.all([
    db.query.storyCharacters.findMany({
      where: eq(storyCharacters.storyId, storyId),
    }),
    db.query.storyLocations.findMany({
      where: eq(storyLocations.storyId, storyId),
    }),
    db.query.storyPageCharacters.findMany({
      where: inArray(
        storyPageCharacters.pageId,
        pages.map((p) => p.id)
      ),
    }),
    db.query.storyStyleGuide.findFirst({
      where: eq(storyStyleGuide.storyId, storyId),
    }),
  ]);

  const hasCharacters = charJoins.length > 0;
  const hasLocations = locJoins.length > 0;
  const hasPresence = presence.length > 0;
  const hasStyleText = !!styleGuide?.summary;

  console.log("📊 Current state:", {
    hasCharacters,
    hasLocations,
    hasPresence,
    hasStyleText,
  });

  /* --------------------------------------------------
     3️⃣ Dispatch ONLY what is missing (idempotent)
  -------------------------------------------------- */

  let jobsDispatched = false;

  if (!hasCharacters || !hasLocations || !hasPresence) {
    console.log("🚀 Dispatching extract-world job...");
    await inngest.send({
      name: "story/extract-world",
      data: { storyId },
    });
    jobsDispatched = true;
  }

  if (!hasStyleText) {
    console.log("🚀 Dispatching style generation job...");
    await inngest.send({
      name: "story/generate.style.text",
      data: { storyId },
    });
    jobsDispatched = true;
  }

  /* --------------------------------------------------
     4️⃣ Return immediately with status
  -------------------------------------------------- */

  if (jobsDispatched) {
    console.log("✅ Jobs dispatched, returning...");
    return NextResponse.json({
      status: "processing",
      message: "World extraction jobs dispatched",
      hasCharacters,
      hasLocations,
      hasPresence,
      hasStyleText,
    });
  }

  console.log("✅ World already complete!");
  return NextResponse.json({
    status: "complete",
    message: "World already exists",
    hasCharacters,
    hasLocations,
    hasPresence,
    hasStyleText,
  });
}