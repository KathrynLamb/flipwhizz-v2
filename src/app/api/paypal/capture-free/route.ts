// src/app/api/stories/[id]/claim-free/route.ts

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { stories, orders, promoCodes } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { auth } from "@/auth";
import { inngest } from "@/inngest/client";

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

    if (!promoCode || typeof promoCode !== "string") {
      return NextResponse.json({ error: "Missing promoCode" }, { status: 400 });
    }

    // Check story isn't already paid
    const [storyRow] = await db
      .select({ paymentStatus: stories.paymentStatus })
      .from(stories)
      .where(eq(stories.id, storyId))
      .limit(1);

    if (storyRow?.paymentStatus === "paid") {
      return NextResponse.json({ success: true, alreadyPaid: true });
    }

    // Mark story as paid, write promo code into paymentId for order page detection
    await db
      .update(stories)
      .set({
        paymentStatus: "paid",
        paymentId: `promo:${promoCode.trim().toUpperCase()}`,
        status: "generating",
        updatedAt: new Date(),
      })
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
      submittedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Increment promo usage
    await db
      .update(promoCodes)
      .set({
        currentUses: sql`${promoCodes.currentUses} + 1`,
        updatedAt: new Date(),
      })
      .where(sql`LOWER(${promoCodes.code}) = LOWER(${promoCode.trim()})`);

    // Fire generation
    await inngest.send({
      name: "story/generate.spreads",
      data: { storyId },
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[claim-free] Error:", err);
    return NextResponse.json(
      { error: err.message || "Failed" },
      { status: 500 }
    );
  }
}