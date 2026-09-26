// src/app/api/stories/[id]/claim-free/route.ts
//
// When a promo code makes a product free (e.g. Friends & Family digital),
// there's no PayPal order to capture. This endpoint handles that case:
// marks the story as paid and kicks off generation.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { stories, storyProducts, promoCodes } from "@/db/schema";
import { and, eq, isNull, lt, ne, or, sql } from "drizzle-orm";
import { inngest } from "@/inngest/client";
import {
  resolvePromoDiscount,
  getPriceCents,
  applyDiscount,
  getPromoUnusableReason,
  type ProductType,
  type CurrencyCode,
} from "@/lib/pricing";
import { captureServerEvent } from "@/lib/posthog-server";

import { requireStoryOwner } from "@/lib/apiAuth";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_PRODUCTS: ProductType[] = ["digital", "print", "gift"];

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: storyId } = await params;
    const ownerCheck = await requireStoryOwner(storyId);
    if (!ownerCheck.ok) return ownerCheck.response;
    const body = await req.json();
    const { promoCode } = body ?? {};

    if (!promoCode || typeof promoCode !== "string") {
      return NextResponse.json({ error: "Promo code required" }, { status: 400 });
    }

    /* ---------- LOAD STORY PRODUCT ---------- */
    const storyProduct = await db.query.storyProducts.findFirst({
      where: eq(storyProducts.storyId, storyId),
    });

    if (!storyProduct) {
      return NextResponse.json({ error: "No product selected" }, { status: 400 });
    }

    const productType = storyProduct.productType as ProductType;
    if (!VALID_PRODUCTS.includes(productType)) {
      return NextResponse.json({ error: "Invalid product type" }, { status: 400 });
    }

    const currency = (storyProduct.currency ?? "GBP") as CurrencyCode;

    /* ---------- VALIDATE PROMO ---------- */
    const [promo] = await db
      .select()
      .from(promoCodes)
      .where(sql`LOWER(${promoCodes.code}) = LOWER(${promoCode.trim()})`)
      .limit(1);

    if (!promo) {
      return NextResponse.json({ error: "Invalid promo code" }, { status: 400 });
    }

    const unusable = getPromoUnusableReason(promo);
    if (unusable) {
      return NextResponse.json({ error: unusable }, { status: 400 });
    }

    const discount = resolvePromoDiscount(promo, productType as ProductType, currency);

    const originalCents = getPriceCents(productType, currency);
    const finalCents = applyDiscount(originalCents, discount.discountPercent, discount.isFree);

    if (finalCents !== 0) {
      return NextResponse.json(
        { error: "This promo code does not make this product free. Use normal checkout." },
        { status: 400 }
      );
    }

    /* ---------- CHECK ALREADY PAID ---------- */
    const [storyRow] = await db
      .select({ paymentStatus: stories.paymentStatus })
      .from(stories)
      .where(eq(stories.id, storyId))
      .limit(1);

    if (storyRow?.paymentStatus === "paid") {
      return NextResponse.json({ error: "Story already paid" }, { status: 400 });
    }

    /* ---------- RESERVE A PROMO USE ---------- */
    // Atomic: only succeeds while uses remain, so concurrent claims
    // can't push a code past its maxUses.
    const reserved = await db
      .update(promoCodes)
      .set({
        currentUses: sql`${promoCodes.currentUses} + 1`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(promoCodes.id, promo.id),
          or(isNull(promoCodes.maxUses), lt(promoCodes.currentUses, promoCodes.maxUses))
        )
      )
      .returning({ id: promoCodes.id });

    if (reserved.length === 0) {
      return NextResponse.json({ error: "Promo code has been fully redeemed." }, { status: 400 });
    }

    /* ---------- MARK PAID + GENERATE ---------- */
    // Conditional on not already paid, so a double-submit can't fire generation twice.
    const marked = await db
      .update(stories)
      .set({
        paymentStatus: "paid",
        paymentId: `promo:${promo.code}`,
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
      // Lost a race with another claim — give the use back.
      await db
        .update(promoCodes)
        .set({ currentUses: sql`${promoCodes.currentUses} - 1`, updatedAt: new Date() })
        .where(eq(promoCodes.id, promo.id));
      return NextResponse.json({ error: "Story already paid" }, { status: 400 });
    }

    // Fire generation — must match the event name in generateBookSpreads.ts
    await inngest.send({
      name: "story/generate-spreads",  // ← hyphens, not dots
      data: { storyId },
    });

    await captureServerEvent(storyId, "free_story_claimed", {
      story_id: storyId,
      product_type: productType,
      promo_code: promo.code,
      currency,
    });

    return NextResponse.json({
      success: true,
      storyId,
      productType,
      free: true,
      promoCode: promo.code,
    });
  } catch (err: any) {
    console.error("[Claim free] error:", err);
    return NextResponse.json(
      { error: err?.message ?? "Failed to claim free product" },
      { status: 500 }
    );
  }
}