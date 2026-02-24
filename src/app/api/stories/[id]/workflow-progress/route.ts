// src/app/api/stories/[id]/workflow-progress/route.ts
import { NextResponse } from "next/server";
import { db } from "@/db";
import { storyWorkflowProgress } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * GET /api/stories/[id]/workflow-progress
 * 
 * Returns the current workflow progress for a story.
 * Used by the ExtractWorldPage to poll for status updates.
 */
export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id: storyId } = await context.params;

  const progress = await db.query.storyWorkflowProgress.findFirst({
    where: eq(storyWorkflowProgress.storyId, storyId),
  });

  if (!progress) {
    return NextResponse.json({
      progress: null,
      message: "No progress record found. Workflow may not have started.",
    });
  }

  return NextResponse.json({
    progress: {
      // Phase 1: World Extraction
      charactersExtracted: progress.charactersExtracted,
      charactersExtractedAt: progress.charactersExtractedAt,
      
      locationsExtracted: progress.locationsExtracted,
      locationsExtractedAt: progress.locationsExtractedAt,
      
      styleExtracted: progress.styleExtracted,
      styleExtractedAt: progress.styleExtractedAt,
      
      // Phase 2: Spread Building
      spreadsBuilt: progress.spreadsBuilt,
      spreadsBuiltAt: progress.spreadsBuiltAt,
      
      // Phase 3: Scene Composition
      charactersAssigned: progress.charactersAssigned,
      charactersAssignedAt: progress.charactersAssignedAt,
      
      locationsAssigned: progress.locationsAssigned,
      locationsAssignedAt: progress.locationsAssignedAt,
      
      // Phase 4: Outfit Management (NEW)
      outfitsExtracted: progress.outfitsExtracted,
      outfitsExtractedAt: progress.outfitsExtractedAt,
      
      outfitsAssigned: progress.outfitsAssigned,
      outfitsAssignedAt: progress.outfitsAssignedAt,
      
      // Overall Status
      worldComplete: progress.worldComplete,
      worldCompleteAt: progress.worldCompleteAt,
      
      // Timestamps
      createdAt: progress.createdAt,
      updatedAt: progress.updatedAt,
    },
  });
}