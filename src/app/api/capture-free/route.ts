import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { stories, orders } from "@/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { storyId, productType, promoCode } = await req.json();

    if (!storyId) {
      return NextResponse.json({ error: "Missing storyId" }, { status: 400 });
    }

    // Mark story as paid
    await db
      .update(stories)
      .set({ paymentStatus: "paid", updatedAt: new Date() })
      .where(eq(stories.id, storyId));

    // Insert free order record
    await db.insert(orders).values({
      id: `free-${storyId}-${Date.now()}`,
      storyId,
      userId: session.user.id,
      paymentStatus: "paid",
      amount: "0",
      currency: "GBP",
      status: "confirmed",
      gelatoStatus: "confirmed",
      submittedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[capture-free] Error:", err);
    return NextResponse.json(
      { error: err.message || "Failed" },
      { status: 500 }
    );
  }
}