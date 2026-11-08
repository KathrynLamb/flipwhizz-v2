// src/app/api/paypal/order/route.ts
import { colouringPurchaseError } from "@/lib/lulu/client";
// src/app/api/paypal/order/route.ts

import { NextResponse } from "next/server";
import { paypalCreateOrder } from "@/lib/paypal";
import { db } from "@/db";
import { stories, storyProducts, promoCodes, checkoutPayments } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import {
  getPriceCents,
  applyDiscount,
  resolvePromoDiscount,
  getPromoUnusableReason,
  type ProductType,
  type CurrencyCode,
} from "@/lib/pricing";
import { withAlerts } from "@/lib/alerts";
import { getAuthUser, withAccess } from "@/lib/authz";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_PRODUCTS: ProductType[] = ["digital", "print", "gift"];
const VALID_CURRENCIES: CurrencyCode[] = ["GBP", "USD", "EUR", "AUD", "CAD"];

function centsToPriceString(cents: number): string {
  return (cents / 100).toFixed(2);
}

function normalizeMoney(value: unknown): string | null {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return null;
  return num.toFixed(2);
}

async function _POST(req: Request) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
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
    const formatStory = await db.query.stories.findFirst({ where: eq(stories.id, storyId) });
    if (formatStory?.bookType === "colouring_storybook" && !formatStory.bookTypeConfirmedAt) return NextResponse.json({ error: "Confirm your colouring storybook format before checkout." }, { status: 409 });
    const formatError = colouringPurchaseError(formatStory?.bookType ?? "storybook", productType ?? "", (await getAuthUser())?.isAdmin === true);
    if (formatError) return NextResponse.json({ error: formatError }, { status: 409 });

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
    let expectedCents = getPriceCents(productType, currency, formatStory?.bookType);
    let isUpgrade = false;

    if (
      upgradeFrom &&
      typeof upgradeFrom === "string" &&
      VALID_PRODUCTS.includes(upgradeFrom as ProductType)
    ) {
      // Upgrade pricing (pay only the difference) is only for books
      // that have already been paid for.
      const [storyRow] = await db
        .select({ paymentStatus: stories.paymentStatus })
        .from(stories)
        .where(eq(stories.id, storyId))
        .limit(1);

      if (storyRow?.paymentStatus !== "paid") {
        return NextResponse.json(
          { error: "Only a book that's already been purchased can be upgraded." },
          { status: 400 }
        );
      }

      const fromCents = getPriceCents(upgradeFrom as ProductType, currency, formatStory?.bookType);
      const toCents = getPriceCents(productType, currency, formatStory?.bookType);

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
    let appliedPromo: typeof promoCodes.$inferSelect | undefined;
    let promoApplied = false;
    let promoLabel = "";
    let discountCents = 0;

    if (promoCode && typeof promoCode === "string") {
      const [promo] = await db
        .select()
        .from(promoCodes)
        .where(sql`LOWER(${promoCodes.code}) = LOWER(${promoCode.trim()})`)
        .limit(1);

      if (!promo) {
        return NextResponse.json(
          { error: "Invalid or inactive promo code." },
          { status: 400 }
        );
      }

      const unusable = getPromoUnusableReason(promo);
      if (unusable) {
        return NextResponse.json({ error: unusable }, { status: 400 });
      }

      const discount = resolvePromoDiscount(promo, productType, currency, formatStory?.bookType);
      const discountedCents = applyDiscount(expectedCents, discount.discountPercent, discount.isFree);

      discountCents = expectedCents - discountedCents;
      expectedCents = discountedCents;
      promoApplied = true;
      appliedPromo = promo;
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

    // Immutable server-side quote and promo attribution. No promo use is spent
    // until the buyer approves payment and capture reserves it.
    await db.insert(checkoutPayments).values({
      id: order.id, storyId, userId: user.id, productType,
      bookType: formatStory?.bookType ?? "storybook", currency,
      amountCents: expectedCents, promoId: appliedPromo?.id ?? null,
      promoCode: appliedPromo?.code ?? null, isUpgrade: isUpgrade || formatStory?.paymentStatus === "paid",
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

export const POST = withAlerts("api/paypal/order", withAccess({ story: { body: "storyId" } }, _POST), { severity: "critical" });
