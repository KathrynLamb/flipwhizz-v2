// api/paypal/capture/route.ts
import { NextResponse } from "next/server";
import { paypalCaptureOrder } from "@/lib/paypal";
import { db } from "@/db";
import { stories } from "@/db/schema";
import { eq } from "drizzle-orm";
import { inngest } from "@/inngest/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { orderID } = await req.json();

    if (!orderID) {
      return NextResponse.json(
        { error: "orderID required" },
        { status: 400 }
      );
    }

    /* --------------------------------------------------
       CAPTURE PAYPAL ORDER
    -------------------------------------------------- */

    const receipt = await paypalCaptureOrder(orderID);

    if (receipt?.status !== "COMPLETED") {
      return NextResponse.json(
        {
          error: `Order not completed (status=${receipt?.status})`,
          receipt,
        },
        { status: 400 }
      );
    }

    /* --------------------------------------------------
       RESOLVE STORY ID
    -------------------------------------------------- */

    const pu = receipt.purchase_units?.[0];
    const storyId: string | undefined =
      pu?.custom_id || pu?.reference_id;

    if (!storyId) {
      return NextResponse.json(
        {
          error: "Missing storyId on PayPal purchase unit",
          receipt,
        },
        { status: 400 }
      );
    }

    /* --------------------------------------------------
       UPDATE PAYMENT STATE + SET STATUS TO GENERATING
    -------------------------------------------------- */

    await db
      .update(stories)
      .set({
        paymentStatus: "paid",
        paymentId: orderID,
        status: "generating",        // ← marks story as paid + in-progress
        updatedAt: new Date(),
      })
      .where(eq(stories.id, storyId));

    /* --------------------------------------------------
       FIRE INNGEST — generates all spreads in parallel
    -------------------------------------------------- */

    await inngest.send({
      name: "story/generate.spreads",
      data: { storyId },
    });

    /* --------------------------------------------------
       RESPOND
    -------------------------------------------------- */

    return NextResponse.json({
      success: true,
      storyId,
      orderID,
    });
  } catch (err: any) {
    console.error("[PayPal capture] error:", err);
    return NextResponse.json(
      { error: err.message ?? "Failed to capture PayPal order" },
      { status: 500 }
    );
  }
}