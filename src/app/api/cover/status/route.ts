import { NextResponse } from "next/server";
import { db } from "@/db";
import { bookCovers } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic"; // Ensure this doesn't get cached

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get("jobId");

    if (!jobId) {
      return NextResponse.json({ error: "Missing jobId" }, { status: 400 });
    }

    // ✅ FIX: Use db.select() instead of db.query.bookCovers
    // This prevents crashes if the relational schema isn't perfectly configured
    const results = await db
      .select()
      .from(bookCovers)
      .where(eq(bookCovers.generationId, jobId))
      .limit(1);

    const cover = results[0];

    if (!cover) {
      return NextResponse.json({
        status: "processing",
        coverUrl: null,
      });
    }

    return NextResponse.json({
      status: "complete",
      coverUrl: cover.imageUrl,
    });
  } catch (err) {
    console.error("Cover status error:", err);
    return NextResponse.json(
      { error: "Status check failed" },
      { status: 500 }
    );
  }
}