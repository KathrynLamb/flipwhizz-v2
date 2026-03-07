// src/app/api/stories/[id]/product/route.ts

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { storyProducts } from "@/db/schema";
import { eq } from "drizzle-orm";

const PRICES: Record<string, string> = {
  digital: "14.00",
  print: "29.00",
  gift: "39.00",
  undecided: "29.00",
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const [product] = await db
    .select()
    .from(storyProducts)
    .where(eq(storyProducts.storyId, id))
    .limit(1);

  const productType = product?.productType || "undecided";
  const price = PRICES[productType] || "29.00";

  return NextResponse.json({
    productType,
    price,
    requiresShipping: product?.requiresShipping ?? false,
  });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { productType } = await req.json();

  const ALLOWED = ["digital", "print", "gift"];
  if (!productType || !ALLOWED.includes(productType)) {
    return NextResponse.json(
      { error: "Invalid product type" },
      { status: 400 }
    );
  }

  const [existing] = await db
    .select()
    .from(storyProducts)
    .where(eq(storyProducts.storyId, id))
    .limit(1);

  if (existing) {
    await db
      .update(storyProducts)
      .set({
        productType,
        requiresShipping: productType !== "digital",
        updatedAt: new Date(),
      })
      .where(eq(storyProducts.id, existing.id));
  } else {
    await db.insert(storyProducts).values({
      storyId: id,
      productType,
      requiresShipping: productType !== "digital",
      requiresPdf: true,
    });
  }

  const price = PRICES[productType] || "29.00";

  return NextResponse.json({
    productType,
    price,
    requiresShipping: productType !== "digital",
  });
}