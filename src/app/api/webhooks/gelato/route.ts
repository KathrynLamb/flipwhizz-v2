import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { eq } from "drizzle-orm";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const GELATO_WEBHOOK_SECRET = process.env.GELATO_WEBHOOK_SECRET!;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "katy@flipwhizz.com";

export async function POST(req: NextRequest) {
  // --- Auth check ---
  const authHeader = req.headers.get("x-gelato-secret") 
    || req.headers.get("authorization");
  
  // Gelato lets you configure the auth header name in their dashboard.
  // Match whatever you set there. This covers both common patterns.
  if (!authHeader?.includes(GELATO_WEBHOOK_SECRET)) {
    console.error("[gelato-webhook] Auth failed");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const payload = await req.json();
    const { event, orderId: gelatoOrderId, orderReferenceId } = payload;

    console.log(`[gelato-webhook] ${event} for order ${orderReferenceId || gelatoOrderId}`);

    // Find the order — try orderReferenceId first (your FlipWhizz order ID),
    // fall back to gelatoOrderId
    let order;
    if (orderReferenceId) {
      [order] = await db.select().from(orders).where(eq(orders.id, orderReferenceId)).limit(1);
    }
    if (!order && gelatoOrderId) {
      [order] = await db.select().from(orders).where(eq(orders.gelatoOrderId, gelatoOrderId)).limit(1);
    }

    if (!order) {
      console.error(`[gelato-webhook] No matching order for ref=${orderReferenceId} gelato=${gelatoOrderId}`);
      // Return 200 anyway so Gelato doesn't retry endlessly
      return NextResponse.json({ received: true, matched: false });
    }

    // --- Handle each event type ---
    switch (event) {
      case "order_status_updated": {
        const { fulfillmentStatus, items } = payload;

        // Map Gelato statuses to your user-friendly ones
        const statusMap: Record<string, string> = {
          created: "confirmed",
          passed: "confirmed",
          in_production: "printing",
          printed: "printing",
          packed: "printing",
          shipped: "shipped",
          delivered: "delivered",
          canceled: "canceled",
          failed: "failed",
        };

        const mappedStatus = statusMap[fulfillmentStatus] || fulfillmentStatus;

        // Extract tracking from items if available
        let trackingCode: string | null = null;
        let trackingUrl: string | null = null;

        if (items?.length) {
          const fulfillments = items[0]?.fulfillments;
          if (fulfillments?.length) {
            trackingCode = fulfillments[0].trackingCode || null;
            trackingUrl = fulfillments[0].trackingUrl || null;
          }
        }

        await db.update(orders).set({
          gelatoStatus: mappedStatus,
          ...(trackingCode && { gelatoTrackingCode: trackingCode }),
          ...(trackingUrl && { gelatoTrackingUrl: trackingUrl }),
          gelatoUpdatedAt: new Date(),
          updatedAt: new Date(),
        }).where(eq(orders.id, order.id));

        // Notify you on key events
        if (["shipped", "failed", "canceled"].includes(mappedStatus)) {
          await notifyAdmin(event, mappedStatus, order.id, { trackingCode, trackingUrl });
        }

        break;
      }

      case "order_delivery_estimate_updated": {
        const { minDeliveryDate, maxDeliveryDate } = payload;

        await db.update(orders).set({
          gelatoMinDeliveryDate: minDeliveryDate,
          gelatoMaxDeliveryDate: maxDeliveryDate,
          gelatoUpdatedAt: new Date(),
          updatedAt: new Date(),
        }).where(eq(orders.id, order.id));

        break;
      }

      case "order_item_status_updated": {
        // Item-level — useful for logging but for single-item book orders,
        // order_status_updated covers it. Log and skip DB update.
        console.log(`[gelato-webhook] Item ${payload.itemReferenceId} → ${payload.status}`);
        break;
      }

      default:
        console.log(`[gelato-webhook] Unhandled event: ${event}`);
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("[gelato-webhook] Error:", err);
    // Still return 200 to prevent Gelato retrying on our parse errors
    return NextResponse.json({ error: "Internal error" }, { status: 200 });
  }
}

// --- Admin notification ---
async function notifyAdmin(
  event: string,
  status: string,
  orderId: string,
  tracking: { trackingCode: string | null; trackingUrl: string | null }
) {
  try {
    await resend.emails.send({
      from: "FlipWhizz Orders <orders@flipwhizz.com>",
      to: ADMIN_EMAIL,
      subject: `📦 Order ${status}: ${orderId}`,
      html: `
        <h2>Order ${status}</h2>
        <p><strong>Order ID:</strong> ${orderId}</p>
        <p><strong>Event:</strong> ${event}</p>
        <p><strong>Status:</strong> ${status}</p>
        ${tracking.trackingCode ? `<p><strong>Tracking:</strong> ${tracking.trackingCode}</p>` : ""}
        ${tracking.trackingUrl ? `<p><a href="${tracking.trackingUrl}">Track shipment →</a></p>` : ""}
      `,
    });
  } catch (err) {
    console.error("[gelato-webhook] Failed to send admin email:", err);
  }
}