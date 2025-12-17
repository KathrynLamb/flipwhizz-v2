import { db } from "@/db";
import { storyPages } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const pages = await db.query.storyPages.findMany({
    where: eq(storyPages.storyId, id),
    orderBy: asc(storyPages.pageNumber),
  });
  return NextResponse.json(pages);
}