// src/app/api/paypal/capture/route.ts

import { NextResponse } from "next/server";
import { paypalCaptureOrder, paypalGetOrder } from "@/lib/paypal";
import { db } from "@/db";
import { stories, storyProducts, promoCodes } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { inngest } from "@/inngest/client";
import { captureServerEvent } from "@/lib/posthog-server";
import {
  computeCheckoutCents,
  getPromoUnusableReason,
  type CurrencyCode,
  type ProductType,
} from "@/lib/pricing";
import { requireUser, requireStoryOwner } from "@/lib/apiAuth";

const VALID_CURRENCIES: CurrencyCode[] = ["GBP", "USD", "EUR", "AUD"];

function moneyToCents(value: unknown): number | null {
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return Math.round(num * 100);
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ShippingAddress = {
  firstName: string;
  lastName: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  postCode: string;
  countryIsoCode: string;
  email: string;
  phone: string;
};

function splitFullName(fullName?: string | null) {
  const clean = (fullName ?? "").trim();
  if (!clean) return { firstName: "", lastName: "" };
  const parts = clean.split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return {
    firstName: parts.slice(0, -1).join(" "),
    lastName: parts.slice(-1).join(""),
  };
}

function extractPaypalShippingAddress(receipt: any): ShippingAddress | null {
  const pu = receipt?.purchase_units?.[0];
  const shipping = pu?.shipping;
  const payer = receipt?.payer;

  if (!shipping?.address && !payer?.address) return null;

  const shippingName = splitFullName(shipping?.name?.full_name);
  const addr = shipping?.address ?? payer?.address ?? {};

  return {
    firstName: shippingName.firstName,
    lastName: shippingName.lastName,
    addressLine1: addr.address_line_1 ?? "",
    addressLine2: addr.address_line_2 ?? "",
    city: addr.admin_area_2 ?? "",
    postCode: addr.postal_code ?? "",
    countryIsoCode: addr.country_code ?? "GB",
    email: payer?.email_address ?? "",
    phone: payer?.phone?.phone_number?.national_number ?? "",
  };
}

export async function POST(req: Request) {
  try {
    const userCheck = await requireUser();
    if (!userCheck.ok) return userCheck.response;

    const { orderID, promoCode } = await req.json();

    if (!orderID || typeof orderID !== "string") {
      return NextResponse.json({ error: "orderID required" }, { status: 400 });
    }

    /* --------------------------------------------------
       VERIFY THE ORDER BEFORE TAKING PAYMENT
       The order could have been created outside /api/paypal/order
       (the PayPal client ID is public), so re-check who it's for and
       that the amount matches our server-side price.
    -------------------------------------------------- */
    const pending = await paypalGetOrder(orderID);
    const pendingUnit = pending?.purchase_units?.[0];
    const storyId: string | undefined = pendingUnit?.custom_id || pendingUnit?.reference_id;

    if (!storyId) {
      return NextResponse.json(
        { error: "Missing storyId on PayPal purchase unit" },
        { status: 400 }
      );
    }

    const ownerCheck = await requireStoryOwner(storyId);
    if (!ownerCheck.ok) return ownerCheck.response;

    const storyProduct = await db.query.storyProducts.findFirst({
      where: eq(storyProducts.storyId, storyId),
    });

    if (!storyProduct) {
      return NextResponse.json(
        { error: "Missing story_products row.", storyId, orderID },
        { status: 400 }
      );
    }

    const productType = storyProduct.productType as ProductType;

    if (!productType || !["digital", "print", "gift"].includes(productType)) {
      return NextResponse.json(
        { error: `Invalid productType "${productType}"`, storyId, orderID },
        { status: 400 }
      );
    }

    const orderCurrency = pendingUnit?.amount?.currency_code as CurrencyCode;
    const orderCents = moneyToCents(pendingUnit?.amount?.value);

    if (!VALID_CURRENCIES.includes(orderCurrency) || orderCents === null) {
      return NextResponse.json({ error: "Invalid order amount" }, { status: 400 });
    }

    let promo: typeof promoCodes.$inferSelect | undefined;
    if (promoCode && typeof promoCode === "string") {
      [promo] = await db
        .select()
        .from(promoCodes)
        .where(sql`LOWER(${promoCodes.code}) = LOWER(${promoCode.trim()})`)
        .limit(1);

      const unusable = promo ? getPromoUnusableReason(promo) : "Invalid promo code.";
      if (unusable) {
        return NextResponse.json({ error: unusable }, { status: 400 });
      }
    }

    const [paidRow] = await db
      .select({ paymentStatus: stories.paymentStatus })
      .from(stories)
      .where(eq(stories.id, storyId))
      .limit(1);

    // Full price is always acceptable; the digital → print/gift upgrade
    // price only for a book that's already been paid for.
    const acceptableCents = [
      computeCheckoutCents(productType, orderCurrency, { promo }),
      paidRow?.paymentStatus === "paid"
        ? computeCheckoutCents(productType, orderCurrency, { upgradeFrom: "digital", promo })
        : null,
    ].filter((c): c is number => c !== null && c > 0);

    if (!acceptableCents.includes(orderCents)) {
      console.error("[PayPal capture] amount mismatch", {
        storyId,
        orderID,
        orderCents,
        orderCurrency,
        acceptableCents,
      });
      return NextResponse.json(
        { error: "Order amount doesn't match the price for this book." },
        { status: 400 }
      );
    }

    /* --------------------------------------------------
       CAPTURE
    -------------------------------------------------- */
    const receipt = await paypalCaptureOrder(orderID);

    if (receipt?.status !== "COMPLETED") {
      return NextResponse.json(
        { error: `Order not completed (status=${receipt?.status})` },
        { status: 400 }
      );
    }

    const isPhysical = productType === "print" || productType === "gift";

    if (isPhysical) {
      const checkoutAddress = extractPaypalShippingAddress(receipt);

      if (!checkoutAddress) {
        return NextResponse.json(
          { error: "Missing shipping address for physical product.", storyId, orderID, productType },
          { status: 400 }
        );
      }

      await db
        .update(storyProducts)
        .set({ checkoutAddress, updatedAt: new Date() })
        .where(eq(storyProducts.storyId, storyId));
    }

    const [storyRow] = await db
      .select({ paymentStatus: stories.paymentStatus })
      .from(stories)
      .where(eq(stories.id, storyId))
      .limit(1);

    const alreadyPaid = storyRow?.paymentStatus === "paid";

    if (alreadyPaid) {
      await db
        .update(stories)
        .set({ paymentId: orderID, updatedAt: new Date() })
        .where(eq(stories.id, storyId));
    } else {
      await db
        .update(stories)
        .set({
          paymentStatus: "paid",
          paymentId: promoCode
            ? `promo:${promoCode.trim().toUpperCase()}:${orderID}`
            : orderID,
          status: "generating",
          updatedAt: new Date(),
        })
        .where(eq(stories.id, storyId));

      await inngest.send({
        name: "story/generate.spreads",
        data: { storyId },
      });
    }

    // Persist promo usage now that payment is confirmed
    if (promo) {
      await db
        .update(promoCodes)
        .set({
          currentUses: sql`${promoCodes.currentUses} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(promoCodes.id, promo.id));
    }

    const payerEmail = receipt?.payer?.email_address;
    const amountValue = receipt?.purchase_units?.[0]?.payments?.captures?.[0]?.amount?.value;
    const currency = receipt?.purchase_units?.[0]?.payments?.captures?.[0]?.amount?.currency_code;
    const distinctId = payerEmail ?? storyId;

    await captureServerEvent(distinctId, "payment_captured", {
      story_id: storyId,
      paypal_order_id: orderID,
      product_type: productType,
      is_upgrade: alreadyPaid,
      amount: amountValue ? parseFloat(amountValue) : undefined,
      currency,
      payer_email: payerEmail,
      promo_code: promoCode ?? undefined,
    });

    return NextResponse.json({
      success: true,
      storyId,
      orderID,
      productType,
      isUpgrade: alreadyPaid,
    });
  } catch (err: any) {
    console.error("[PayPal capture] error:", err);
    return NextResponse.json(
      { error: err?.message ?? "Failed to capture PayPal order" },
      { status: 500 }
    );
  }
}