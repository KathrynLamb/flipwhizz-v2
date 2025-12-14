import { NextResponse } from "next/server";
import { db } from "@/db";
import { stories } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { orderId } = body;

    // In a real production app, you would verify 'orderId' with PayPal API here 
    // to ensure the amount was actually paid.

    await db
      .update(stories)
      .set({
        paymentStatus: "paid",
        paymentId: orderId,
        updatedAt: new Date(),
      })
      .where(eq(stories.id, id));

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Payment Record Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}