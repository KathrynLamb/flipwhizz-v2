// src/app/api/paypal/order/route.ts
import { NextResponse } from "next/server";
import { paypalCreateOrder } from "@/lib/paypal";
import { db } from "@/db";
import { storyProducts } from "@/db/schema";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PRICES: Record<string, string> = {
  digital: "14.00",
  print: "29.00",
  gift: "39.00",
};

function normalizeMoney(value: unknown): string | null {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0.01) return null;
  return num.toFixed(2);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { storyId, currency } = body ?? {};

    if (!storyId) {
      return NextResponse.json(
        { error: "storyId required" },
        { status: 400 }
      );
    }

    const storyProduct = await db.query.storyProducts.findFirst({
      where: eq(storyProducts.storyId, storyId),
    });

    if (!storyProduct) {
      return NextResponse.json(
        {
          error:
            "No product has been selected for this story. Save the product choice before starting PayPal checkout.",
        },
        { status: 400 }
      );
    }

    const productType = storyProduct.productType;

    if (!productType || !(productType in PRICES)) {
      return NextResponse.json(
        {
          error: `Invalid or missing productType on story_products for story ${storyId}`,
        },
        { status: 400 }
      );
    }

    const canonicalPrice = PRICES[productType];
    const requestedPrice = normalizeMoney(body?.price);

    if (!requestedPrice) {
      return NextResponse.json(
        { error: "Valid price required" },
        { status: 400 }
      );
    }

    if (requestedPrice !== canonicalPrice) {
      return NextResponse.json(
        {
          error: `Price mismatch for productType "${productType}". Expected ${canonicalPrice}, received ${requestedPrice}.`,
        },
        { status: 400 }
      );
    }

    const isDigital = productType === "digital";

    const order = await paypalCreateOrder({
      storyId,
      product:
        productType === "digital"
          ? "FlipWhizz Digital Storybook"
          : productType === "gift"
            ? "FlipWhizz Gift Edition"
            : "FlipWhizz Printed Storybook",
      amount: canonicalPrice,
      currency: currency ?? "GBP",
      shippingPreference: isDigital ? "NO_SHIPPING" : "GET_FROM_FILE",
    });

    return NextResponse.json({
      orderID: order.id,
      productType,
      amount: canonicalPrice,
      currency: currency ?? "GBP",
    });
  } catch (err: any) {
    console.error("[PayPal order] error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to create PayPal order" },
      { status: 500 }
    );
  }
}