// src/app/api/promo/validate/route.ts

import { NextResponse } from "next/server";
import { db } from "@/db";
import { promoCodes } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import {
  resolvePromoDiscount,
  getPriceCents,
  applyDiscount,
  formatPrice,
  type ProductType,
  type CurrencyCode,
} from "@/lib/pricing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_PRODUCTS: ProductType[] = ["digital", "print", "gift"];
const VALID_CURRENCIES: CurrencyCode[] = ["GBP", "USD", "EUR", "AUD"];

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { code, productType, currency } = body ?? {};

    if (!code || typeof code !== "string") {
      return NextResponse.json({ error: "Code is required" }, { status: 400 });
    }

    if (!productType || !VALID_PRODUCTS.includes(productType)) {
      return NextResponse.json(
        { error: "Valid product type required" },
        { status: 400 }
      );
    }

    const cur: CurrencyCode =
      currency && VALID_CURRENCIES.includes(currency) ? currency : "GBP";

    // Case-insensitive lookup
    const [promo] = await db
      .select()
      .from(promoCodes)
      .where(sql`LOWER(${promoCodes.code}) = LOWER(${code.trim()})`)
      .limit(1);

    if (!promo) {
      return NextResponse.json(
        { valid: false, reason: "Code not recognised" },
        { status: 200 }
      );
    }

    if (!promo.active) {
      return NextResponse.json(
        { valid: false, reason: "This code is no longer active" },
        { status: 200 }
      );
    }

    const now = new Date();

    if (promo.startsAt && now < promo.startsAt) {
      return NextResponse.json(
        { valid: false, reason: "This code is not yet active" },
        { status: 200 }
      );
    }

    if (promo.expiresAt && now > promo.expiresAt) {
      return NextResponse.json(
        { valid: false, reason: "This code has expired" },
        { status: 200 }
      );
    }

    if (promo.maxUses !== null && promo.currentUses >= promo.maxUses) {
      return NextResponse.json(
        { valid: false, reason: "This code has been fully redeemed" },
        { status: 200 }
      );
    }

    // Calculate discount for requested product
    const discount = resolvePromoDiscount(promo, productType as ProductType);
    const originalCents = getPriceCents(productType as ProductType, cur);
    const discountedCents = applyDiscount(
      originalCents,
      discount.discountPercent,
      discount.isFree
    );

    return NextResponse.json({
      valid: true,
      code: promo.code,
      label: discount.label,
      discountPercent: discount.discountPercent,
      isFree: discount.isFree,
      originalPrice: formatPrice(originalCents, cur),
      discountedPrice: formatPrice(discountedCents, cur),
      originalCents,
      discountedCents,
      savings: formatPrice(originalCents - discountedCents, cur),
    });
  } catch (err: any) {
    console.error("[Promo validate] error:", err);
    return NextResponse.json(
      { error: err?.message ?? "Failed to validate code" },
      { status: 500 }
    );
  }
}