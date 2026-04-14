// app/stories/[id]/book/page.tsx

import CompletedBookView from "@/app/stories/[id]/book/Completedbookview";
import { db } from "@/db";
import { stories, orders } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";

// ─── Gelato status sync on page load ───
async function syncGelatoStatus(order: {
  id: string;
  gelatoOrderId: string | null;
  gelatoStatus: string | null;
}) {
  if (!order.gelatoOrderId) return null;

  const apiKey = process.env.GELATO_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch(
      `https://order.gelatoapis.com/v4/orders/${order.gelatoOrderId}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "X-API-KEY": apiKey,
        },
        next: { revalidate: 0 }, // always fresh
      }
    );

    if (!res.ok) {
      console.error(
        `[book/page] Gelato status check failed: ${res.status}`
      );
      return null;
    }

    const data = await res.json();
    const gelatoFulfillmentStatus: string = data.fulfillmentStatus;

    // Map Gelato statuses to our internal ones
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

    const mappedStatus =
      statusMap[gelatoFulfillmentStatus] || gelatoFulfillmentStatus;

    // Extract tracking info if available
    let trackingCode: string | null = null;
    let trackingUrl: string | null = null;

    if (data.items?.length) {
      const fulfillments = data.items[0]?.fulfillments;
      if (fulfillments?.length) {
        trackingCode = fulfillments[0].trackingCode || null;
        trackingUrl = fulfillments[0].trackingUrl || null;
      }
    }

    // Only update DB if status has actually changed
    if (mappedStatus !== order.gelatoStatus) {
      console.log(
        `[book/page] Gelato status drift: DB=${order.gelatoStatus} → API=${mappedStatus}`
      );

      await db
        .update(orders)
        .set({
          gelatoStatus: mappedStatus,
          ...(trackingCode && { gelatoTrackingCode: trackingCode }),
          ...(trackingUrl && { gelatoTrackingUrl: trackingUrl }),
          gelatoUpdatedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(orders.id, order.id));
    }

    return {
      status: mappedStatus,
      trackingCode,
      trackingUrl,
      minDeliveryDate: data.items?.[0]?.fulfillments?.[0]?.estimatedShipDate || null,
    };
  } catch (err) {
    console.error("[book/page] Gelato sync error:", err);
    return null;
  }
}

// ─── Helper: is book locked? ───
function isBookLocked(story: {
  paymentStatus: string | null;
  pdfUrl: string | null;
}) {
  return story.paymentStatus === "paid" && !!story.pdfUrl;
}

// ─── Page ───
export default async function BookPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // 1. Fetch story
  const story = await db.query.stories.findFirst({
    where: eq(stories.id, id),
  });

  if (!story) return notFound();

  // 2. If not locked, redirect back to studio
  if (!isBookLocked(story)) {
    redirect(`/stories/${id}/studio`);
  }

  // 3. Fetch latest order for this story
  const latestOrder = await db.query.orders.findFirst({
    where: eq(orders.storyId, id),
    orderBy: desc(orders.createdAt),
  });

  // 4. Sync Gelato status on page load (belt-and-braces)
  let liveStatus = null;
  if (latestOrder) {
    liveStatus = await syncGelatoStatus({
      id: latestOrder.id,
      gelatoOrderId: latestOrder.gelatoOrderId,
      gelatoStatus: latestOrder.gelatoStatus,
    });
  }

  // 5. Build the order data for the client, preferring live data
  const orderData = latestOrder
    ? {
        id: latestOrder.id,
        gelatoOrderId: latestOrder.gelatoOrderId,
        status: liveStatus?.status || latestOrder.gelatoStatus || "submitted",
        trackingCode:
          liveStatus?.trackingCode || latestOrder.gelatoTrackingCode || null,
        trackingUrl:
          liveStatus?.trackingUrl || latestOrder.gelatoTrackingUrl || null,
        createdAt: latestOrder.createdAt?.toISOString() ?? null,
        // Order details for the details panel
        amount: latestOrder.amount,
        currency: latestOrder.currency,
        shippingAddress: latestOrder.shippingAddress as {
          firstName?: string;
          lastName?: string;
          addressLine1?: string;
          addressLine2?: string;
          city?: string;
          postCode?: string;
          countryIsoCode?: string;
          email?: string;
          phone?: string;
        } | null,
        minDeliveryDate: latestOrder.gelatoMinDeliveryDate ?? null,
        maxDeliveryDate: latestOrder.gelatoMaxDeliveryDate ?? null,
        paymentId: latestOrder.paymentId,
      }
    : null;

  return (
    <main className="min-h-screen bg-[#fafafa]">
      <CompletedBookView
        story={{
          id: story.id,
          title: story.title,
          coverSpreadUrl: story.coverSpreadUrl,
          pdfUrl: story.pdfUrl,
          readerId: story.readerId,
          worldId: story.worldId,
          bookNumber: story.bookNumber,
          length: story.length,
          createdAt: story.createdAt?.toISOString() ?? null,
        }}
        order={orderData}
      />
    </main>
  );
}