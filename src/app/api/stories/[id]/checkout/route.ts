import { NextResponse } from "next/server";
import { db } from "@/db";
import { stories } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * Records a payment reference on a story.
 *
 * IMPORTANT:
 * - This route does NOT verify payment.
 * - This route does NOT update story.status.
 * - Authoritative payment handling lives in /api/paypal/capture.
 * - Lifecycle transitions live in /api/stories/[id]/status.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: storyId } = await params;
    const { orderId } = await req.json();

    if (!storyId || !orderId) {
      return NextResponse.json(
        { error: "storyId and orderId are required" },
        { status: 400 }
      );
    }

    await db
      .update(stories)
      .set({
        paymentId: orderId,
        updatedAt: new Date(),
      })
      .where(eq(stories.id, storyId));

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[record-payment] error:", error);
    return NextResponse.json(
      { error: "Failed to record payment reference" },
      { status: 500 }
    );
  }
}
