import { NextResponse } from "next/server";
import { inngest } from "@/inngest/client";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // ✅ MUST await params
  const { id: storyId } = await params;

  if (!storyId) {
    return NextResponse.json(
      { ok: false, error: "Missing storyId" },
      { status: 400 }
    );
  }

  await inngest.send({
    name: "story/build-spreads",
    data: { storyId },
  });

  return NextResponse.json({
    ok: true,
    storyId,
    message: "build-spreads dispatched",
  });
}
