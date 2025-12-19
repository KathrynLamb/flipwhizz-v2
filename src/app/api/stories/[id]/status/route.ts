import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { stories } from "@/db/schema";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";

/**
 * Update story status
 *
 * Body:
 * {
 *   status: string
 * }
 */
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: storyId } = await context.params;

    if (!storyId) {
      return NextResponse.json(
        { error: "Missing story id" },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { status } = body;

    if (!status || typeof status !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid status" },
        { status: 400 }
      );
    }

    const ALLOWED_STATUSES = new Set([
      "extracting",
      "world_ready",
      "characters_ready",
      "locations_ready",
      "style_ready",
      "paid",
      "generating",
      "done",
    ]);

    if (!ALLOWED_STATUSES.has(status)) {
      return NextResponse.json(
        { error: `Invalid status: ${status}` },
        { status: 400 }
      );
    }

    const updated = await db
      .update(stories)
      .set({
        status,
        updatedAt: new Date(),
      })
      .where(eq(stories.id, storyId))
      .returning({
        id: stories.id,
        status: stories.status,
      });

    if (!updated.length) {
      return NextResponse.json(
        { error: "Story not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      story: updated[0],
    });
  } catch (err) {
    console.error("❌ Failed to update story status:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
