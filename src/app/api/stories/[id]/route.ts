import { NextResponse } from "next/server";
import { db } from "@/db";
import { stories, storyPages } from "@/db/schema";
import { eq, asc } from "drizzle-orm";

export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  // 🔥 FIX — unwrap the async params object
  const { id: storyId } = await context.params;
  if (!storyId) {
    return NextResponse.json(
      { error: "Missing storyId" },
      { status: 400 }
    );
  }

  // Load story
  const story = await db
    .select()
    .from(stories)
    .where(eq(stories.id, storyId))
    .then(rows => rows[0]);

  if (!story) {
    return NextResponse.json(
      { error: "Story not found" },
      { status: 404 }
    );
  }


  // Load pages
  const pages = await db
    .select()
    .from(storyPages)
    .where(eq(storyPages.storyId, storyId))
    .orderBy(asc(storyPages.pageNumber));

  return NextResponse.json({
    story,
    pages
  });
}
