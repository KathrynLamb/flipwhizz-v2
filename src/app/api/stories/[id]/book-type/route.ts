import { NextResponse } from "next/server";
import { db } from "@/db";
import { stories } from "@/db/schema";
import { eq } from "drizzle-orm";
import { withAccess } from "@/lib/authz";

async function confirm(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  if (body.confirm !== true) return NextResponse.json({ error: "Format confirmation required" }, { status: 400 });
  const [story] = await db.update(stories).set({ bookTypeConfirmedAt: new Date(), updatedAt: new Date() }).where(eq(stories.id, id)).returning({ bookType: stories.bookType });
  if (!story) return NextResponse.json({ error: "Story not found" }, { status: 404 });
  return NextResponse.json({ ...story, confirmed: true });
}
export const POST = withAccess({ story: { param: "id" } }, confirm);
