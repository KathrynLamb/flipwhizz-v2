// app/stories/[id]/book/page.tsx

import CompletedBookView from "@/app/stories/[id]/book/Completedbookview";
import { db } from "@/db";
import { stories, orders, storySpreads, storyPages, readers } from "@/db/schema";
import { eq, desc, asc, inArray } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

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
      console.error(`[book/page] Gelato status check failed: ${res.status}`);
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

    const statusMap: Record<string, string> = {
      created:      "confirmed",
      passed:       "confirmed",
      in_production: "printing",
      printed:      "printing",
      packed:       "printing",
      shipped:      "shipped",
      in_transit:   "shipped",
      delivered:    "delivered",
      canceled:     "canceled",
      failed:       "failed",
    };

    const mappedStatus = statusMap[gelatoFulfillmentStatus] || gelatoFulfillmentStatus;

    let trackingCode: string | null = null;
    let trackingUrl: string | null = null;
    let minDeliveryDate: string | null = null;
    let maxDeliveryDate: string | null = null;

    const packages = data.shipment?.packages;
    if (packages?.length) {
      trackingCode = packages[0].trackingCode || null;
      trackingUrl = packages[0].trackingUrl || null;
    }

    minDeliveryDate = data.shipment?.minDeliveryDate || null;
    maxDeliveryDate = data.shipment?.maxDeliveryDate || null;

    if (mappedStatus !== order.gelatoStatus) {
      console.log(`[book/page] Gelato status drift: DB=${order.gelatoStatus} → API=${mappedStatus}`);

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

    return { status: mappedStatus, trackingCode, trackingUrl, minDeliveryDate, maxDeliveryDate };
  } catch (err: any) {
    if (err?.name !== "AbortError") {
      console.error("[book/page] Gelato sync error:", err);
    }
    return null;
  }
}

// ─── Helper: is book locked? ───
function isBookLocked(story: { paymentStatus: string | null; pdfUrl: string | null }) {
  return story.paymentStatus === "paid";
}

// ─── Page ───
export default async function BookPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // 1. Session — for userEmail
  const session = await getServerSession(authOptions);

  const userEmail = session?.user?.email ?? "";

  // 2. Fetch story
  const story = await db.query.stories.findFirst({
    where: eq(stories.id, id),
  });

  if (!story) return notFound();

  // 3. If not locked, redirect back to studio
  if (!isBookLocked(story)) {
    redirect(`/stories/${id}/studio`);
  }

  // 4. Get child name from readers table via story.readerId
  let childName = "your child";
  if (story.readerId) {
    const reader = await db.query.readers.findFirst({
      where: eq(readers.id, story.readerId),
      columns: { name: true },
    });
    if (reader?.name) childName = reader.name;
  }

  // 5. Fetch latest order for this story
  const latestOrder = await db.query.orders.findFirst({
    where: eq(orders.storyId, id),
    orderBy: desc(orders.createdAt),
  });

  console.log("[book/page] 📋 Selected order:", {
    id: latestOrder?.id,
    gelatoOrderId: latestOrder?.gelatoOrderId,
    gelatoStatus: latestOrder?.gelatoStatus,
    createdAt: latestOrder?.createdAt,
  });

  // 6. Fetch spreads + page image URLs
  const spreads = await db
    .select()
    .from(storySpreads)
    .where(eq(storySpreads.storyId, id))
    .orderBy(asc(storySpreads.spreadIndex));

  const pageIds = spreads.flatMap((s) =>
    [s.leftPageId, s.rightPageId].filter(Boolean) as string[]
  );

  const pages = pageIds.length > 0
    ? await db
        .select({ id: storyPages.id, imageUrl: storyPages.imageUrl })
        .from(storyPages)
        .where(inArray(storyPages.id, pageIds))
    : [];

  const pageImageMap = Object.fromEntries(pages.map((p) => [p.id, p.imageUrl]));

  const spreadImageUrls = spreads
    .map((s) => pageImageMap[s.leftPageId ?? ""] ?? pageImageMap[s.rightPageId ?? ""] ?? null)
    .filter(Boolean) as string[];

  // 7. Sync Gelato status — 3s timeout, skip cancelled/failed orders
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

  // 8. Build order data for client, preferring live data
  const orderData = latestOrder
    ? {
        id: latestOrder.id,
        gelatoOrderId: latestOrder.gelatoOrderId,
        status: liveStatus?.status || latestOrder.gelatoStatus || "submitted",
        trackingCode: liveStatus?.trackingCode || latestOrder.gelatoTrackingCode || null,
        trackingUrl: liveStatus?.trackingUrl || latestOrder.gelatoTrackingUrl || null,
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
        minDeliveryDate: liveStatus?.minDeliveryDate ?? latestOrder.gelatoMinDeliveryDate ?? null,
        maxDeliveryDate: liveStatus?.maxDeliveryDate ?? latestOrder.gelatoMaxDeliveryDate ?? null,
        paymentId: latestOrder.paymentId,
      }
    : null;

  return (
    <main className="min-h-screen bg-[#fafafa]">
      <CompletedBookView
        story={{
          id: story.id,
          title: story.title,
          childName,                                          // ← from readers table
          coverSpreadUrl: story.coverSpreadUrl,
          pdfUrl: story.pdfUrl,
          readerId: story.readerId,
          worldId: story.worldId,
          bookNumber: story.bookNumber,
          length: story.length,
          createdAt: story.createdAt?.toISOString() ?? null,
          spreadImageUrls,
          homePrintPdfUrl: story.homePrintPdfUrl,
        }}
        order={orderData}
        userEmail={userEmail}                                 // ← from session
      />
    </main>
  );
}