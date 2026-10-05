// /api/stories/[id]/intent/route.ts
import { NextResponse } from "next/server";
import { db } from "@/db";
import { storyIntent } from "@/db/schema";
import { eq } from "drizzle-orm";
import { withAccess } from "@/lib/authz";

async function _GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  const intent = await db.query.storyIntent.findFirst({
    where: eq(storyIntent.storyId, id),
  });

  return NextResponse.json({ intent });
}

export const GET = withAccess({ story: { param: "id" } }, _GET);
