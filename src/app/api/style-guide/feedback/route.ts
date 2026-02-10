// src/app/api/style-guide/feedback/route.ts
import { NextResponse } from "next/server";
import { db } from "@/db";
import { storyStyleGuide } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(req: Request) {
  try {
    const { storyId, approved, feedback, referenceImageUrl } = await req.json();

    if (!storyId) {
      return NextResponse.json({ error: "Missing storyId" }, { status: 400 });
    }

    // Get or create style guide
    let [guide] = await db
      .select()
      .from(storyStyleGuide)
      .where(eq(storyStyleGuide.storyId, storyId));

    if (!guide) {
      [guide] = await db
        .insert(storyStyleGuide)
        .values({
          storyId,
          summary: "",
        })
        .returning();
    }

    // Update with approval status and feedback
    await db
      .update(storyStyleGuide)
      .set({
        approved: approved || false,
        feedback: feedback || null,
        updatedAt: new Date(),
      })
      .where(eq(storyStyleGuide.storyId, storyId));

    // Log the action
    if (approved) {
      console.log(`✅ Style approved for story ${storyId}`);
    } else {
      console.log(`📝 Feedback received for story ${storyId}:`, feedback);
    }

    return NextResponse.json({
      success: true,
      message: approved ? "Style approved" : "Feedback recorded",
    });

  } catch (err: any) {
    console.error("[style-guide/feedback]", err);
    return NextResponse.json(
      { error: err.message || "Failed to save feedback" },
      { status: 500 }
    );
  }
}