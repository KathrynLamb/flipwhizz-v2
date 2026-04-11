import { NextResponse } from "next/server";
import { db } from "@/db";
import { stories, storyProducts, orders } from "@/db/schema";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { createGelatoOrder } from "print/gelato/createOrder";
import { getPrintSpec } from "@/lib/printSpecs";
import { sendOrderConfirmation } from "@/lib/emails/sendOrderConfirmation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: storyId } = await params;
    const { shippingAddress } = await req.json();

    if (!storyId) {
      return NextResponse.json({ error: "Missing story id" }, { status: 400 });
    }

    if (!shippingAddress) {
      return NextResponse.json(
        { error: "Missing shipping address" },
        { status: 400 }
      );
    }

    /* --------------------------------------------------
       1. Load story
    -------------------------------------------------- */

    const story = await db.query.stories.findFirst({
      where: eq(stories.id, storyId),
    });

    if (!story) {
      return NextResponse.json({ error: "Story not found" }, { status: 404 });
    }

    if (!story.pdfUrl) {
      return NextResponse.json(
        { error: "No PDF generated yet. Please try again." },
        { status: 400 }
      );
    }

    /* --------------------------------------------------
       2. Resolve product type
    -------------------------------------------------- */

    const [storyProduct] = await db
      .select()
      .from(storyProducts)
      .where(eq(storyProducts.storyId, storyId))
      .limit(1);

    const printSpec = getPrintSpec(storyProduct?.productType);

    if (!printSpec.gelatoProductUid) {
      return NextResponse.json(
        { error: "Missing Gelato product UID configuration" },
        { status: 500 }
      );
    }

    /* --------------------------------------------------
       3. Create local order record
    -------------------------------------------------- */

    const orderId = uuidv4();

    await db.insert(orders).values({
      id: orderId,
      storyId,
      userId: story.userId ?? "unknown",
      paymentId: story.paymentId,
      paymentStatus: story.paymentStatus ?? "pending",
      amount: String(storyProduct?.estimatedPrice ?? 0),
      currency: storyProduct?.currency ?? "GBP",
      pdfUrl: story.pdfUrl,
      shippingAddress: shippingAddress,
      storyProductId: storyProduct?.id,
      status: "submitted",
      submittedAt: new Date(),
    });

    /* --------------------------------------------------
       4. Create Gelato order
    -------------------------------------------------- */

    const result = await createGelatoOrder({
      orderReferenceId: orderId,
      customerReferenceId: story.userId ?? "unknown",
      pdfUrl: story.pdfUrl,
      productUid: printSpec.gelatoProductUid,
      pageCount: printSpec.totalProductPageCount,
      shippingAddress: {
        firstName: shippingAddress.firstName,
        lastName: shippingAddress.lastName,
        addressLine1: shippingAddress.addressLine1,
        addressLine2: shippingAddress.addressLine2 || "",
        city: shippingAddress.city,
        state: shippingAddress.state || "",
        postCode: shippingAddress.postCode,
        countryIsoCode: shippingAddress.countryIsoCode || "GB",
        email: shippingAddress.email,
        phone: shippingAddress.phone || "",
      },
    });

    /* --------------------------------------------------
       5. Update order with Gelato response
    -------------------------------------------------- */

    await db
      .update(orders)
      .set({
        gelatoOrderId: result.id,
        gelatoStatus: result.fulfillmentStatus ?? "created",
        updatedAt: new Date(),
      })
      .where(eq(orders.id, orderId));

    // Also update story orderStatus for the UI tracker
    await db
      .update(stories)
      .set({
        orderStatus: "submitted",
        updatedAt: new Date(),
      })
      .where(eq(stories.id, storyId));

    /* --------------------------------------------------
       6. Send confirmation email (non-blocking)
    -------------------------------------------------- */

    if (shippingAddress.email) {
      sendOrderConfirmation({
        to: shippingAddress.email,
        childName: story.title ?? "your child",
        storyTitle: story.title ?? "Your FlipWhizz Story",
        productType: printSpec.productType,
        gelatoOrderId: result.id,
        shippingAddress: {
          firstName: shippingAddress.firstName,
          lastName: shippingAddress.lastName,
          addressLine1: shippingAddress.addressLine1,
          addressLine2: shippingAddress.addressLine2 || "",
          city: shippingAddress.city,
          postCode: shippingAddress.postCode,
          countryIsoCode: shippingAddress.countryIsoCode || "GB",
        },
      }).catch((err) => {
        console.error("❌ Order confirmation email failed:", err);
      });
    }

    return NextResponse.json({
      success: true,
      orderId,
      gelatoOrderId: result.id,
      status: result.fulfillmentStatus,
    });
  } catch (err) {
    console.error("❌ Order failed:", err);

    return NextResponse.json(
      {
        error: "Failed to place order",
        details: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}