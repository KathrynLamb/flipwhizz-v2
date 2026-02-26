// src/app/api/stories/[id]/confirm-locations/route.ts
import { NextResponse } from "next/server";
import { db } from "@/db";
import { stories, locations, storyLocations } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: storyId } = await params;

  // 1. Lock all locations linked to this story
  await db
    .update(locations)
    .set({ locked: true, lockedAt: new Date() })
    .where(
      eq(
        locations.id,
        db
          .select({ id: storyLocations.locationId })
          .from(storyLocations)
          .where(eq(storyLocations.storyId, storyId))
      )
    );

  // 2. Add "locations" to completedSteps
  const story = await db.query.stories.findFirst({
    where: eq(stories.id, storyId),
  });

  if (story) {
    const currentSteps = (story.completedSteps as string[]) || [];

    if (!currentSteps.includes("locations")) {
      await db
        .update(stories)
        .set({
          completedSteps: [...currentSteps, "locations"],
          updatedAt: new Date(),
        })
        .where(eq(stories.id, storyId));
    }
  }

  return NextResponse.json({ ok: true });
}