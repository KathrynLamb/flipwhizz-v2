import { inngest } from "@/inngest/client";
import { NextResponse } from "next/server";

/**
 * Starts spread generation for a story.
 *
 * IMPORTANT:
 * - This route intentionally does NOT update stories.status.
 * - Workflow state transitions must be handled exclusively via:
 *   POST /api/stories/[id]/status
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: storyId } = await params;

  if (!storyId) {
    return NextResponse.json(
      { error: "Missing story id" },
      { status: 400 }
    );
  }

  // Trigger async generation work (idempotent on Inngest side)
  await inngest.send({
    name: "story/generate.spreads",
    data: { storyId },
  });

  return NextResponse.json({ success: true });
}
