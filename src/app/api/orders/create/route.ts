// api/orders/create/route.ts
import { NextResponse } from "next/server";
import { db } from "@/db";
import { stories, orders } from "@/db/schema";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { createGelatoOrder } from "print/gelato/createOrder";
import { storyProducts } from "@/db/schema";
import { captureServerEvent } from "@/lib/posthog-server";


interface CreateOrderRequest {
  storyId: string;
  shippingAddress: {
    firstName: string;
    lastName: string;
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state?: string;
    postCode: string;
    countryIsoCode: string;
    email: string;
    phone?: string;
  };
  userId: string;
}

export async function POST(req: Request) {
  try {
    const body: CreateOrderRequest = await req.json();
    const { storyId, shippingAddress, userId } = body;

    if (!storyId || !shippingAddress || !userId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const story = await db.query.stories.findFirst({
      where: eq(stories.id, storyId),
    });

    if (!story) {
      return NextResponse.json(
        { error: "Story not found" },
        { status: 404 }
      );
    }

    const storyProduct = await db.query.storyProducts.findFirst({
      where: eq(storyProducts.storyId, storyId),
    });

    const productType = storyProduct?.productType || "print";

    if (productType === "digital") {
      return NextResponse.json(
        { error: "Digital orders do not require printing" },
        { status: 400 }
      );
    }

    const gelatoProductUid =
      productType === "gift"
        ? process.env.GELATO_PRODUCT_UID_HARDCOVER
        : process.env.GELATO_PRODUCT_UID_SOFTCOVER;

    if (!gelatoProductUid) {
      throw new Error("Missing Gelato product UID for " + productType);
    }

    const PRICES: Record<string, string> = {
      print: "29.00",
      gift: "39.00",
    };
    const orderAmount = PRICES[productType] || "29.00";

    const validationErrors: string[] = [];

    if (!story.pdfUrl) validationErrors.push("PDF has not been generated");
    if (story.paymentStatus !== "paid") validationErrors.push("Payment not confirmed");
    if (!story.coverSpreadUrl) validationErrors.push("Cover not generated");

    if (validationErrors.length > 0) {
      return NextResponse.json(
        { error: "Order not ready", missing: validationErrors },
        { status: 400 }
      );
    }

    const orderId = uuidv4();
    const orderReferenceId = `ORD-${orderId.slice(0, 8)}`;

    await db.insert(orders).values({
      id: orderId,
      storyId,
      userId,
      paymentId: story.paymentId ?? null,
      paymentStatus: "paid",
      amount: orderAmount,
      currency: "GBP",
      pdfUrl: story.pdfUrl!,
      shippingAddress: shippingAddress as any,
      status: "pending",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    try {
      const gelatoResponse = await createGelatoOrder({
        orderReferenceId,
        customerReferenceId: userId,
        pdfUrl: story.pdfUrl!,
        shippingAddress,
        productUid: gelatoProductUid,
        pageCount: story.length ?? 28,  // ← ADD THIS
      });

      await db
        .update(orders)
        .set({
          gelatoOrderId: gelatoResponse.id,
          gelatoStatus: "submitted",
          status: "submitted",
          submittedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(orders.id, orderId));

      await db
        .update(stories)
        .set({
          orderStatus: "order_submitted",
          updatedAt: new Date(),
        })
        .where(eq(stories.id, storyId));

      await captureServerEvent(userId, "print_order_submitted", {
        order_id: orderId,
        story_id: storyId,
        gelato_order_id: gelatoResponse.id,
        product_type: productType,
        amount: parseFloat(orderAmount),
        currency: "GBP",
        shipping_country: shippingAddress.countryIsoCode,
      });

      return NextResponse.json({
        success: true,
        orderId,
        gelatoOrderId: gelatoResponse.id,
        message: "Order submitted to Gelato successfully",
      });
    } catch (gelatoError) {
      await db
        .update(orders)
        .set({ status: "failed", updatedAt: new Date() })
        .where(eq(orders.id, orderId));

      throw gelatoError;
    }
  } catch (error) {
    console.error("❌ Failed to create order:", error);
    return NextResponse.json(
      {
        error: "Failed to create order",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}