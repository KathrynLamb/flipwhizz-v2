// src/app/api/stories/[id]/claim-free/route.ts
//
// When a promo code makes a product free (e.g. Friends & Family digital),
// there's no PayPal order to capture. This endpoint handles that case:
// marks the story as paid and kicks off generation.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { stories, storyProducts, promoCodes } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { inngest } from "@/inngest/client";
import {
  resolvePromoDiscount,
  getPriceCents,
  applyDiscount,
  type ProductType,
  type CurrencyCode,
} from "@/lib/pricing";
import { captureServerEvent } from "@/lib/posthog-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_PRODUCTS: ProductType[] = ["digital", "print", "gift"];

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: storyId } = await params;
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

    if (!promo || !promo.active) {
      return NextResponse.json({ error: "Invalid promo code" }, { status: 400 });
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

    /* ---------- MARK PAID + GENERATE ---------- */
    await db
      .update(stories)
      .set({
        paymentStatus: "paid",
        paymentId: `promo:${promo.code}`,
        status: "generating",
        updatedAt: new Date(),
      })
      .where(eq(stories.id, storyId));

    // Increment promo usage
    await db
      .update(promoCodes)
      .set({
        currentUses: sql`${promoCodes.currentUses} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(promoCodes.id, promo.id));

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