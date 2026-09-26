// /api/stories/[id]/intent/route.ts
import { NextResponse } from "next/server";
import { db } from "@/db";
import { storyIntent } from "@/db/schema";
import { eq } from "drizzle-orm";

import { requireStoryOwner } from "@/lib/apiAuth";
export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const ownerCheck = await requireStoryOwner(id);
  if (!ownerCheck.ok) return ownerCheck.response;

  const intent = await db.query.storyIntent.findFirst({
    where: eq(storyIntent.storyId, id),
  });

  return NextResponse.json({ intent });
}
