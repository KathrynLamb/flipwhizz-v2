// src/app/api/admin/stories/[storyId]/retrigger/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { inngest } from "@/inngest/client";
import { db } from "@/db";
import { stories } from "@/db/schema";
import { eq } from "drizzle-orm";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL;

function isAdmin(email: string | null | undefined) {
  return ADMIN_EMAIL && email === ADMIN_EMAIL;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ storyId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session?.user?.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { storyId } = await params;
  const { event = "story/generate-spreads" } = await req.json().catch(() => ({}));

  const allowed = [
    "story/ensure-world",
    "story/build-spreads",
    "story/build-spread-prompts",
    "story/generate-spreads",
    "story/generate-spreads:force",
    "story/ensure-world:force",
    "story/generate.cover.spread",
  ];

  if (!allowed.includes(event)) {
    return NextResponse.json({ error: "Invalid event" }, { status: 400 });
  }

  const [story] = await db
    .select()
    .from(stories)
    .where(eq(stories.id, storyId))
    .limit(1);

  if (!story) {
    return NextResponse.json({ error: "Story not found" }, { status: 404 });
  }

  // The cover function replays the strategy the cover chat saved; without
  // one there is nothing to run.
  if (event === "story/generate.cover.spread" && !(story.coverPlan as any)?.generationStrategy) {
    return NextResponse.json(
      { error: "This story has no saved cover strategy yet. Generate the cover from the cover chat first." },
      { status: 400 }
    );
  }

  await db
    .update(stories)
    .set({ status: event === "story/generate.cover.spread" ? "generating_covers" : "generating", updatedAt: new Date() })
    .where(eq(stories.id, storyId));

  // ":force" = redraw every spread, even finished ones. For ensure-world the
  // flag is passed down the chain (decide scenes -> prompts -> drawing).
  const force = event.endsWith(":force");
  const name = force ? event.replace(/:force$/, "") : event;
  await inngest.send({
    name,
    // Admin retriggers may run on unpaid books (support/testing).
    data: force ? { storyId, force: true, allowUnpaid: true } : { storyId, allowUnpaid: true },
  });

  return NextResponse.json({ ok: true, storyId, event });
}