// src/app/stories/[id]/print/page.tsx

import { db } from "@/db";
import { stories, orders, storyProducts } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import PrintPage from "./PrintPage";

const POST_PAYMENT_STATUSES = new Set(["paid", "gifted", "failed"]);

export default async function PrintRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const story = await db.query.stories.findFirst({
    where: eq(stories.id, id),
  });

  if (!story) return notFound();

  // Must have completed checkout — includes failed Gelato orders (digital still valid)
  if (!POST_PAYMENT_STATUSES.has(story.paymentStatus ?? "")) {
    redirect(`/stories/${id}/studio`);
  }

  // Must have a cover
  if (!story.coverSpreadUrl) {
    redirect(`/stories/${id}/cover`);
  }

  // Fetch the most recent order (if any)
  const latestOrder = await db.query.orders.findFirst({
    where: eq(orders.storyId, id),
    orderBy: desc(orders.createdAt),
  });

  // Fetch the story product to know what they paid for
  const product = await db.query.storyProducts.findFirst({
    where: eq(storyProducts.storyId, id),
  });

  console.log("product ==>", product);

  return (
    <main className="min-h-screen" style={{ background: "#FDFBFF" }}>
      <PrintPage
        story={{
          id: story.id,
          projectId: story.projectId,
          title: story.title,
          coverSpreadUrl: story.coverSpreadUrl,
          pdfUrl: story.pdfUrl,
          status: story.status,
          paymentStatus: story.paymentStatus,
          completedSteps: (story.completedSteps as string[]) ?? [],
        }}
        order={
          latestOrder
            ? {
                id: latestOrder.id,
                status: latestOrder.status,
                gelatoOrderId: latestOrder.gelatoOrderId,
                gelatoStatus: latestOrder.gelatoStatus,
                gelatoTrackingCode: latestOrder.gelatoTrackingCode ?? null,
                gelatoTrackingUrl: latestOrder.gelatoTrackingUrl ?? null,
                gelatoMinDeliveryDate: latestOrder.gelatoMinDeliveryDate ?? null,
                gelatoMaxDeliveryDate: latestOrder.gelatoMaxDeliveryDate ?? null,
                createdAt: latestOrder.createdAt?.toISOString() ?? null,
              }
            : null
        }
        productType={product?.productType ?? "undecided"}
        initialShippingAddress={
          (product?.checkoutAddress as
            | {
                firstName: string;
                lastName: string;
                addressLine1: string;
                addressLine2: string;
                city: string;
                postCode: string;
                countryIsoCode: string;
                email: string;
                phone: string;
              }
            | null) ?? null
        }
      />
    </main>
  );
}