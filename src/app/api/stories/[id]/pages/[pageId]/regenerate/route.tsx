import { NextResponse } from "next/server";
import { inngest } from "@/inngest/client";
import { db } from "@/db";
import { storyPages, storySpreads } from "@/db/schema";
import { eq, or } from "drizzle-orm";

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string; pageId: string }> }
) {
  try {
    // ✅ REQUIRED in App Router
    const { id: storyId, pageId } = await context.params;

    // --- HARD GUARD ---
    if (!storyId || !pageId) {
      console.error("❌ Missing route params", { storyId, pageId });
      return NextResponse.json(
        { error: "Missing storyId or pageId" },
        { status: 400 }
      );
    }

    const { feedback } = await req.json();

    // 1. Find the spread for this page
    const spread = await db.query.storySpreads.findFirst({
      where: or(
        eq(storySpreads.leftPageId, pageId),
        eq(storySpreads.rightPageId, pageId)
      ),
    });

    if (!spread) {
      return NextResponse.json(
        { error: "Spread not found" },
        { status: 404 }
      );
    }

    // 2. Get page numbers for label
    const leftPage = spread.leftPageId
      ? await db.query.storyPages.findFirst({
          where: eq(storyPages.id, spread.leftPageId),
        })
      : null;

    const rightPage = spread.rightPageId
      ? await db.query.storyPages.findFirst({
          where: eq(storyPages.id, spread.rightPageId),
        })
      : null;

    const pageLabel = `${leftPage?.pageNumber ?? "?"}-${rightPage?.pageNumber ?? "?"}`;

    // 3. Clear image URLs (forces loading UI)
    if (spread.leftPageId) {
      await db
        .update(storyPages)
        .set({ imageUrl: null })
        .where(eq(storyPages.id, spread.leftPageId));
    }

    if (spread.rightPageId) {
      await db
        .update(storyPages)
        .set({ imageUrl: null })
        .where(eq(storyPages.id, spread.rightPageId));
    }

    // 4. Trigger Inngest regeneration WITH feedback
    await inngest.send({
      name: "story/generate.single.spread",
      data: {
        storyId,
        leftPageId: spread.leftPageId,
        rightPageId: spread.rightPageId,
        pageLabel,
        feedback,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("❌ Regenerate Error:", error);
    return NextResponse.json(
      { error: "Failed to regenerate spread" },
      { status: 500 }
    );
  }
}
