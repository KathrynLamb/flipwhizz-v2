// export const runtime = "nodejs";
// export const dynamic = "force-dynamic";


// import { NextResponse } from "next/server";
// import { getPaypalAccessToken, PAYPAL_BASE_URL } from "@/lib/paypal";
// import { db } from "@/db";
// import { stories } from "@/db/schema";
// import { eq } from "drizzle-orm";

// type Body = {
//   storyId: string;
//   price: string; // e.g. "9.99"
//   product?: string;
// };

// export async function POST(req: Request) {
//   try {
//     const body = (await req.json()) as Body;
//     const { storyId, price, product = "FlipWhizz Book Package" } = body;

//     if (!storyId || !price) {
//       return NextResponse.json(
//         { error: "Missing storyId or price" },
//         { status: 400 }
//       );
//     }

//     const currency = process.env.PAYPAL_CURRENCY || "GBP";

//     const accessToken = await getPaypalAccessToken();

//     // 1️⃣ Create order with PayPal
//     const orderRes = await fetch(`${PAYPAL_BASE_URL}/v2/checkout/orders`, {
//       method: "POST",
//       headers: {
//         Authorization: `Bearer ${accessToken}`,
//         "Content-Type": "application/json",
//       },
//       body: JSON.stringify({
//         intent: "CAPTURE",
//         purchase_units: [
//           {
//             reference_id: storyId,
//             custom_id: storyId, // so we can link back
//             amount: {
//               currency_code: currency,
//               value: price,
//             },
//             description: product,
//           },
//         ],
//         application_context: {
//           brand_name: "FlipWhizz",
//           landing_page: "NO_PREFERENCE",
//           user_action: "PAY_NOW",
//         },
//       }),
//     });

//     const orderData = await orderRes.json();

//     if (!orderRes.ok) {
//       console.error("[PayPal create order] error:", orderData);
//       return NextResponse.json(
//         { error: "Failed to create PayPal order" },
//         { status: 500 }
//       );
//     }

//     const orderID = orderData.id as string;

//     // 2️⃣ Store pending status on story
//     await db
//       .update(stories)
//       .set({
//         paymentStatus: "pending",
//         paymentId: orderID,
//       })
//       .where(eq(stories.id, storyId));

//     return NextResponse.json({ orderID });
//   } catch (err: any) {
//     console.error("[PayPal order] error:", err);
//     return NextResponse.json(
//       { error: err.message ?? "Failed to create order" },
//       { status: 500 }
//     );
//   }
// }
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
