import { NextResponse } from "next/server";
import { db } from "@/db";
import { projects, stories } from "@/db/schema";
import { eq } from "drizzle-orm";
import { isBookType } from "@/lib/books/bookType";
import { withAccess } from "@/lib/authz";
async function update(req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const { bookType } = await req.json();
  if (!isBookType(bookType)) return NextResponse.json({ error: "Invalid book type" }, { status: 400 });
  const existing = await db.query.stories.findFirst({ where: eq(stories.projectId, projectId) });
  if (existing) return NextResponse.json({ error: "This story has already been created. Start a new book to change its format." }, { status: 409 });
  await db.update(projects).set({ bookType, updatedAt: new Date() }).where(eq(projects.id, projectId));
  return NextResponse.json({ bookType });
}
export const PUT = withAccess({ project: { param: "projectId" } }, update);
