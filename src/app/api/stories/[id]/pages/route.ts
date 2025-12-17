import { NextResponse } from "next/server";
import { db } from "@/db";
import { storyPages } from "@/db/schema";
import { eq, asc } from "drizzle-orm";

// This is your existing PATCH handler for updating pages
export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id: storyId } = await context.params;

  if (!storyId) {
    return NextResponse.json({ error: "Missing story ID" }, { status: 400 });
  }

  const { pages } = await req.json();

  if (!Array.isArray(pages)) {
    return NextResponse.json({ error: "Invalid pages payload" }, { status: 400 });
  }

  try {
    for (const p of pages) {
      await db
        .update(storyPages)
        .set({ text: p.text })
        .where(eq(storyPages.id, p.id));
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Update failed", err);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}

// Add a GET handler for fetching pages
export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id: storyId } = await context.params;

  if (!storyId) {
    return NextResponse.json({ error: "Missing story ID" }, { status: 400 });
  }

  try {
    // Fetch all pages for the given story, ordered by page number
    const pages = await db.query.storyPages.findMany({
      where: eq(storyPages.storyId, storyId),
      orderBy: asc(storyPages.pageNumber),
    });

    // Return the pages as JSON
    return NextResponse.json(pages);
  } catch (err) {
    console.error("Failed to fetch pages", err);
    return NextResponse.json({ error: "Failed to fetch pages" }, { status: 500 });
  }
}
