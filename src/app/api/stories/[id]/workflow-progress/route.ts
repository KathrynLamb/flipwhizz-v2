// src/app/api/stories/[id]/workflow-progress/route.ts
import { NextResponse } from "next/server";
import { db } from "@/db";
import { storyWorkflowProgress } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * GET /api/stories/[id]/workflow-progress
 * 
 * Returns the current progress of world-building workflow.
 * Used by frontend to poll for updates.
 */
export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id: storyId } = await context.params;

  try {
    const progress = await db.query.storyWorkflowProgress.findFirst({
      where: eq(storyWorkflowProgress.storyId, storyId),
    });

    if (!progress) {
      return NextResponse.json({
        progress: null,
        message: "Workflow not started yet",
      });
    }

    return NextResponse.json({
      progress: {
        charactersExtracted: progress.charactersExtracted,
        locationsExtracted: progress.locationsExtracted,
        styleExtracted: progress.styleExtracted,
        spreadsBuilt: progress.spreadsBuilt,
        charactersAssigned: progress.charactersAssigned,
        locationsAssigned: progress.locationsAssigned,
        worldComplete: progress.worldComplete,
        
        // Timestamps for debugging
        charactersExtractedAt: progress.charactersExtractedAt,
        locationsExtractedAt: progress.locationsExtractedAt,
        styleExtractedAt: progress.styleExtractedAt,
        spreadsBuiltAt: progress.spreadsBuiltAt,
        charactersAssignedAt: progress.charactersAssignedAt,
        locationsAssignedAt: progress.locationsAssignedAt,
        worldCompleteAt: progress.worldCompleteAt,
      },
    });
  } catch (error) {
    console.error("Error fetching workflow progress:", error);
    return NextResponse.json(
      { error: "Failed to fetch progress" },
      { status: 500 }
    );
  }
}