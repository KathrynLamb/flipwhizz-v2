import { inngest } from "@/inngest/client";
import { db } from "@/db";
import { storyPages, storyStyleGuide } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; pageId: string }> }
) {
  const { id, pageId } = await params;

  // 1. Fetch Page & Style Data
  const page = await db.query.storyPages.findFirst({
    where: eq(storyPages.id, pageId)
  });
  
  const style = await db.query.storyStyleGuide.findFirst({
    where: eq(storyStyleGuide.storyId, id)
  });

  if (!page || !style) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // 2. Clear current image so UI shows loader
  await db.update(storyPages)
    .set({ imageUrl: null })
    .where(eq(storyPages.id, pageId));

  // 3. Trigger Single Page Generation
  await inngest.send({
    name: "story/generate.page",
    data: {
      storyId: id,
      pageId: page.id,
      pageNumber: page.pageNumber,
      text: page.text,
      style: style // Pass full style object
    },
  });

  return NextResponse.json({ success: true });
}