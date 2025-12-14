import { NextResponse } from "next/server";
import { db } from "@/db";
import { storyPages } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(req: Request) {
  const { pageId, text } = await req.json();

  await db
    .update(storyPages)
    .set({ text })
    .where(eq(storyPages.id, pageId));

  return NextResponse.json({ ok: true });
}
