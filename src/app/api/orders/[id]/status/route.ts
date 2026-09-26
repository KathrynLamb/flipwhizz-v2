// api/orders/[id]/status/route.ts - Check order status
import { NextResponse } from "next/server";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireOrderOwner } from "@/lib/apiAuth";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: orderId } = await params;
  const ownerCheck = await requireOrderOwner(orderId);
  if (!ownerCheck.ok) return ownerCheck.response;

  const order = await db.query.orders.findFirst({
    where: eq(orders.id, orderId),
  });

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  return NextResponse.json({
    orderId: order.id,
    status: order.status,
    gelatoOrderId: order.gelatoOrderId,
    gelatoStatus: order.gelatoStatus,
    submittedAt: order.submittedAt,
    shippingAddress: order.shippingAddress,
  });
}