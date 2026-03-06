import { NextResponse } from "next/server";
import { db } from "@/db";
import { stories } from "@/db/schema";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { createGelatoOrder } from "print/gelato/createOrder";

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
      return NextResponse.json(
        { error: "Missing story id" },
        { status: 400 }
      );
    }

    if (!shippingAddress) {
      return NextResponse.json(
        { error: "Missing shipping address" },
        { status: 400 }
      );
    }

    /* ---- Load story ---- */
    const story = await db.query.stories.findFirst({
      where: eq(stories.id, storyId),
    });

    if (!story) {
      return NextResponse.json(
        { error: "Story not found" },
        { status: 404 }
      );
    }

    if (!story.pdfUrl) {
      return NextResponse.json(
        { error: "No PDF generated yet. Please try again." },
        { status: 400 }
      );
    }

    /* ---- Place order ---- */
    const result = await createGelatoOrder({
      orderReferenceId: `flipwhizz-${uuidv4()}`,
      customerReferenceId: story.userId ?? "unknown",
      pdfUrl: story.pdfUrl,
      shippingAddress: {
        firstName: shippingAddress.firstName,
        lastName: shippingAddress.lastName,
        addressLine1: shippingAddress.addressLine1,
        addressLine2: shippingAddress.addressLine2 || "",
        city: shippingAddress.city,
        postCode: shippingAddress.postCode,
        countryIsoCode: shippingAddress.countryIsoCode || "GB",
        email: shippingAddress.email,
        phone: shippingAddress.phone || "",
      },
    });

    /* ---- Persist order reference ---- */
    await db
      .update(stories)
      .set({
        gelatoOrderId: result.id,
        orderStatus: result.fulfillmentStatus ?? "created",
        orderedAt: new Date(),
      })
      .where(eq(stories.id, storyId));

    return NextResponse.json({
      success: true,
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