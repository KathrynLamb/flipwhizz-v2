// src/app/api/stories/[id]/confirm/route.ts
import { NextResponse } from "next/server";
import { db } from "@/db";
import { stories } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id: storyId } = await context.params;

  await db
    .update(stories)
    .set({ storyConfirmed: true, updatedAt: new Date() })
    .where(eq(stories.id, storyId));

  return NextResponse.json({ ok: true });
}