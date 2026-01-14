import { NextResponse } from "next/server";
import { db } from "@/db";
import { orders, stories } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // ✅ MUST await params
    const { id: storyId } = await params;

    if (!storyId) {
      return NextResponse.json(
        { error: "storyId missing" },
        { status: 400 }
      );
    }

    // 1️⃣ Check for a completed order
    const paidOrder = await db.query.orders.findFirst({
      where: and(
        eq(orders.storyId, storyId),
        eq(orders.paymentStatus, "completed") // or "paid" if you change later
      ),
    });

    if (paidOrder) {
      return NextResponse.json({
        purchased: true,
        source: "order",
        orderId: paidOrder.id,
      });
    }

    // 2️⃣ Fallback: check cached story flag
    const story = await db.query.stories.findFirst({
      where: eq(stories.id, storyId),
      columns: {
        paymentStatus: true,
      },
    });

    if (story?.paymentStatus === "paid") {
      return NextResponse.json({
        purchased: true,
        source: "story_cache",
      });
    }

    // 3️⃣ Not purchased
    return NextResponse.json({ purchased: false });

  } catch (err) {
    console.error("[purchase-status] error:", err);
    return NextResponse.json(
      { error: "Failed to check purchase status" },
      { status: 500 }
    );
  }
}
