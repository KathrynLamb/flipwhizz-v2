// src/app/api/paypal/capture-free/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { CheckoutError, createCheckoutStore } from "@/lib/checkout/store";
import { inngest } from "@/inngest/client";
import { withAlerts } from "@/lib/alerts";
import { getAuthUser, withAccess } from "@/lib/authz";

const checkout = createCheckoutStore(db);
async function _POST(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
    const { storyId, promoCode } = await req.json();
    if (typeof storyId !== "string" || typeof promoCode !== "string" || !promoCode.trim()) throw new CheckoutError("Choose a story and enter a promo code.");
    const result = await checkout.claimFree(storyId, user.id, promoCode, user.isAdmin);
    if (result.payment) await inngest.send({ id: `checkout-${result.payment.id}`, name: "story/generate-spreads", data: { storyId } });
    return NextResponse.json({ success: true, alreadyPaid: result.alreadyPaid });
  } catch (err: any) {
    console.error("[claim-free] Error:", err);
    return NextResponse.json({ error: err?.message ?? "Failed to claim book." }, { status: err instanceof CheckoutError ? 400 : 500 });
  }
}
export const POST = withAlerts("api/paypal/capture-free", withAccess({ story: { body: "storyId" } }, _POST), { severity: "critical" });
