// api/orders/create/route.ts - Create and submit order
import { NextResponse } from "next/server";
import { db } from "@/db";
import { stories, orders } from "@/db/schema";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { createGelatoOrder } from "print/gelato/createOrder";

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

    // Validate input
    if (!storyId || !shippingAddress || !userId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // 1. Fetch and validate story
    const story = await db.query.stories.findFirst({
      where: eq(stories.id, storyId),
    });

    if (!story) {
      return NextResponse.json({ error: "Story not found" }, { status: 404 });
    }

    // 2. CHECK ALL REQUIREMENTS
    const validationErrors: string[] = [];

    if (!story.pdfUrl) {
      validationErrors.push("PDF has not been generated");
    }

    if (story.paymentStatus !== "paid") {
      validationErrors.push("Payment not confirmed");
    }

    if (!story.frontCoverUrl || !story.backCoverUrl) {
      validationErrors.push("Covers not generated");
    }

    if (validationErrors.length > 0) {
      return NextResponse.json(
        {
          error: "Order not ready",
          missing: validationErrors,
        },
        { status: 400 }
      );
    }

    const pdfUrl = story.pdfUrl as string;

    // 3. Create order record
    const orderId = uuidv4();
    const orderReferenceId = `ORD-${orderId.substring(0, 8)}`;

    await db.insert(orders).values({
      id: orderId,
      storyId,
      userId,
      paymentId: story.paymentId || null,
      paymentStatus: "paid",
      amount: "29.99", // Your price
      currency: "USD",
      pdfUrl,
      shippingAddress: shippingAddress as any,
      status: "pending",
    });

    // 4. Submit to Gelato
    try {
      const gelatoResponse = await createGelatoOrder({
        orderReferenceId,
        customerReferenceId: userId,
        pdfUrl,
        shippingAddress,
      });

      // 5. Update order with Gelato ID
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

      // 6. Update story status
      await db
        .update(stories)
        .set({
          orderStatus: "order_submitted",
          updatedAt: new Date(),
        })
        .where(eq(stories.id, storyId));

      console.log("✅ Gelato Order Created:", gelatoResponse);

      return NextResponse.json({
        success: true,
        orderId,
        gelatoOrderId: gelatoResponse.id,
        message: "Order submitted to Gelato successfully",
      });
    } catch (gelatoError) {
      // Mark order as failed
      await db
        .update(orders)
        .set({
          status: "failed",
          updatedAt: new Date(),
        })
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