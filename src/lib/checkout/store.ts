// src/lib/checkout/store.ts
import type { db } from "../../db";
import { and, eq, inArray, sql } from "drizzle-orm";
import { stories, storyProducts, promoCodes } from "../../db/schema";
import { checkoutPayments } from "../../db/schema";
import { computeCheckoutCents, getPromoUnusableReason, type ProductType, type CurrencyCode } from "../pricing";
import { colouringPurchaseError } from "../lulu/client";

export class CheckoutError extends Error {}
type Payment = typeof checkoutPayments.$inferSelect;
type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export function paymentReference(id: string, promoCode: string | null): string {
  return promoCode ? `promo:${promoCode}:${id}` : id;
}
export function promoFromPaymentId(id: string | null | undefined): string | null {
  return id?.startsWith("promo:") ? id.split(":")[1] || null : null;
}

/** Injecting the database lets the same transactions run against an isolated test DB. */
export function createCheckoutStore(database: typeof db) {
  async function consumePromo(tx: Transaction, promoId: string, userId: string) {
    // Every redemption locks the same promo row before checking or incrementing.
    const [promo] = await tx.select().from(promoCodes).where(eq(promoCodes.id, promoId)).for("update");
    const reason = promo ? getPromoUnusableReason(promo) : "Code not recognised.";
    if (reason) throw new CheckoutError(reason);
    if (promo.maxUsesPerUser !== null) {
      const [usage] = await tx.select({ count: sql<number>`count(*)::int` }).from(checkoutPayments)
        .where(and(eq(checkoutPayments.promoId, promo.id), eq(checkoutPayments.userId, userId), inArray(checkoutPayments.status, ["reserved", "paid"])));
      if (usage.count >= promo.maxUsesPerUser) throw new CheckoutError("You have already used this code the maximum number of times.");
    }
    await tx.update(promoCodes).set({ currentUses: sql`${promoCodes.currentUses} + 1`, updatedAt: new Date() }).where(eq(promoCodes.id, promo.id));
    return promo;
  }

  async function reserve(id: string, userId: string): Promise<Payment> {
    return database.transaction(async tx => {
      const [payment] = await tx.select().from(checkoutPayments).where(eq(checkoutPayments.id, id)).for("update");
      if (!payment || payment.userId !== userId) throw new CheckoutError("Please refresh checkout and try your payment again.");
      if (payment.status === "paid" || payment.status === "reserved") return payment;
      if (payment.status !== "created") throw new CheckoutError("This payment was cancelled. Please start checkout again.");
      if (payment.promoId) await consumePromo(tx, payment.promoId, userId);
      const [reserved] = await tx.update(checkoutPayments).set({ status: "reserved", updatedAt: new Date() }).where(eq(checkoutPayments.id, id)).returning();
      return reserved;
    });
  }

  async function complete(id: string, userId: string, checkoutAddress: unknown): Promise<Payment> {
    return database.transaction(async tx => {
      const [payment] = await tx.select().from(checkoutPayments).where(eq(checkoutPayments.id, id)).for("update");
      if (!payment || payment.userId !== userId) throw new CheckoutError("Payment not found.");
      if (payment.status === "paid") return payment;
      if (payment.status !== "reserved") throw new CheckoutError("Payment has not been reserved.");
      await tx.update(stories).set({
        paymentStatus: "paid", paymentId: paymentReference(id, payment.promoCode),
        ...(!payment.isUpgrade ? { status: "generating" } : {}), updatedAt: new Date(),
      }).where(eq(stories.id, payment.storyId));
      await tx.update(storyProducts).set({ checkoutAddress, productType: payment.productType, currency: payment.currency, updatedAt: new Date() }).where(eq(storyProducts.storyId, payment.storyId));
      const [paid] = await tx.update(checkoutPayments).set({ status: "paid", paidAt: new Date(), updatedAt: new Date() }).where(eq(checkoutPayments.id, id)).returning();
      return paid;
    });
  }

  // Only call after PayPal confirms VOIDED. Network failures are ambiguous:
  // retain the reservation so a retry cannot overspend the final promo use.
  async function cancelVoided(id: string, userId: string) {
    await database.transaction(async tx => {
      const [p] = await tx.select().from(checkoutPayments).where(eq(checkoutPayments.id, id)).for("update");
      if (!p || p.userId !== userId || p.status === "paid" || p.status === "cancelled") return;
      if (p.status === "reserved" && p.promoId) await tx.update(promoCodes)
        .set({ currentUses: sql`greatest(0, ${promoCodes.currentUses} - 1)`, updatedAt: new Date() }).where(eq(promoCodes.id, p.promoId));
      await tx.update(checkoutPayments).set({ status: "cancelled", updatedAt: new Date() }).where(eq(checkoutPayments.id, id));
    });
  }

  async function claimFree(storyId: string, userId: string, code: string, isAdmin = false) {
    return database.transaction(async tx => {
      const [story] = await tx.select().from(stories).where(eq(stories.id, storyId)).for("update");
      if (!story) throw new CheckoutError("Story not found.");
      const id = `free:${storyId}`;
      if (story.paymentStatus === "paid") {
        const [existing] = await tx.select().from(checkoutPayments).where(eq(checkoutPayments.id, id));
        return { alreadyPaid: true, payment: existing ?? null };
      }
      const [product] = await tx.select().from(storyProducts).where(eq(storyProducts.storyId, storyId));
      if (!product || !["digital", "print", "gift"].includes(product.productType ?? "")) throw new CheckoutError("Choose a product before checkout.");
      const unavailable = colouringPurchaseError(story.bookType, product.productType!, isAdmin);
      if (unavailable) throw new CheckoutError(unavailable);
      const [found] = await tx.select().from(promoCodes).where(sql`lower(${promoCodes.code}) = lower(${code.trim()})`).limit(1);
      if (!found) throw new CheckoutError("Code not recognised.");
      const promo = await consumePromo(tx, found.id, userId);
      const currency = (product.currency ?? "GBP") as CurrencyCode;
      if (computeCheckoutCents(product.productType as ProductType, currency, { promo, bookType: story.bookType }) !== 0) throw new CheckoutError("This promo code does not make this product free.");
      const [payment] = await tx.insert(checkoutPayments).values({
        id, storyId, userId, productType: product.productType!, bookType: story.bookType,
        currency, amountCents: 0, promoId: promo.id, promoCode: promo.code,
        status: "paid", paidAt: new Date(),
      }).returning();
      await tx.update(stories).set({ paymentStatus: "paid", paymentId: paymentReference(id, promo.code), status: "generating", updatedAt: new Date() }).where(eq(stories.id, storyId));
      return { alreadyPaid: false, payment };
    });
  }
  return { reserve, complete, cancelVoided, claimFree };
}
