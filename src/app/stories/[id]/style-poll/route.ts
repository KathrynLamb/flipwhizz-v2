import { db } from "@/db";
import { storyStyleGuide } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const guide = await db.query.storyStyleGuide.findFirst({
    where: eq(storyStyleGuide.storyId, id),
  });
  return NextResponse.json({ sampleUrl: guide?.sampleIllustrationUrl || null });
}