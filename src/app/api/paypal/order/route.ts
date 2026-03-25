// src/app/api/paypal/order/route.ts
import { NextResponse } from "next/server";
import { paypalCreateOrder } from "@/lib/paypal";
import { db } from "@/db";
import { storyProducts } from "@/db/schema";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { storyId, product, price, currency } = await req.json();

    if (!storyId || !price) {
      return NextResponse.json(
        { error: "storyId + price required" },
        { status: 400 }
      );
    }

    const amountNum = Number(price);
    const safeAmount =
      Number.isFinite(amountNum) && amountNum >= 0.01 ? amountNum : 0.01;

    const storyProduct = await db.query.storyProducts.findFirst({
      where: eq(storyProducts.storyId, storyId),
    });

    const productType = storyProduct?.productType ?? "print";
    const isDigital = productType === "digital";

    const order = await paypalCreateOrder({
      storyId,
      product: product ?? "FlipWhizz Book Preview",
      amount: safeAmount.toFixed(2),
      currency: currency ?? "GBP",
      shippingPreference: isDigital ? "NO_SHIPPING" : "GET_FROM_FILE",
    });

    return NextResponse.json({ orderID: order.id });
  } catch (err: any) {
    console.error("[PayPal order] error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to create PayPal order" },
      { status: 500 }
    );
  }
}