import { inngest } from "@/inngest/client";
import { db } from "@/db";
import { stories } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // 1. Trigger the "Spreads" manager
  await inngest.send({
    name: "story/generate.spreads", // Updated event name
    data: { storyId: id },
  });

  // 2. Update status
  await db.update(stories)
    .set({ status: 'generating', updatedAt: new Date() })
    .where(eq(stories.id, id));

  return NextResponse.json({ success: true });
}