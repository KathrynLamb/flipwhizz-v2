// src/app/api/stories/[id]/product/route.ts

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { storyProducts } from "@/db/schema";
import { eq } from "drizzle-orm";

const PRICES = {
  digital: "14.00",
  print: "29.00",
  gift: "39.00",
} as const;

const ALLOWED_PRODUCT_TYPES = ["digital", "print", "gift"] as const;
type ProductType = (typeof ALLOWED_PRODUCT_TYPES)[number];

function isValidProductType(value: unknown): value is ProductType {
  return (
    typeof value === "string" &&
    ALLOWED_PRODUCT_TYPES.includes(value as ProductType)
  );
}

function getPrice(productType: ProductType): string {
  return PRICES[productType];
}

function requiresShipping(productType: ProductType): boolean {
  return productType !== "digital";
}

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

  if (!product || !isValidProductType(product.productType)) {
    return NextResponse.json({
      productType: null,
      price: null,
      requiresShipping: null,
      productSelected: false,
    });
  }

  const productType = product.productType;

  return NextResponse.json({
    productType,
    price: getPrice(productType),
    requiresShipping: requiresShipping(productType),
    productSelected: true,
  });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const rawProductType = body?.productType;

  if (!isValidProductType(rawProductType)) {
    return NextResponse.json(
      { error: "Invalid product type" },
      { status: 400 }
    );
  }

  const productType = rawProductType;

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
        requiresShipping: requiresShipping(productType),
        requiresPdf: true,
        updatedAt: new Date(),
      })
      .where(eq(storyProducts.id, existing.id));
  } else {
    await db.insert(storyProducts).values({
      storyId: id,
      productType,
      requiresShipping: requiresShipping(productType),
      requiresPdf: true,
    });
  }

  return NextResponse.json({
    productType,
    price: getPrice(productType),
    requiresShipping: requiresShipping(productType),
    productSelected: true,
  });
}