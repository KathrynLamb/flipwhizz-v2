// src/app/api/stories/[id]/build-spreads/route.ts
import { NextResponse } from "next/server";
import { inngest } from "@/inngest/client";

export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: storyId } = await params;

  if (!storyId) {
    return NextResponse.json(
      { ok: false, error: "Missing storyId" },
      { status: 400 }
    );
  }

  await inngest.send({
    name: "story/build-spreads", // ✅ MUST MATCH your Inngest function event
    data: { storyId },
  });

  return NextResponse.json({
    ok: true,
    storyId,
    message: "story/build-spreads dispatched",
  });
}
