
import { NextResponse } from "next/server";
import { paypalCreateOrder } from "@/lib/paypal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { storyId, product, price, currency } = await req.json();
    if (!storyId || !price) {
      return NextResponse.json({ error: "storyId + price required" }, { status: 400 });
    }

    // const amountNum = Number(price);
// const safeAmount = Number.isFinite(amountNum) && amountNum >= 0.01 ? amountNum : 0.01;
const amountNum = Number(price);
const safeAmount = Number.isFinite(amountNum) && amountNum >= 0.01 ? amountNum : 0.01;

    const order = await paypalCreateOrder({
      storyId,
      product: product ?? "FlipWhizz Book Preview",
    //   amount: String(price),
    amount: safeAmount.toFixed(2),


      currency: currency ?? "GBP",
    });

    return NextResponse.json({ orderID: order.id });
  } catch (err: any) {
    console.error("[PayPal order] error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
