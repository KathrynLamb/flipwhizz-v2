import { luluClient } from "@/lib/lulu/client";
// api/orders/[id]/status/route.ts - Check order status
import { NextResponse } from "next/server";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { eq } from "drizzle-orm";
import { withAccess } from "@/lib/authz";

async function _GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: orderId } = await params;

  const order = await db.query.orders.findFirst({
    where: eq(orders.id, orderId),
  });

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  if (order.printProvider === "lulu" && order.providerOrderId) {
    try {
      const job = await luluClient().request<{ status: { name: string } }>(`/print-jobs/${encodeURIComponent(order.providerOrderId)}/`);
      const statusMap: Record<string, string> = { SHIPPED: "shipped", REJECTED: "failed", CANCELED: "cancelled", IN_PRODUCTION: "printing", UNPAID: "pending_manual" };
      order.providerStatus = job.status.name;
      order.status = statusMap[job.status.name] ?? order.status;
      await db.update(orders).set({ providerStatus: order.providerStatus, status: order.status, updatedAt: new Date() }).where(eq(orders.id, order.id));
    } catch { /* Preserve last known status while Lulu is unavailable. */ }
  }

  return NextResponse.json({
    orderId: order.id,
    printProvider: order.printProvider,
    providerOrderId: order.providerOrderId,
    providerStatus: order.providerStatus,
    status: order.status,
    gelatoOrderId: order.gelatoOrderId,
    gelatoStatus: order.gelatoStatus,
    submittedAt: order.submittedAt,
    shippingAddress: order.shippingAddress,
  });
}

export const GET = withAccess({ order: { param: "id" } }, _GET);
