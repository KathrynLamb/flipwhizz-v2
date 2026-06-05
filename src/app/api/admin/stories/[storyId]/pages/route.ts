// src/app/api/admin/stories/[storyId]/pages/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/db";
import { storyPages, stories } from "@/db/schema";
import { eq, asc } from "drizzle-orm";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL;

function isAdmin(email: string | null | undefined) {
  return ADMIN_EMAIL && email === ADMIN_EMAIL;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ storyId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session?.user?.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { storyId } = await params;

  const [story] = await db
    .select({ title: stories.title, status: stories.status })
    .from(stories)
    .where(eq(stories.id, storyId))
    .limit(1);

  if (!story) {
    return NextResponse.json({ error: "Story not found" }, { status: 404 });
  }

  const pages = await db
    .select({
      id: storyPages.id,
      pageNumber: storyPages.pageNumber,
      text: storyPages.text,
      imageUrl: storyPages.imageUrl,
    })
    .from(storyPages)
    .where(eq(storyPages.storyId, storyId))
    .orderBy(asc(storyPages.pageNumber));

  return NextResponse.json({ story, pages });
}

// PATCH — nudge story status
export async function PATCH(
  req: Request,
  { params }: { params: { storyId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session?.user?.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { storyId } = params;
  const { status } = await req.json();

  const allowed = ["paged", "generating", "ready", "complete"];
  if (!allowed.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  await db
    .update(stories)
    .set({ status, updatedAt: new Date() })
    .where(eq(stories.id, storyId));

  return NextResponse.json({ ok: true, status });
}