// app/stories/[id]/order/page.tsx

import { db } from "@/db";
import { stories, orders, reviews, storyProducts, promoCodes, projects } from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import OrderPage from "./OrderPage";

export default async function OrderRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const story = await db.query.stories.findFirst({
    where: eq(stories.id, id),
  });

  if (!story) return notFound();

  // Must have paid to reach this page
  if (story.paymentStatus !== "paid") {
    redirect(`/stories/${id}/studio`);
  }

  // Fetch product info for pricing
  const product = await db.query.storyProducts.findFirst({
    where: eq(storyProducts.storyId, id),
  });

  // Fetch previous orders to show order history
  const previousOrders = await db
    .select({
      id: orders.id,
      createdAt: orders.createdAt,
      gelatoStatus: orders.gelatoStatus,
      shippingAddress: orders.shippingAddress,
    })
    .from(orders)
    .where(eq(orders.storyId, id))
    .orderBy(desc(orders.createdAt));

  // Check if user has reviewed (for discount nudge)
  // Wrapped in try/catch in case reviews table doesn't exist yet
  let review: any = null;
  try {
    const project = await db.query.projects.findFirst({
      where: eq(projects.id, story.projectId),
      columns: { userId: true },
    });

    review = project?.userId
      ? await db.query.reviews.findFirst({
          where: and(
            eq(reviews.storyId, id),
            eq(reviews.userId, project.userId)
          ),
        })
      : null;
  } catch (err) {
    console.warn("[order/page] Reviews query failed (table may not exist):", err);
  }

  // If they have a review promo code, fetch it
  let reviewPromoCode: string | null = null;
  let reviewPromoDiscount: number | null = null;

  if (review?.promoCodeId) {
    const promo = await db.query.promoCodes.findFirst({
      where: eq(promoCodes.id, review.promoCodeId),
    });
    if (promo && promo.active && promo.currentUses < (promo.maxUses ?? Infinity)) {
      reviewPromoCode = promo.code;
      reviewPromoDiscount = promo.discountPercent ?? 15;
    }
  }

  // Pricing
  const productType = product?.productType || "print";
  const basePrice = productType === "gift" ? 3900 : 2900; // pence

  return (
    <OrderPage
      story={{
        id: story.id,
        title: story.title,
        coverSpreadUrl: story.coverSpreadUrl,
        pdfUrl: story.pdfUrl,
      }}
      pricing={{
        basePrice,
        currency: "GBP",
        productType,
      }}
      hasReview={!!review}
      reviewPromoCode={reviewPromoCode}
      reviewPromoDiscount={reviewPromoDiscount}
      previousOrderCount={previousOrders.length}
      lastShippingAddress={
        previousOrders.length > 0
          ? (previousOrders[0].shippingAddress as any)
          : null
      }
    />
  );
}