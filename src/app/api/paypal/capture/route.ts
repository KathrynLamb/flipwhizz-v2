// import { NextResponse } from "next/server";
// import { getPaypalAccessToken, PAYPAL_BASE_URL } from "@/lib/paypal";
// import { db } from "@/db";
// import { stories } from "@/db/schema";
// import { eq } from "drizzle-orm";

// type Body = {
//   orderID: string;
// };

// export async function POST(req: Request) {
//   try {
//     const { orderID } = (await req.json()) as Body;

//     if (!orderID) {
//       return NextResponse.json(
//         { error: "Missing orderID" },
//         { status: 400 }
//       );
//     }

//     const accessToken = await getPaypalAccessToken();

//     // 1️⃣ Capture on PayPal
//     const captureRes = await fetch(
//       `${PAYPAL_BASE_URL}/v2/checkout/orders/${orderID}/capture`,
//       {
//         method: "POST",
//         headers: {
//           Authorization: `Bearer ${accessToken}`,
//           "Content-Type": "application/json",
//         },
//       }
//     );

//     const captureData = await captureRes.json();

//     if (!captureRes.ok) {
//       console.error("[PayPal capture] error:", captureData);
//       return NextResponse.json(
//         { error: "Failed to capture PayPal order" },
//         { status: 500 }
//       );
//     }

//     const status = captureData.status as string | undefined;

//     // 2️⃣ Find story by paymentId
//     const [story] = await db
//       .select()
//       .from(stories)
//       .where(eq(stories.paymentId, orderID));

//     if (!story) {
//       console.warn("[PayPal capture] No story found for orderID", orderID);
//     } else {
//       // 3️⃣ Update story paymentStatus
//       await db
//         .update(stories)
//         .set({
//           paymentStatus: status === "COMPLETED" ? "paid" : status?.toLowerCase() ?? "unknown",
//         })
//         .where(eq(stories.id, story.id));
//     }

//     return NextResponse.json({
//       success: true,
//       status,
//       raw: captureData,
//     });
//   } catch (err: any) {
//     console.error("[PayPal capture] error:", err);
//     return NextResponse.json(
//       { error: err.message ?? "Failed to capture order" },
//       { status: 500 }
//     );
//   }
// }
import { NextResponse } from "next/server";
import { paypalCaptureOrder } from "@/lib/paypal";
import { db } from "@/db";
import { stories } from "@/db/schema";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { orderID } = await req.json();
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

    await db
      .update(stories)
      .set({
        paymentStatus: "paid",
        paymentId: orderID,
        updatedAt: new Date(),
      })
      .where(eq(stories.id, storyId));

    return NextResponse.json({ success: true, storyId, orderID, receipt });
  } catch (err: any) {
    console.error("[PayPal capture] error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
