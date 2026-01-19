import { NextResponse } from "next/server";
import { db } from "@/db";
import { bookCovers } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic"; // prevent caching

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get("jobId");

    if (!jobId) {
      console.warn("⚠️ cover/status called without jobId");
      return NextResponse.json(
        { error: "Missing jobId" },
        { status: 400 }
      );
    }

    console.log("🔎 COVER STATUS CHECK jobId:", jobId);

    const results = await db
      .select()
      .from(bookCovers)
      .where(eq(bookCovers.generationId, jobId))
      .limit(1);

    const cover = results[0];

    console.log(
      "📦 COVER STATUS RESULT:",
      cover ? { id: cover.id, imageUrl: cover.imageUrl } : "none"
    );

    if (!cover) {
      return NextResponse.json({
        status: "processing",
        coverUrl: null,
      });
    }

    return NextResponse.json({
      status: "complete",
      coverUrl: cover.imageUrl,
      coverId: cover.id,
    });
  } catch (err) {
    console.error("❌ Cover status error:", err);
    return NextResponse.json(
      { error: "Status check failed" },
      { status: 500 }
    );
  }
}
