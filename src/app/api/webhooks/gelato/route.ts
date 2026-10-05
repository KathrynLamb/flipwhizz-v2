// src/app/api/webhooks/gelato/route.ts
//
// Receives order status updates from Gelato and:
//   1. Updates the order record in the DB
//   2. Emails the customer on failure or shipment
//   3. Emails you (Katy) on any failure
//
// Gelato docs: https://dashboard.gelato.com/docs/orders/webhooks
// Always return 200 — returning 4xx/5xx causes Gelato to retry indefinitely.

import { NextResponse } from "next/server";
import { db } from "@/db";
import { orders, stories, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { sendOrderShipped } from "@/lib/emails/sendOrderShipped";
import { sendOrderFailed } from "@/lib/emails/sendOrderFailed";
import { withAlerts, sendAlert } from "@/lib/alerts";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "katylamb2000@gmail.com";

async function fetchGelatoStatus(
  gelatoOrderId: string,
): Promise<{ status?: string | "not_found"; error?: string }> {
  if (!process.env.GELATO_API_KEY) return { error: "GELATO_API_KEY missing" };
  try {
    const res = await fetch(
      `https://order.gelatoapis.com/v4/orders/${encodeURIComponent(gelatoOrderId)}`,
      { headers: { "X-API-KEY": process.env.GELATO_API_KEY }, cache: "no-store" },
    );
    if (res.status === 404) return { status: "not_found" };
    if (!res.ok) return { error: `Gelato API ${res.status}` };
    const data = (await res.json()) as { fulfillmentStatus?: string; status?: string };
    const st = (data.fulfillmentStatus ?? data.status ?? "").toLowerCase();
    return st ? { status: st } : { error: "No status in Gelato API response" };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

async function _POST(req: Request) {
  let payload: any;

  try {
    payload = await req.json();
  } catch {
    console.error("❌ Gelato webhook: failed to parse JSON body");
    return NextResponse.json({ ok: true });
  }

  // Log every webhook so you can see what Gelato actually sends
  console.log("📦 Gelato webhook received:", JSON.stringify(payload, null, 2));

  // ── Normalise payload ──────────────────────────────────────────────────────
  // Gelato uses slightly different shapes depending on event type.
  // We handle the two most common layouts here.
  const orderData = payload.order ?? payload;
  const gelatoOrderId: string | null = orderData.id ?? payload.orderId ?? null;
  let gelatoStatus: string = (
    orderData.fulfillmentStatus ?? orderData.status ?? payload.fulfillmentStatus ?? payload.status ?? ""
  ).toLowerCase();

  // Tracking — may come from fulfillments array or top-level
  const fulfillment = orderData.fulfillments?.[0] ?? payload.fulfillments?.[0];
  const trackingCode: string | null = fulfillment?.trackingCode ?? orderData.trackingCode ?? null;
  const trackingUrl: string | null  = fulfillment?.trackingUrl  ?? orderData.trackingUrl  ?? null;

  // Delivery date estimate
  const minDelivery: string | null =
    orderData.orderEstimatedDeliveryDates?.min ??
    payload.estimatedDeliveryDateMin ??
    null;
  const maxDelivery: string | null =
    orderData.orderEstimatedDeliveryDates?.max ??
    payload.estimatedDeliveryDateMax ??
    null;

  if (!gelatoOrderId) {
    console.error("❌ Gelato webhook: no order ID in payload — logging and ignoring");
    return NextResponse.json({ ok: true });
  }

  if (!gelatoStatus) {
    console.warn("⚠️  Gelato webhook: no status in payload for order", gelatoOrderId);
    return NextResponse.json({ ok: true });
  }

  // ── Verify with Gelato ──────────────────────────────────────────────────────
  // Webhooks aren't signed, so ask Gelato for the real status rather than
  // trusting the payload. If Gelato can't be reached, fall back to the
  // payload (so real updates are never dropped) and alert.
  const verified = await fetchGelatoStatus(gelatoOrderId);
  if (verified.status === "not_found") {
    await sendAlert({
      area: "api/webhooks/gelato",
      title: "Gelato webhook for an order Gelato doesn't know",
      severity: "warning",
      error: `Order ${gelatoOrderId} not found at Gelato; webhook ignored`,
      context: { payloadStatus: gelatoStatus },
    });
    return NextResponse.json({ ok: true });
  }
  if (verified.status) {
    if (verified.status !== gelatoStatus) {
      console.warn(`⚠️  Gelato webhook status "${gelatoStatus}" differs from API "${verified.status}"; using API`);
    }
    gelatoStatus = verified.status;
  } else {
    await sendAlert({
      area: "api/webhooks/gelato",
      title: "Couldn't verify Gelato webhook",
      severity: "warning",
      error: verified.error ?? "unknown",
      context: { gelatoOrderId, payloadStatus: gelatoStatus },
    });
  }

  // ── Find the order ─────────────────────────────────────────────────────────
  const order = await db.query.orders.findFirst({
    where: eq(orders.gelatoOrderId, gelatoOrderId),
  });

  if (!order) {
    // Could be a test event or an order placed outside the app
    console.warn(`⚠️  Gelato webhook: no order found for gelatoOrderId "${gelatoOrderId}"`);
    return NextResponse.json({ ok: true });
  }

  // ── Update order in DB ─────────────────────────────────────────────────────
  await db
    .update(orders)
    .set({
      gelatoStatus,
      status: gelatoStatus,
      ...(trackingCode ? { gelatoTrackingCode: trackingCode } : {}),
      ...(trackingUrl  ? { gelatoTrackingUrl:  trackingUrl  } : {}),
      ...(minDelivery  ? { gelatoMinDeliveryDate: minDelivery } : {}),
      ...(maxDelivery  ? { gelatoMaxDeliveryDate: maxDelivery } : {}),
      gelatoUpdatedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(orders.gelatoOrderId, gelatoOrderId));

  console.log(`✅ Order ${order.id} updated to gelatoStatus="${gelatoStatus}"`);

  // ── Fetch story + user for notification context ────────────────────────────
  const story = await db.query.stories.findFirst({
    where: eq(stories.id, order.storyId),
  });

  const user = order.userId
    ? await db.query.users.findFirst({ where: eq(users.id, order.userId) })
    : null;

  const customerEmail: string | null = user?.email ?? null;
  const storyTitle = story?.title ?? "your story";
  const storyId = order.storyId;

  // ── Status-specific notifications ─────────────────────────────────────────
  if (gelatoStatus === "failed" || gelatoStatus === "canceled") {
    console.error(`🚨 Gelato order ${gelatoOrderId} ${gelatoStatus} — notifying admin and customer`);

    // Always notify admin
    try {
      await notifyAdmin({
        gelatoOrderId,
        gelatoStatus,
        orderId: order.id,
        storyId,
        storyTitle,
        customerEmail,
      });
    } catch (err) {
      console.error("❌ Failed to send admin failure email:", err);
    }

    // Notify customer if we have their email
    if (customerEmail) {
      try {
        await sendOrderFailed({
          to: customerEmail,
          storyTitle,
          storyId,
        });
      } catch (err) {
        console.error("❌ Failed to send customer failure email:", err);
      }
    }
  }

  if (gelatoStatus === "shipped" && customerEmail) {
    try {
      await sendOrderShipped({
        to: customerEmail,
        storyTitle,
        storyId,
        trackingUrl: trackingUrl ?? undefined,
        trackingCode: trackingCode ?? undefined,
        minDelivery: minDelivery ?? undefined,
        maxDelivery: maxDelivery ?? undefined,
      });
    } catch (err) {
      console.error("❌ Failed to send shipped email:", err);
    }
  }

  return NextResponse.json({ ok: true });
}

/* -------------------------------------------------------------------------- */
/*  Admin failure notification (inline — no separate helper needed)           */
/* -------------------------------------------------------------------------- */

async function notifyAdmin({
  gelatoOrderId,
  gelatoStatus,
  orderId,
  storyId,
  storyTitle,
  customerEmail,
}: {
  gelatoOrderId: string;
  gelatoStatus: string;
  orderId: string;
  storyId: string;
  storyTitle: string;
  customerEmail: string | null;
}) {
  const { resend } = await import("@/lib/resend");

  await resend.emails.send({
    from: "FlipWhizz Alerts <orders@flipwhizz.com>",
    to: ADMIN_EMAIL,
    subject: `🚨 Gelato order ${gelatoStatus}: ${storyTitle}`,
    html: `
      <p style="font-family:Arial,sans-serif; font-size:15px;">
        A Gelato print order has <strong>${gelatoStatus}</strong>.
      </p>
      <table style="font-family:Arial,sans-serif; font-size:14px; border-collapse:collapse;">
        <tr><td style="padding:4px 12px 4px 0; color:#888;">Internal order ID</td><td>${orderId}</td></tr>
        <tr><td style="padding:4px 12px 4px 0; color:#888;">Gelato order ID</td><td>${gelatoOrderId}</td></tr>
        <tr><td style="padding:4px 12px 4px 0; color:#888;">Status</td><td><strong>${gelatoStatus}</strong></td></tr>
        <tr><td style="padding:4px 12px 4px 0; color:#888;">Story</td><td>${storyTitle}</td></tr>
        <tr><td style="padding:4px 12px 4px 0; color:#888;">Customer email</td><td>${customerEmail ?? "unknown"}</td></tr>
      </table>
      <p style="font-family:Arial,sans-serif; font-size:14px; margin-top:16px;">
        <a href="https://flipwhizz.com/stories/${storyId}/print">View story print page</a>
        &nbsp;|&nbsp;
        <a href="https://dashboard.gelato.com">Gelato dashboard</a>
      </p>
    `,
  });
}

export const POST = withAlerts("api/webhooks/gelato", _POST, { severity: "critical" });
