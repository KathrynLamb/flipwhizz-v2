// src/app/api/paypal/capture-free/route.ts

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { stories, orders, promoCodes, storyProducts } from "@/db/schema";
import { and, eq, isNull, lt, ne, or, sql } from "drizzle-orm";
import { requireStoryOwner } from "@/lib/apiAuth";
import {
  computeCheckoutCents,
  getPromoUnusableReason,
  type CurrencyCode,
  type ProductType,
} from "@/lib/pricing";
import { inngest } from "@/inngest/client";

export async function POST(req: NextRequest) {
  try {
    const { storyId, promoCode } = await req.json();

    if (!storyId) {
      return NextResponse.json({ error: "Missing storyId" }, { status: 400 });
    }

    const ownerCheck = await requireStoryOwner(storyId);
    if (!ownerCheck.ok) return ownerCheck.response;

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

    // The promo must be real, currently usable, and make this product free
    const [promo] = await db
      .select()
      .from(promoCodes)
      .where(sql`LOWER(${promoCodes.code}) = LOWER(${promoCode.trim()})`)
      .limit(1);

    const unusable = promo ? getPromoUnusableReason(promo) : "Invalid promo code.";
    if (unusable) {
      return NextResponse.json({ error: unusable }, { status: 400 });
    }

    const storyProduct = await db.query.storyProducts.findFirst({
      where: eq(storyProducts.storyId, storyId),
    });
    const productType = storyProduct?.productType as ProductType | undefined;

    if (!productType || !["digital", "print", "gift"].includes(productType)) {
      return NextResponse.json({ error: "No product selected" }, { status: 400 });
    }

    const currency = (storyProduct?.currency ?? "GBP") as CurrencyCode;
    if (computeCheckoutCents(productType, currency, { promo }) !== 0) {
      return NextResponse.json(
        { error: "This promo code does not make this product free." },
        { status: 400 }
      );
    }

    // Reserve a promo use atomically so concurrent claims can't exceed maxUses
    const reserved = await db
      .update(promoCodes)
      .set({
        currentUses: sql`${promoCodes.currentUses} + 1`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(promoCodes.id, promo!.id),
          or(isNull(promoCodes.maxUses), lt(promoCodes.currentUses, promoCodes.maxUses))
        )
      )
      .returning({ id: promoCodes.id });

    if (reserved.length === 0) {
      return NextResponse.json({ error: "Promo code has been fully redeemed." }, { status: 400 });
    }

    // Mark story as paid, write promo code into paymentId for order page detection
    const marked = await db
      .update(stories)
      .set({
        paymentStatus: "paid",
        paymentId: `promo:${promo!.code.toUpperCase()}`,
        status: "generating",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(stories.id, storyId),
          or(isNull(stories.paymentStatus), ne(stories.paymentStatus, "paid"))
        )
      )
      .returning({ id: stories.id });

    if (marked.length === 0) {
      // Paid concurrently — give the promo use back
      await db
        .update(promoCodes)
        .set({ currentUses: sql`${promoCodes.currentUses} - 1`, updatedAt: new Date() })
        .where(eq(promoCodes.id, promo!.id));
      return NextResponse.json({ success: true, alreadyPaid: true });
    }

    // Insert free order record
    await db.insert(orders).values({
      id: `free-${storyId}-${Date.now()}`,
      storyId,
      userId: ownerCheck.userId,
      paymentStatus: "paid",
      amount: "0",
      currency: "GBP",
      status: "confirmed",
      submittedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

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