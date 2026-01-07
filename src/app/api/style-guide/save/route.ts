// src/app/api/style-guide/save/route.ts
import { NextResponse } from "next/server";
import { db } from "@/db";
import { storyStyleGuide } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      storyId,
      summary,
      styleGuideImage,
      negativePrompt,
    } = body;

    if (!storyId) {
      return NextResponse.json({ error: "Missing storyId" }, { status: 400 });
    }

    const existing = await db.query.storyStyleGuide.findFirst({
      where: eq(storyStyleGuide.storyId, storyId),
    });

    let result;

    if (existing) {
      [result] = await db
        .update(storyStyleGuide)
        .set({
          summary: summary ?? existing.summary,
          styleGuideImage: styleGuideImage ?? existing.styleGuideImage,
          negativePrompt: negativePrompt ?? existing.negativePrompt,
          updatedAt: new Date(),
        })
        .where(eq(storyStyleGuide.id, existing.id))
        .returning();
    } else {
      [result] = await db
        .insert(storyStyleGuide)
        .values({
          storyId,
          summary,
          styleGuideImage,
          negativePrompt,
        })
        .returning();
    }

    return NextResponse.json({ success: true, guide: result });
  } catch (err: any) {
    console.error("Error saving style guide:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
