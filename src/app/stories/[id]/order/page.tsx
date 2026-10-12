import Link from "next/link";
import { luluPrintEnabled } from "@/lib/lulu/client";
import { db } from "@/db";
import { stories, orders, reviews, storyProducts, promoCodes, projects } from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getPriceCents, resolvePromoDiscount } from "@/lib/pricing";
import OrderPage from "./OrderPage";
import { requireStoryOwnerPage, requireAdminPage } from "@/lib/pageGuards";

export default async function OrderRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // Check access BEFORE loading data: the layout's redirect doesn't stop
  // this page rendering in parallel. See src/lib/pageGuards.ts
  await requireStoryOwnerPage(id);
  const session = await getServerSession(authOptions);

  const story = await db.query.stories.findFirst({
    where: eq(stories.id, id),
  });

  if (!story) return notFound();
  if (story.paymentStatus !== "paid") redirect(`/stories/${id}/studio`);

  if (story.bookType === "colouring_storybook" && !luluPrintEnabled()) {
    return <main className="mx-auto max-w-xl p-8"><h1 className="text-2xl font-bold">Your colouring storybook</h1><p className="my-4">Printed colouring storybooks are not available yet. You can download your book and print it at home.</p><Link href={`/stories/${id}/book`} className="text-purple-700 underline">Back to your book</Link></main>;
  }

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, story.projectId!),
    columns: { userId: true },
  });

  const userId = session?.user?.id ?? project?.userId;

  // Previous print orders for this story (to check if already ordered)
  const previousOrders = await db
    .select({
      id: orders.id,
      createdAt: orders.createdAt,
      gelatoStatus: orders.gelatoStatus,
      printProvider: orders.printProvider,
      status: orders.status,
      shippingAddress: orders.shippingAddress,
      promoCode: orders.promoCode,
    })
    .from(orders)
    .where(eq(orders.storyId, id))
    .orderBy(desc(orders.createdAt));

  const hasPrintOrder = previousOrders.some(
    (o) => o.printProvider === "lulu" ? !["failed", "cancelled"].includes(o.status) : o.gelatoStatus && o.gelatoStatus !== "cancelled"
  );

  // Check if user has a used BETAREAD-style promo (digitalOverride = 0, discountPercent > 0)
  // by looking at the story's paymentId
  let autoPromoCode: string | null = null;
  let autoPromoDiscount: number | null = null;

  if (!hasPrintOrder && userId) {
    // Find the promo used for the digital claim
    const usedPromoCode = story.paymentId?.startsWith("promo:")
      ? story.paymentId.replace("promo:", "")
      : null;

    if (usedPromoCode) {
      const promo = await db.query.promoCodes.findFirst({
        where: eq(promoCodes.code, usedPromoCode),
      });

      if (promo && promo.active && promo.discountPercent && promo.discountPercent > 0) {
        // This promo has a print discount — auto-apply it
        autoPromoCode = promo.code;
        autoPromoDiscount = promo.discountPercent;
      }
    }
  }

  // Review promo
  let review: any = null;
  try {
    review = userId
      ? await db.query.reviews.findFirst({
          where: and(eq(reviews.storyId, id), eq(reviews.userId, userId)),
        })
      : null;
  } catch (err) {
    console.warn("[order/page] Reviews query failed:", err);
  }

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

  return (
    <OrderPage
      story={{
        id: story.id,
        title: story.title,
        coverSpreadUrl: story.coverSpreadUrl,
        pdfUrl: story.pdfUrl,
      }}
      hasReview={!!review}
      reviewPromoCode={reviewPromoCode}
      reviewPromoDiscount={reviewPromoDiscount}
      autoPromoCode={autoPromoCode}
      autoPromoDiscount={autoPromoDiscount}
      hasPrintOrder={hasPrintOrder}
      previousOrderCount={previousOrders.length}
      lastShippingAddress={
        previousOrders.length > 0
          ? (previousOrders[0].shippingAddress as any)
          : null
      }
    />
  );
}