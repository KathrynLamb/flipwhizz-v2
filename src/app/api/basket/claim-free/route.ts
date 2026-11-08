// src/app/api/basket/claim-free/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { CheckoutError, createCheckoutStore } from "@/lib/checkout/store";
import { inngest } from "@/inngest/client";
import { captureServerEvent } from "@/lib/posthog-server";
import { withAlerts } from "@/lib/alerts";
import { getAuthUser, owns, withAccess } from "@/lib/authz";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const checkout = createCheckoutStore(db);
async function _POST(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
    const { storyIds, promoCode } = await req.json();
    if (typeof promoCode !== "string" || !promoCode.trim()) throw new CheckoutError("Promo code required.");
    if (!Array.isArray(storyIds) || !storyIds.length || storyIds.length > 100 || storyIds.some(id => typeof id !== "string")) throw new CheckoutError("Choose between 1 and 100 stories.");
    const results: { storyId: string; success: boolean; error?: string }[] = [];
    for (const storyId of new Set<string>(storyIds)) {
      try {
        if (!user.isAdmin && !(await owns("story", storyId, user.id))) throw new CheckoutError("Story not found.");
        const result = await checkout.claimFree(storyId, user.id, promoCode, user.isAdmin);
        if (result.payment) await inngest.send({ id: `checkout-${result.payment.id}`, name: "story/generate-spreads", data: { storyId } });
        if (!result.alreadyPaid && result.payment) await captureServerEvent(user.id, "free_story_claimed", {
          story_id: storyId, product_type: result.payment.productType,
          promo_code: result.payment.promoCode, currency: result.payment.currency, via: "basket",
        }).catch(error => console.error("Basket analytics failed:", error));
        results.push({ storyId, success: true });
      } catch (err: any) { results.push({ storyId, success: false, error: err?.message ?? "Unable to claim book." }); }
    }
    return NextResponse.json({ success: true, results, claimed: results.filter(r => r.success).length, failed: results.filter(r => !r.success).length });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Failed to process basket." }, { status: err instanceof CheckoutError ? 400 : 500 });
  }
}
export const POST = withAlerts("api/basket/claim-free", withAccess({ login: true }, _POST), { severity: "critical" });
