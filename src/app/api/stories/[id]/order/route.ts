// src/app/api/stories/[id]/order/route.ts

import { NextResponse } from "next/server";
import { db } from "@/db";
import { stories, storyProducts, orders, projects } from "@/db/schema";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { createGelatoOrder } from "print/gelato/createOrder";
import { getPrintSpec } from "@/lib/printSpecs";
import { sendOrderConfirmation } from "@/lib/emails/sendOrderConfirmation";
import { resend } from "@/lib/resend";


export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "katylamb2000@gmail.com";

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
      return NextResponse.json({ error: "Missing shipping address" }, { status: 400 });
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

    const project = await db.query.projects.findFirst({
      where: eq(projects.id, story.projectId),
    });
    const userId = project?.userId ?? "unknown";

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
         (shipping address persisted here — always retrievable)
    -------------------------------------------------- */
    const orderId = uuidv4();

    await db.insert(orders).values({
      id: orderId,
      storyId,
      userId,
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
      customerReferenceId: userId, 
      pdfUrl: story.pdfUrl,
      productUid: printSpec.gelatoProductUid,
      pageCount: printSpec.totalProductPageCount,
      currency: storyProduct?.currency ?? "GBP",
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
       5a. Draft — Gelato address validation failed
           Customer gets success, Katy gets an alert
    -------------------------------------------------- */
    if (result.draft) {
      await db
        .update(orders)
        .set({
          gelatoOrderId: result.id ?? null,
          gelatoStatus: "draft",
          status: "pending_manual",
          updatedAt: new Date(),
        })
        .where(eq(orders.id, orderId));

      // Notify admin with everything needed to fix it manually
      const addr = shippingAddress;
      const addressFormatted = [
        `${addr.firstName} ${addr.lastName}`,
        addr.addressLine1,
        addr.addressLine2,
        `${addr.city}, ${addr.postCode}`,
        addr.countryIsoCode,
      ].filter(Boolean).join("\n");

      resend.emails.send({
        from: "FlipWhizz Alerts <orders@flipwhizz.com>",
        to: ADMIN_EMAIL,
        subject: `⚠️ Manual action needed: Gelato draft order for "${story.title}"`,
        html: `
          <p style="font-family:Arial,sans-serif;font-size:15px;">
            A Gelato order was saved as a <strong>draft</strong> instead of being submitted.
            The customer has been shown a success message. You need to manually fix this order in Gelato.
          </p>

          <h3 style="font-family:Arial,sans-serif;">What to do</h3>
          <ol style="font-family:Arial,sans-serif;font-size:14px;line-height:1.8;">
            <li>Open the Gelato draft order (link below)</li>
            <li>Enter the shipping address manually</li>
            <li>Submit the order</li>
          </ol>

          <h3 style="font-family:Arial,sans-serif;">Order details</h3>
          <table style="font-family:Arial,sans-serif;font-size:14px;border-collapse:collapse;">
            <tr><td style="padding:4px 16px 4px 0;color:#888;">Internal order ID</td><td>${orderId}</td></tr>
            <tr><td style="padding:4px 16px 4px 0;color:#888;">Gelato draft ID</td><td>${result.id ?? "not returned"}</td></tr>
            <tr><td style="padding:4px 16px 4px 0;color:#888;">Story</td><td>${story.title}</td></tr>
            <tr><td style="padding:4px 16px 4px 0;color:#888;">Product</td><td>${storyProduct?.productType ?? "unknown"}</td></tr>
            <tr><td style="padding:4px 16px 4px 0;color:#888;">PDF</td><td><a href="${story.pdfUrl}">${story.pdfUrl}</a></td></tr>
          </table>

          <h3 style="font-family:Arial,sans-serif;">Shipping address to enter</h3>
          <pre style="font-family:monospace;font-size:14px;background:#f5f5f5;padding:16px;border-radius:8px;">${addressFormatted}</pre>
          <p style="font-family:Arial,sans-serif;font-size:13px;color:#888;">
            Email: ${addr.email}<br/>
            Phone: ${addr.phone || "not provided"}
          </p>

          <p style="font-family:Arial,sans-serif;font-size:14px;">
            <a href="https://dashboard.gelato.com">Open Gelato dashboard</a>
            &nbsp;|&nbsp;
            <a href="https://flipwhizz.com/stories/${storyId}/print">View story print page</a>
          </p>
        `,
      }).catch((err: any) => console.error("❌ Failed to send draft alert email:", err));

      // Return success to the customer — they don't need to know about the backend issue
      return NextResponse.json({
        success: true,
        orderId,
        gelatoOrderId: result.id,
        status: "submitted",
      });
    }

    /* --------------------------------------------------
       5b. Success — update order with Gelato response
    -------------------------------------------------- */
    await db
      .update(orders)
      .set({
        gelatoOrderId: result.id,
        gelatoStatus: result.fulfillmentStatus,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, orderId));

    await db
      .update(stories)
      .set({ orderStatus: "submitted", updatedAt: new Date() })
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