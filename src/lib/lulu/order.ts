import { getAuthUser } from "@/lib/authz";
import { readProofQuote, requireProofConfiguration } from "./proof";
import { randomUUID } from "node:crypto";
import { and, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { orders, stories, storyProducts, projects } from "@/db/schema";
import { buildColouringFiles } from "./export";
import { colouringPurchaseError, luluClient } from "./client";

import { luluShippingAddress, luluJobPayload, type ShippingAddress } from "./contract";

export async function submitColouringOrder(storyId: string, address: ShippingAddress, proofToken?: string) {
  let proof: ReturnType<typeof readProofQuote> | undefined;
  if (proofToken) {
    const user = await getAuthUser();
    if (!user?.isAdmin) throw new Error("Admin access required for a proof order");
    requireProofConfiguration();
    proof = readProofQuote(proofToken, user.id);
    if (proof.storyId !== storyId) throw new Error("Proof quote does not match this book");
    address = proof.address;
  }
  const shipping = luluShippingAddress(address);
  // Lock the story to make double-clicks / concurrent requests reuse one local order.
  const reservation = await db.transaction(async tx => {
    const [story] = await tx.select().from(stories).where(eq(stories.id, storyId)).for("update");
    if (!story || story.bookType !== "colouring_storybook") throw new Error("Colouring storybook not found");
    if (story.paymentStatus !== "paid" || !story.paymentId) throw new Error("Payment must be confirmed before printing");
    const product = await tx.query.storyProducts.findFirst({ where: eq(storyProducts.storyId, storyId) });
    if (product?.productType !== "print") throw new Error("Choose the paperback product before ordering");
    const unavailable = colouringPurchaseError(story.bookType, product.productType);
    if (unavailable && !proof) throw new Error(unavailable);
    const existing = await tx.query.orders.findFirst({ where: and(eq(orders.storyId, storyId), eq(orders.printProvider, "lulu"), ne(orders.status, "failed"), eq(orders.paymentId, story.paymentId)) });
    if (existing) return { reused: true as const, order: existing, story };
    const project = await tx.query.projects.findFirst({ where: eq(projects.id, story.projectId) });
    if (!project?.userId) throw new Error("Book owner not found");
    const [order] = await tx.insert(orders).values({ id: randomUUID(), storyId, userId: project.userId, paymentId: story.paymentId, paymentStatus: "paid", amount: String((product.estimatedPrice ?? 0) / 100), currency: product.currency ?? "GBP", shippingAddress: address, storyProductId: product.id, printProvider: "lulu", status: "preparing" }).returning();
    return { reused: false as const, order, story };
  });
  if (reservation.reused) return { success: true, orderId: reservation.order.id, status: reservation.order.status, provider: "lulu", reused: true };
  let submitting = false;
  try {
    // Proof orders use the exact PDFs reviewed in the signed quote; customer orders rebuild current artwork.
    const files = proof?.files ?? await buildColouringFiles(storyId, true);
    if (proof) {
      const cost = await luluClient().request<{ total_cost_incl_tax: string; currency: string }>("/print-job-cost-calculations/", {
        line_items: [{ page_count: files.pageCount, pod_package_id: files.podPackageId, quantity: 1 }],
        shipping_address: shipping, shipping_option: proof.shippingLevel,
      });
      if (cost.currency !== proof.currency || !Number.isFinite(Number(cost.total_cost_incl_tax)) || Number(cost.total_cost_incl_tax) <= 0 || Number(cost.total_cost_incl_tax) > Number(proof.total)) throw new Error("Lulu's price changed. Get a fresh proof quote before ordering.");
    }
    const payload = luluJobPayload({ orderId: reservation.order.id, title: reservation.story.title, podPackageId: files.podPackageId!, coverUrl: files.coverUrl!, interiorUrl: files.interiorUrl, shipping, contactEmail: process.env.LULU_CONTACT_EMAIL!, shippingLevel: proof?.shippingLevel ?? process.env.LULU_SHIPPING_LEVEL! });
    submitting = true;
    const job = await luluClient().request<{ id: number; status: { name: string } }>("/print-jobs/", payload);
    if (!job.id) throw new Error("Lulu returned no job ID");
    await db.update(orders).set({ providerOrderId: String(job.id), providerStatus: job.status?.name ?? "CREATED", pdfUrl: files.interiorUrl, status: "submitted", submittedAt: new Date(), updatedAt: new Date() }).where(eq(orders.id, reservation.order.id));
    await db.update(stories).set({ orderStatus: "order_submitted", updatedAt: new Date() }).where(eq(stories.id, storyId));
    return { success: true, orderId: reservation.order.id, provider: "lulu", status: "submitted" };
  } catch (e) {
    // A request may have reached Lulu even if its response was lost. Hold for reconciliation.
    await db.update(orders).set({ status: submitting ? "pending_manual" : "failed", updatedAt: new Date() }).where(eq(orders.id, reservation.order.id));
    throw e;
  }
}
