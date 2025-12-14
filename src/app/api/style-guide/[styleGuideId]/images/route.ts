import { NextResponse } from "next/server";
import { db } from "@/db";
import { storyStyleGuide, styleGuideImages } from "@/db/schema";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ styleGuideId: string }> }
) {
  try {
    // ✅ MUST unwrap params
    const { styleGuideId } = await ctx.params;
    console.log("style guide id", styleGuideId)

    if (!styleGuideId) {
      return NextResponse.json(
        { error: "Missing styleGuideId" },
        { status: 400 }
      );
    }

    const { url, notes, label, type } = await req.json();

    if (!url) {
      return NextResponse.json(
        { error: "Missing image url" },
        { status: 400 }
      );
    }

    // ✅ STRICT: styleGuideId === story_style_guide.id
    const guide = await db.query.storyStyleGuide.findFirst({
      where: eq(storyStyleGuide.storyId, styleGuideId),
    });

    if (!guide) {
      return NextResponse.json(
        { error: "Style guide not found" },
        { status: 404 }
      );
    }

    const [image] = await db
      .insert(styleGuideImages)
      .values({
        styleGuideId: guide.id,
        url,
        notes,
        label,
        type: type ?? "style",
      })
      .returning();

    return NextResponse.json({ image });

  } catch (err: any) {
    console.error("[style-guide images POST]", err);
    return NextResponse.json(
      { error: err.message ?? "Failed to save style guide image" },
      { status: 500 }
    );
  }
}
