// src/app/api/paypal/order/route.ts

import { NextResponse } from "next/server";
import { paypalCreateOrder } from "@/lib/paypal";
import { db } from "@/db";
import { storyProducts, promoCodes } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import {
  getPriceCents,
  applyDiscount,
  resolvePromoDiscount,
  type ProductType,
  type CurrencyCode,
} from "@/lib/pricing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_PRODUCTS: ProductType[] = ["digital", "print", "gift"];
const VALID_CURRENCIES: CurrencyCode[] = ["GBP", "USD", "EUR", "AUD"];

function centsToPriceString(cents: number): string {
  return (cents / 100).toFixed(2);
}

function normalizeMoney(value: unknown): string | null {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return null;
  return num.toFixed(2);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { storyId, currency: rawCurrency, upgradeFrom, promoCode } = body ?? {};

    if (!storyId) {
      return NextResponse.json({ error: "storyId required" }, { status: 400 });
    }

    /* --------------------------------------------------
       LOAD STORY PRODUCT
    -------------------------------------------------- */
    const storyProduct = await db.query.storyProducts.findFirst({
      where: eq(storyProducts.storyId, storyId),
    });

    if (!storyProduct) {
      return NextResponse.json(
        { error: "No product has been selected for this story." },
        { status: 400 }
      );
    }

    const productType = storyProduct.productType as ProductType;

    if (!productType || !VALID_PRODUCTS.includes(productType)) {
      return NextResponse.json(
        { error: `Invalid productType "${productType}" on story_products` },
        { status: 400 }
      );
    }

    const currency: CurrencyCode =
      rawCurrency && VALID_CURRENCIES.includes(rawCurrency)
        ? rawCurrency
        : (storyProduct.currency as CurrencyCode) ?? "GBP";

    /* --------------------------------------------------
       CALCULATE BASE PRICE
    -------------------------------------------------- */
    let expectedCents = getPriceCents(productType, currency);
    let isUpgrade = false;

    if (
      upgradeFrom &&
      typeof upgradeFrom === "string" &&
      VALID_PRODUCTS.includes(upgradeFrom as ProductType)
    ) {
      const fromCents = getPriceCents(upgradeFrom as ProductType, currency);
      const toCents = getPriceCents(productType, currency);

      if (toCents <= fromCents) {
        return NextResponse.json(
          { error: `Cannot upgrade from "${upgradeFrom}" to "${productType}".` },
          { status: 400 }
        );
      }

      expectedCents = toCents - fromCents;
      isUpgrade = true;
    }

    /* --------------------------------------------------
       APPLY PROMO CODE (if provided)
    -------------------------------------------------- */
    let promoApplied = false;
    let promoLabel = "";
    let discountCents = 0;

    if (promoCode && typeof promoCode === "string") {
      const [promo] = await db
        .select()
        .from(promoCodes)
        .where(sql`LOWER(${promoCodes.code}) = LOWER(${promoCode.trim()})`)
        .limit(1);

      if (!promo || !promo.active) {
        return NextResponse.json(
          { error: "Invalid or inactive promo code." },
          { status: 400 }
        );
      }

      const now = new Date();
      if (promo.startsAt && now < promo.startsAt) {
        return NextResponse.json({ error: "Promo code not yet active." }, { status: 400 });
      }
      if (promo.expiresAt && now > promo.expiresAt) {
        return NextResponse.json({ error: "Promo code has expired." }, { status: 400 });
      }
      if (promo.maxUses !== null && promo.currentUses >= promo.maxUses) {
        return NextResponse.json({ error: "Promo code fully redeemed." }, { status: 400 });
      }

      const discount = resolvePromoDiscount(promo, productType, currency);
      const discountedCents = applyDiscount(expectedCents, discount.discountPercent, discount.isFree);

      discountCents = expectedCents - discountedCents;
      expectedCents = discountedCents;
      promoApplied = true;
      promoLabel = discount.label;
      // NOTE: do NOT increment currentUses here — that happens in /api/paypal/capture
      // after payment is confirmed, to avoid burning uses on cancelled payments.
    }

    /* --------------------------------------------------
       HANDLE FREE ORDERS (promo makes it £0)
    -------------------------------------------------- */
    if (expectedCents === 0) {
      return NextResponse.json({
        orderID: null,
        free: true,
        productType,
        amount: "0.00",
        currency,
        isUpgrade,
        promoApplied,
        promoLabel,
        promoCode: promoApplied ? promoCode.trim().toUpperCase() : undefined,
      });
    }

    /* --------------------------------------------------
       VALIDATE CLIENT PRICE
    -------------------------------------------------- */
    const canonicalPrice = centsToPriceString(expectedCents);
    const requestedPrice = normalizeMoney(body?.price);

    if (!requestedPrice) {
      return NextResponse.json({ error: "Valid price required" }, { status: 400 });
    }

    if (requestedPrice !== canonicalPrice) {
      return NextResponse.json(
        {
          error: `Price mismatch. Expected ${canonicalPrice} ${currency}, received ${requestedPrice}.`,
        },
        { status: 400 }
      );
    }

    /* --------------------------------------------------
       CREATE PAYPAL ORDER
    -------------------------------------------------- */
    const productLabel = isUpgrade
      ? `FlipWhizz Upgrade to ${productType === "gift" ? "Gift Edition" : "Printed Storybook"}`
      : productType === "digital"
        ? "FlipWhizz Digital Storybook"
        : productType === "gift"
          ? "FlipWhizz Gift Edition"
          : "FlipWhizz Printed Storybook";

    const isDigital = productType === "digital";
    const shippingPreference = isDigital && !isUpgrade ? "NO_SHIPPING" : "GET_FROM_FILE";

    const order = await paypalCreateOrder({
      storyId,
      product: productLabel,
      amount: canonicalPrice,
      currency,
      shippingPreference,
    });

    return NextResponse.json({
      orderID: order.id,
      free: false,
      productType,
      amount: canonicalPrice,
      currency,
      isUpgrade,
      promoApplied,
      promoLabel,
      promoCode: promoApplied ? promoCode.trim().toUpperCase() : undefined,
      discountCents,
    });
  } catch (err: any) {
    console.error("[PayPal order] error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to create PayPal order" },
      { status: 500 }
    );
  }
}