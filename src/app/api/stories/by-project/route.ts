import { NextResponse } from "next/server";
import { db } from "@/db";
import { stories } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");



    console.log("search params, ",projectId  )

    if (!projectId) {
      return NextResponse.json({ error: "Missing projectId" }, { status: 400 });
    }

    const story = await db
      .select()
      .from(stories)
      .where(eq(stories.projectId, projectId))
      .limit(1)
      .then((rows) => rows[0]);

    if (!story) {
      return NextResponse.json({ storyId: null });
    }

    return NextResponse.json({
      storyId: story.id,
      title: story.title,
      length: story.length,
      status: story.status,
    });
  } catch (err) {
    console.error("Error loading story by project:", err);
    return NextResponse.json(
      { error: "Failed to load story" },
      { status: 500 }
    );
  }
}
