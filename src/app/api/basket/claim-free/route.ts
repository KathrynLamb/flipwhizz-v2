// src/app/api/basket/claim-free/route.ts
//
// Unlocks multiple stories at once with a single free promo code.
// Called from the basket page when all stories resolve to free.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { stories, storyProducts, promoCodes } from "@/db/schema";
import { eq, sql, inArray } from "drizzle-orm";
import { inngest } from "@/inngest/client";
import {
  resolvePromoDiscount,
  getPriceCents,
  applyDiscount,
  type ProductType,
  type CurrencyCode,
} from "@/lib/pricing";
import { captureServerEvent } from "@/lib/posthog-server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_PRODUCTS: ProductType[] = ["digital", "print", "gift"];

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { storyIds, promoCode } = body ?? {};

    if (!promoCode || typeof promoCode !== "string") {
      return NextResponse.json({ error: "Promo code required" }, { status: 400 });
    }

    if (!Array.isArray(storyIds) || storyIds.length === 0) {
      return NextResponse.json({ error: "No stories provided" }, { status: 400 });
    }

    /* ---------- VALIDATE PROMO ONCE ---------- */
    const [promo] = await db
      .select()
      .from(promoCodes)
      .where(sql`LOWER(${promoCodes.code}) = LOWER(${promoCode.trim()})`)
      .limit(1);

    if (!promo || !promo.active) {
      return NextResponse.json({ error: "Invalid or inactive promo code" }, { status: 400 });
    }

    // Check max uses
    if (promo.maxUses !== null && promo.currentUses >= promo.maxUses) {
      return NextResponse.json({ error: "Promo code has reached its usage limit" }, { status: 400 });
    }

    /* ---------- PROCESS EACH STORY ---------- */
    const results: { storyId: string; success: boolean; error?: string }[] = [];

    for (const storyId of storyIds) {
      try {
        // Check max uses per iteration (in case limit is hit mid-loop)
        if (promo.maxUses !== null && (promo.currentUses + results.filter(r => r.success).length) >= promo.maxUses) {
          results.push({ storyId, success: false, error: "Promo code usage limit reached" });
          continue;
        }

        const storyProduct = await db.query.storyProducts.findFirst({
          where: eq(storyProducts.storyId, storyId),
        });

        if (!storyProduct) {
          results.push({ storyId, success: false, error: "No product selected" });
          continue;
        }

        const productType = (storyProduct.productType ?? "digital") as ProductType;
        if (!VALID_PRODUCTS.includes(productType)) {
          results.push({ storyId, success: false, error: "Invalid product type" });
          continue;
        }

        const currency = (storyProduct.currency ?? "GBP") as CurrencyCode;
        const discount = resolvePromoDiscount(promo, productType);
        const originalCents = getPriceCents(productType, currency);
        const finalCents = applyDiscount(originalCents, discount.discountPercent, discount.isFree);

        if (finalCents !== 0) {
          results.push({ storyId, success: false, error: "Code does not make this product free" });
          continue;
        }

        // Check already paid
        const [storyRow] = await db
          .select({ paymentStatus: stories.paymentStatus })
          .from(stories)
          .where(eq(stories.id, storyId))
          .limit(1);

        if (storyRow?.paymentStatus === "paid") {
          results.push({ storyId, success: false, error: "Already paid" });
          continue;
        }

        // Mark paid
        await db
          .update(stories)
          .set({
            paymentStatus: "paid",
            paymentId: `promo:${promo.code}`,
            status: "generating",
            updatedAt: new Date(),
          })
          .where(eq(stories.id, storyId));

        // Fire generation
        await inngest.send({
          name: "story/generate-spreads",
          data: { storyId },
        });

        await captureServerEvent(storyId, "free_story_claimed", {
          story_id: storyId,
          product_type: productType,
          promo_code: promo.code,
          currency,
          via: "basket",
        });

        results.push({ storyId, success: true });

      } catch (err: any) {
        results.push({ storyId, success: false, error: err?.message ?? "Unknown error" });
      }
    }

    // Increment promo usage by the number of successful claims
    const successCount = results.filter(r => r.success).length;
    if (successCount > 0) {
      await db
        .update(promoCodes)
        .set({
          currentUses: sql`${promoCodes.currentUses} + ${successCount}`,
          updatedAt: new Date(),
        })
        .where(eq(promoCodes.id, promo.id));
    }

    return NextResponse.json({
      success: true,
      results,
      claimed: successCount,
      failed: results.filter(r => !r.success).length,
    });

  } catch (err: any) {
    console.error("[Basket claim-free] error:", err);
    return NextResponse.json(
      { error: err?.message ?? "Failed to process basket" },
      { status: 500 }
    );
  }
}