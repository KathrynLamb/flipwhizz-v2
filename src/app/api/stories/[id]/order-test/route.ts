// src/app/api/stories/[id]/order-test/route.ts
import { NextResponse } from "next/server";
import { db } from "@/db";
import { stories } from "@/db/schema";
import { eq } from "drizzle-orm";

import { v4 as uuidv4 } from "uuid";
import { createGelatoOrder } from "print/gelato/createOrder";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: storyId } = await params;

    const story = await db.query.stories.findFirst({
      where: eq(stories.id, storyId),
    });

    if (!story) {
      return NextResponse.json({ error: "Story not found" }, { status: 404 });
    }

    if (!story.pdfUrl) {
      return NextResponse.json(
        { error: "No PDF generated yet. Export PDF first." },
        { status: 400 }
      );
    }

    console.log("🧪 Test order for story:", storyId);
    console.log("📄 PDF URL:", story.pdfUrl);

    const result = await createGelatoOrder({
      orderReferenceId: `flipwhizz-${uuidv4()}`,
      customerReferenceId: `test-user`,
      pdfUrl: story.pdfUrl,
      shippingAddress: {
        firstName: "Katy",
        lastName: "Lamb",
        addressLine1: "Manor House",
        city: "Stockton-on-tees",
        postCode: "TS16 0QT",
        countryIsoCode: "GB",
        email: "katylamb2000@gmail.com",
      },
    });

    return NextResponse.json({
      success: true,
      gelatoOrderId: result.id,
      status: result.fulfillmentStatus,
      result,
    });
  } catch (err) {
    console.error("❌ Test order failed:", err);
    return NextResponse.json(
      {
        error: "Failed to create order",
        details: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}