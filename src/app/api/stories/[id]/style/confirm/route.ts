// src/app/api/stories/[id]/style/confirm/route.ts
import { NextResponse } from "next/server";
import { db } from "@/db";
import { stories } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id: storyId } = await context.params;

  await db
    .update(stories)
    .set({
      status: "style_ready",
      updatedAt: new Date(),
      currentStep: 4, // optional: align with your workflow
    })
    .where(eq(stories.id, storyId));

  return NextResponse.json({ ok: true });
}
