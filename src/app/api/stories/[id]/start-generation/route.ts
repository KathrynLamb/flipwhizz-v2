import { getStoryFormat } from "@/lib/books/storyFormat";
// api/stories/[id]/start-generation
import { inngest } from "@/inngest/client";
import { NextResponse } from "next/server";
import { withAccess } from "@/lib/authz";

/**
 * Starts spread generation for a story.
 *
 * IMPORTANT:
 * - This route intentionally does NOT update stories.status.
 * - Workflow state transitions must be handled exclusively via:
 *   POST /api/stories/[id]/status
 */
async function _POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: storyId } = await params;
    const format = await getStoryFormat(storyId);
    if (!format.confirmed) return NextResponse.json({ error: "Confirm your colouring storybook format using the banner above before generating illustrations." }, { status: 409 });

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

export const POST = withAccess({ story: { param: "id" } }, _POST);
