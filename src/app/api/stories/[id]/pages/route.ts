import { NextResponse } from "next/server";
import { db } from "@/db";
import { storyPages } from "@/db/schema";
import { eq } from "drizzle-orm";

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
