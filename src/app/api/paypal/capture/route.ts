// src/app/api/paypal/capture/route.ts
import { NextResponse } from "next/server";
import { paypalCaptureOrder } from "@/lib/paypal";
import { db } from "@/db";
import { stories, storyProducts } from "@/db/schema";
import { eq } from "drizzle-orm";
import { inngest } from "@/inngest/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ShippingAddress = {
  firstName: string;
  lastName: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  postCode: string;
  countryIsoCode: string;
  email: string;
  phone: string;
};

function splitFullName(fullName?: string | null) {
  const clean = (fullName ?? "").trim();

  if (!clean) {
    return { firstName: "", lastName: "" };
  }

  const parts = clean.split(/\s+/);

  if (parts.length === 1) {
    return { firstName: parts[0], lastName: "" };
  }

  return {
    firstName: parts.slice(0, -1).join(" "),
    lastName: parts.slice(-1).join(""),
  };
}

function extractPaypalShippingAddress(receipt: any): ShippingAddress | null {
  const pu = receipt?.purchase_units?.[0];
  const shipping = pu?.shipping;
  const payer = receipt?.payer;

  if (!shipping?.address && !payer?.address) {
    return null;
  }

  const shippingName = splitFullName(shipping?.name?.full_name);
  const addr = shipping?.address ?? payer?.address ?? {};

  return {
    firstName: shippingName.firstName,
    lastName: shippingName.lastName,
    addressLine1: addr.address_line_1 ?? "",
    addressLine2: addr.address_line_2 ?? "",
    city: addr.admin_area_2 ?? "",
    postCode: addr.postal_code ?? "",
    countryIsoCode: addr.country_code ?? "GB",
    email: payer?.email_address ?? "",
    phone: payer?.phone?.phone_number?.national_number ?? "",
  };
}

export async function POST(req: Request) {
  try {
    const { orderID } = await req.json();

    if (!orderID) {
      return NextResponse.json(
        { error: "orderID required" },
        { status: 400 }
      );
    }

    /* --------------------------------------------------
       CAPTURE PAYPAL ORDER
    -------------------------------------------------- */
    const receipt = await paypalCaptureOrder(orderID);

    if (receipt?.status !== "COMPLETED") {
      return NextResponse.json(
        {
          error: `Order not completed (status=${receipt?.status})`,
          receipt,
        },
        { status: 400 }
      );
    }

    /* --------------------------------------------------
       RESOLVE STORY ID
    -------------------------------------------------- */
    const pu = receipt?.purchase_units?.[0];
    const storyId: string | undefined = pu?.custom_id || pu?.reference_id;

    if (!storyId) {
      return NextResponse.json(
        {
          error: "Missing storyId on PayPal purchase unit",
          receipt,
        },
        { status: 400 }
      );
    }

    /* --------------------------------------------------
       REQUIRE CANONICAL story_products ROW
    -------------------------------------------------- */
    const storyProduct = await db.query.storyProducts.findFirst({
      where: eq(storyProducts.storyId, storyId),
    });

    if (!storyProduct) {
      return NextResponse.json(
        {
          error:
            "Missing story_products row for this story. Refusing to complete capture because product state was never saved before checkout.",
          storyId,
          orderID,
        },
        { status: 400 }
      );
    }

    const productType = storyProduct.productType;

    if (!productType || !["digital", "print", "gift"].includes(productType)) {
      return NextResponse.json(
        {
          error: `Invalid or missing productType on story_products for story ${storyId}`,
          storyId,
          orderID,
        },
        { status: 400 }
      );
    }

    const isPhysical = productType === "print" || productType === "gift";

    /* --------------------------------------------------
       SAVE PAYPAL SHIPPING ADDRESS FOR PHYSICAL PRODUCTS
    -------------------------------------------------- */
    if (isPhysical) {
      const checkoutAddress = extractPaypalShippingAddress(receipt);

      if (!checkoutAddress) {
        return NextResponse.json(
          {
            error:
              "Missing shipping address from PayPal for a physical product order.",
            storyId,
            orderID,
            productType,
          },
          { status: 400 }
        );
      }

      await db
        .update(storyProducts)
        .set({
          checkoutAddress,
          updatedAt: new Date(),
        })
        .where(eq(storyProducts.storyId, storyId));
    }

    /* --------------------------------------------------
       CHECK IF THIS IS AN UPGRADE (already paid)
    -------------------------------------------------- */
    const [storyRow] = await db
      .select({ paymentStatus: stories.paymentStatus, status: stories.status })
      .from(stories)
      .where(eq(stories.id, storyId))
      .limit(1);

    const alreadyPaid = storyRow?.paymentStatus === "paid";

    /* --------------------------------------------------
       UPDATE PAYMENT STATE
       For upgrades (already paid): only update the paymentId
       For first purchase: set paid + generating + fire Inngest
    -------------------------------------------------- */
    if (alreadyPaid) {
      // Upgrade — story is already paid and illustrations already generated.
      // Just record the new payment ID; productType was already swapped before checkout.
      await db
        .update(stories)
        .set({
          paymentId: orderID,
          updatedAt: new Date(),
        })
        .where(eq(stories.id, storyId));
    } else {
      // First purchase
      await db
        .update(stories)
        .set({
          paymentStatus: "paid",
          paymentId: orderID,
          status: "generating",
          updatedAt: new Date(),
        })
        .where(eq(stories.id, storyId));

      /* Fire Inngest — generates all spreads in parallel */
      await inngest.send({
        name: "story/generate.spreads",
        data: { storyId },
      });
    }

    /* --------------------------------------------------
       RESPOND
    -------------------------------------------------- */
    return NextResponse.json({
      success: true,
      storyId,
      orderID,
      productType,
      isUpgrade: alreadyPaid,
    });
  } catch (err: any) {
    console.error("[PayPal capture] error:", err);
    return NextResponse.json(
      { error: err?.message ?? "Failed to capture PayPal order" },
      { status: 500 }
    );
  }
}