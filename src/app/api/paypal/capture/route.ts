// src/app/api/paypal/capture/route.ts
import { NextResponse } from "next/server";
import { paypalCaptureOrder, paypalGetOrder } from "@/lib/paypal";
import { db } from "@/db";
import { checkoutPayments } from "@/db/schema";
import { eq } from "drizzle-orm";
import { inngest } from "@/inngest/client";
import { captureServerEvent } from "@/lib/posthog-server";
import { withAlerts } from "@/lib/alerts";
import { getAuthUser, owns, withAccess } from "@/lib/authz";
import { CheckoutError, createCheckoutStore } from "@/lib/checkout/store";
import { recordBookEvent } from "@/lib/events/bookEvents";
import { DECLINED_MESSAGE, PaypalApiError, browserSummary, isRestartableDecline } from "@/lib/paypalErrors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const checkout = createCheckoutStore(db);

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


async function _POST(req: Request) {
  // Kept outside the try so a decline can be put on the right book's timeline.
  let declineContext: { userId: string; storyId: string; orderID: string; amountCents: number; currency: string; productType: string } | null = null;
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
    const { orderID } = await req.json();
    if (typeof orderID !== "string" || !orderID) throw new CheckoutError("Payment reference required.");
    const [quote] = await db.select().from(checkoutPayments).where(eq(checkoutPayments.id, orderID));
    if (!quote || quote.userId !== user.id) throw new CheckoutError("Please refresh checkout and try your payment again.");
    if (!user.isAdmin && !(await owns("story", quote.storyId, user.id))) return NextResponse.json({ error: "Not found" }, { status: 404 });

    declineContext = { userId: user.id, storyId: quote.storyId, orderID, amountCents: quote.amountCents, currency: quote.currency, productType: quote.productType };
    let payment = quote;
    if (quote.status !== "paid") {
      // Trust the saved server quote, never a client-supplied promo or amount.
      const pending = await paypalGetOrder(orderID);
      const unit = pending?.purchase_units?.[0];
      const cents = Math.round(Number(unit?.amount?.value) * 100);
      if (pending?.purchase_units?.length !== 1 ||
          (unit?.custom_id || unit?.reference_id) !== quote.storyId ||
          !Number.isFinite(cents) || cents !== quote.amountCents ||
          unit?.amount?.currency_code !== quote.currency) {
        throw new CheckoutError("Payment details do not match this checkout. Please start again.");
      }
      if (pending.status === "VOIDED") {
        await checkout.cancelVoided(orderID, user.id);
        throw new CheckoutError("This payment was cancelled. Please start checkout again.");
      }
      if (pending.status !== "APPROVED" && pending.status !== "COMPLETED") throw new CheckoutError("Please approve the payment in PayPal first.");
      const address = extractPaypalShippingAddress(pending);
      if (quote.productType !== "digital" && !address) throw new CheckoutError("Please add a delivery address in PayPal.");

      // Reservation commits before the external capture. An ambiguous timeout
      // keeps the use reserved; retrying this order resumes the same payment.
      await checkout.reserve(orderID, user.id);
      const receipt = pending.status === "COMPLETED" ? pending : await paypalCaptureOrder(orderID);
      const capture = receipt?.purchase_units?.[0]?.payments?.captures?.[0];
      if (receipt?.status !== "COMPLETED" || capture?.status !== "COMPLETED" ||
          Math.round(Number(capture?.amount?.value) * 100) !== quote.amountCents ||
          capture?.amount?.currency_code !== quote.currency) {
        throw new CheckoutError("PayPal has not confirmed this payment yet. Please retry this checkout.");
      }
      payment = await checkout.complete(orderID, user.id, extractPaypalShippingAddress(receipt) ?? address);
    }

    // Stable event ID makes a retry after an Inngest outage safe.
    if (!payment.isUpgrade) await inngest.send({
      id: `checkout-${payment.id}`, name: "story/generate-spreads",
      data: { storyId: payment.storyId },
    });
    if (quote.status !== "paid") await captureServerEvent(user.id, "payment_captured", {
      story_id: payment.storyId, paypal_order_id: orderID,
      product_type: payment.productType, is_upgrade: payment.isUpgrade,
      amount: payment.amountCents / 100, currency: payment.currency,
      promo_code: payment.promoCode ?? undefined,
    }).catch(error => console.error("Payment analytics failed:", error));

    await recordBookEvent({
      kind: "paid",
      summary: `Paid ${(payment.amountCents / 100).toFixed(2)} ${payment.currency} for ${payment.productType}${payment.isUpgrade ? " (upgrade)" : ""}${payment.promoCode ? ` with code ${payment.promoCode}` : ""}`,
      userId: user.id,
      storyId: payment.storyId,
      details: { product: payment.productType, amount: payment.amountCents / 100, currency: payment.currency, promo_code: payment.promoCode ?? null, paypal_order_id: orderID },
      dedupeKey: `paid:${payment.id}`,
    });

    return NextResponse.json({ success: true, storyId: payment.storyId, orderID, productType: payment.productType, isUpgrade: payment.isUpgrade });
  } catch (err: any) {
    // A declined card is the buyer's bank saying no, not a FlipWhizz fault:
    // no critical alert, a clear message, and the browser restarts PayPal on
    // the same order so they can pick another card or their balance.
    if (isRestartableDecline(err)) {
      console.warn("[PayPal capture] declined:", err.issue, err.debugId);
      if (declineContext) await recordBookEvent({
        kind: "payment_declined",
        summary: `PayPal declined ${(declineContext.amountCents / 100).toFixed(2)} ${declineContext.currency} for ${declineContext.productType} (${err.issue}) on ${browserSummary(req.headers.get("user-agent"))}`,
        userId: declineContext.userId,
        storyId: declineContext.storyId,
        details: { issue: err.issue, paypal_debug_id: err.debugId, paypal_order_id: declineContext.orderID, user_agent: req.headers.get("user-agent") },
        dedupeKey: `payment_declined:${declineContext.orderID}:${Math.floor(Date.now() / 60_000)}`,
      });
      return NextResponse.json({ error: DECLINED_MESSAGE, declined: true }, { status: 402 });
    }
    console.error("[PayPal capture] error:", err, err instanceof PaypalApiError ? { issue: err.issue, debugId: err.debugId } : "");
    return NextResponse.json({ error: err?.message ?? "Failed to capture payment. Please retry." }, { status: err instanceof CheckoutError ? 400 : 500 });
  }
}
export const POST = withAlerts("api/paypal/capture", withAccess({ login: true }, _POST), { severity: "critical" });
