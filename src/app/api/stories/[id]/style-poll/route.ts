import { NextResponse } from "next/server";
import { db } from "@/db";
import { storyStyleGuide } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: storyId } = await params;

    const style = await db.query.storyStyleGuide.findFirst({
      where: eq(storyStyleGuide.storyId, storyId),
      columns: {
        sampleIllustrationUrl: true,
        generationId: true,
      },
    });

    if (!style) {
      return NextResponse.json(
        { error: "Style guide not found" },
        { status: 404 }
      );
    }

    // Return the sample URL and generationId
    // Frontend will check if generationId matches what it expects
    return NextResponse.json({
      sampleUrl: style.sampleIllustrationUrl,
      generationId: style.generationId,
    });
  } catch (error: any) {
    console.error("[STYLE POLL] Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal error" },
      { status: 500 }
    );
  }
}