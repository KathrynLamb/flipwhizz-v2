import { NextResponse } from "next/server";
import { db } from "@/db";
import { locations, storyLocations } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: storyId } = await params;

  // lock all locations linked to this story
  await db
    .update(locations)
    .set({ locked: true })
    .where(
      eq(
        locations.id,
        db
          .select({ id: storyLocations.locationId })
          .from(storyLocations)
          .where(eq(storyLocations.storyId, storyId))
      )
    );

  return NextResponse.json({ ok: true });
}
