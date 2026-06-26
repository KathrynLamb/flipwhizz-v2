// src/app/api/paypal/capture/route.ts

import { NextResponse } from "next/server";
import { paypalCaptureOrder } from "@/lib/paypal";
import { db } from "@/db";
import { stories, storyProducts, promoCodes } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { inngest } from "@/inngest/client";
import { captureServerEvent } from "@/lib/posthog-server";

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
    const { orderID, promoCode } = await req.json();

    if (!orderID) {
      return NextResponse.json({ error: "orderID required" }, { status: 400 });
    }

    const receipt = await paypalCaptureOrder(orderID);

    if (receipt?.status !== "COMPLETED") {
      return NextResponse.json(
        { error: `Order not completed (status=${receipt?.status})`, receipt },
        { status: 400 }
      );
    }

    const pu = receipt?.purchase_units?.[0];
    const storyId: string | undefined = pu?.custom_id || pu?.reference_id;

    if (!storyId) {
      return NextResponse.json(
        { error: "Missing storyId on PayPal purchase unit", receipt },
        { status: 400 }
      );
    }

    const storyProduct = await db.query.storyProducts.findFirst({
      where: eq(storyProducts.storyId, storyId),
    });

    if (!storyProduct) {
      return NextResponse.json(
        { error: "Missing story_products row.", storyId, orderID },
        { status: 400 }
      );
    }

    const productType = storyProduct.productType;

    if (!productType || !["digital", "print", "gift"].includes(productType)) {
      return NextResponse.json(
        { error: `Invalid productType "${productType}"`, storyId, orderID },
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
    if (promoCode && typeof promoCode === "string") {
      await db
        .update(promoCodes)
        .set({
          currentUses: sql`${promoCodes.currentUses} + 1`,
          updatedAt: new Date(),
        })
        .where(sql`LOWER(${promoCodes.code}) = LOWER(${promoCode.trim()})`);
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