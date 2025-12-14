// src/app/api/style-guide/save/route.ts
import { NextResponse } from "next/server";
import { db } from "@/db";
import { storyStyleGuide } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { storyId, summary } = body;
    console.log("stor id", storyId)

    if (!storyId) {
      return NextResponse.json({ error: "Missing storyId" }, { status: 400 });
    }

    // 1. Try to find existing guide
    const existing = await db.query.storyStyleGuide.findFirst({
      where: eq(storyStyleGuide.storyId, storyId),
    });

    console.log("existing", existing)

    let result;

    if (existing) {
      // 2. Update existing
      [result] = await db
        .update(storyStyleGuide)
        .set({ 
            summary, 
            updatedAt: new Date() 
        })
        .where(eq(storyStyleGuide.id, existing.id))
        .returning();
    } else {
      // 3. Create new
      [result] = await db
        .insert(storyStyleGuide)
        .values({
          storyId,
          summary,
        })
        .returning();
    }

    return NextResponse.json({ success: true, guide: result });
  } catch (err: any) {
    console.error("Error saving style guide:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}