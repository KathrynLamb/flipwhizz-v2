// src/app/api/stories/[id]/style-guide/route.ts
import { NextResponse } from "next/server";
import { db } from "@/db";
import { storyStyleGuide } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: storyId } = await context.params;
    const body = await req.json();

    console.log("📝 Updating style guide for story:", storyId);
    console.log("📦 Update data:", body);

    // Get or create style guide
    let [guide] = await db
      .select()
      .from(storyStyleGuide)
      .where(eq(storyStyleGuide.storyId, storyId));

    if (!guide) {
      console.log("➕ Creating new style guide");
      [guide] = await db
        .insert(storyStyleGuide)
        .values({
          storyId,
          summary: "",
        })
        .returning();
    }

    // Update with new data
    await db
      .update(storyStyleGuide)
      .set({
        ...body,
        updatedAt: new Date(),
      })
      .where(eq(storyStyleGuide.storyId, storyId));

    console.log("✅ Style guide updated successfully");

    return NextResponse.json({ success: true });

  } catch (err: any) {
    console.error("❌ [style-guide PATCH]", err);
    return NextResponse.json(
      { error: err.message || "Failed to update style guide" },
      { status: 500 }
    );
  }
}