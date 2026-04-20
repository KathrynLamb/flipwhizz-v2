// app/stories/[id]/book/page.tsx

import CompletedBookView from "@/app/stories/[id]/book/Completedbookview";
import { db } from "@/db";
import { stories, orders, storySpreads, storyPages } from "@/db/schema";
import { eq, desc, asc, inArray } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";




// ─── Gelato status sync on page load ───
async function syncGelatoStatus(
  order: {
    id: string;
    gelatoOrderId: string | null;
    gelatoStatus: string | null;
  },
  signal?: AbortSignal
) {
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
        signal,
        next: { revalidate: 0 },
      }
    );

    if (!res.ok) {
      console.error(
        `[book/page] Gelato status check failed: ${res.status}`
      );
      return null;
    }

    const data = await res.json();
    console.log("[book/page] 📦 Gelato API response:", {
      orderId: order.gelatoOrderId,
      fulfillmentStatus: data.fulfillmentStatus,
      orderStatus: data.orderStatus,
      items: data.items?.length,
      firstItemStatus: data.items?.[0]?.fulfillmentStatus,
      trackingCode: data.items?.[0]?.fulfillments?.[0]?.trackingCode,
    });
    const gelatoFulfillmentStatus: string = data.fulfillmentStatus;

    console.log("[book/page] 📦 Gelato full shipment data:", JSON.stringify({
    // console.log("[book/page] 📦 Gelato full shipment data:", JSON.stringify({
      shipments: data
    }, null, 2));

    const statusMap: Record<string, string> = {
      created: "confirmed",
      passed: "confirmed",
      in_production: "printing",
      printed: "printing",
      packed: "printing",
      shipped: "shipped",
      in_transit: "shipped",  // ← add this
      delivered: "delivered",
      canceled: "canceled",
      failed: "failed",
    };

    const mappedStatus =
      statusMap[gelatoFulfillmentStatus] || gelatoFulfillmentStatus;
      let trackingCode: string | null = null;
      let trackingUrl: string | null = null;
      let minDeliveryDate: string | null = null;
      let maxDeliveryDate: string | null = null;
      
      // Gelato v4: tracking is under data.shipment.packages[]
      const packages = data.shipment?.packages;
      if (packages?.length) {
        trackingCode = packages[0].trackingCode || null;
        trackingUrl = packages[0].trackingUrl || null;
      }
      
      // Delivery dates are on the shipment object
      minDeliveryDate = data.shipment?.minDeliveryDate || null;
      maxDeliveryDate = data.shipment?.maxDeliveryDate || null;

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
        ...(minDeliveryDate && { gelatoMinDeliveryDate: minDeliveryDate }),
        ...(maxDeliveryDate && { gelatoMaxDeliveryDate: maxDeliveryDate }),
        gelatoUpdatedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(orders.id, order.id));
    }

    return {
      status: mappedStatus,
      trackingCode,
      trackingUrl,
      minDeliveryDate,
      maxDeliveryDate,
    };
  } catch (err: any) {
    if (err?.name !== "AbortError") {
      console.error("[book/page] Gelato sync error:", err);
    }
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

  // After the latestOrder query
console.log("[book/page] 📋 Selected order:", {
  id: latestOrder?.id,
  gelatoOrderId: latestOrder?.gelatoOrderId,
  gelatoStatus: latestOrder?.gelatoStatus,
  createdAt: latestOrder?.createdAt,
});

// After fetching latestOrder, add:
// const spreads = await db.query.storySpreads.findMany({
//   where: eq(storySpreads.storyId, id),
//   orderBy: asc(storySpreads.spreadIndex),
// });




const spreads = await db
  .select()
  .from(storySpreads)
  .where(eq(storySpreads.storyId, id))
  .orderBy(asc(storySpreads.spreadIndex));



// Collect all page IDs
const pageIds = spreads.flatMap(s => 
  [s.leftPageId, s.rightPageId].filter(Boolean) as string[]
);

// Fetch image URLs for those pages
const pages = pageIds.length > 0
  ? await db
      .select({ id: storyPages.id, imageUrl: storyPages.imageUrl })
      .from(storyPages)
      .where(inArray(storyPages.id, pageIds))
  : [];

const pageImageMap = Object.fromEntries(pages.map(p => [p.id, p.imageUrl]));

// One URL per spread (prefer left page, fall back to right)
const spreadImageUrls = spreads
  .map(s => pageImageMap[s.leftPageId ?? ""] ?? pageImageMap[s.rightPageId ?? ""] ?? null)
  .filter(Boolean) as string[];
// Get page image URLs — you'll need to query storyPages
// const spreadImageUrls = spreads
//   .map(s => /* left or right page imageUrl */)
//   .filter(Boolean);

  // 4. Sync Gelato status — 3s timeout, skip cancelled/failed orders
  let liveStatus = null;
  if (
    latestOrder?.gelatoOrderId &&
    !["canceled", "failed"].includes(latestOrder.gelatoStatus ?? "")
  ) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);

      liveStatus = await syncGelatoStatus(
        {
          id: latestOrder.id,
          gelatoOrderId: latestOrder.gelatoOrderId,
          gelatoStatus: latestOrder.gelatoStatus,
        },
        controller.signal
      );

      clearTimeout(timeout);
    } catch {
      console.log("[book/page] Gelato sync skipped (timeout or error)");
    }
  }

  // 5. Build the order data for the client, preferring live data
  const orderData = latestOrder
    ? {
        id: latestOrder.id,
        gelatoOrderId: latestOrder.gelatoOrderId,
        status:
          liveStatus?.status || latestOrder.gelatoStatus || "submitted",
        trackingCode:
          liveStatus?.trackingCode ||
          latestOrder.gelatoTrackingCode ||
          null,
        trackingUrl:
          liveStatus?.trackingUrl ||
          latestOrder.gelatoTrackingUrl ||
          null,
        createdAt: latestOrder.createdAt?.toISOString() ?? null,
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
          spreadImageUrls,
        }}
        order={orderData}
      />
    </main>
  );
}