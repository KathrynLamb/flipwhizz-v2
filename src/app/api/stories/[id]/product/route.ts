// src/app/api/stories/[id]/product/route.ts

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { storyProducts } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  getPriceCents,
  formatPrice,
  type ProductType,
  type CurrencyCode,
} from "@/lib/pricing";

const ALLOWED_PRODUCT_TYPES = ["digital", "print", "gift"] as const;
const ALLOWED_CURRENCIES: CurrencyCode[] = ["GBP", "USD", "EUR", "AUD"];

function isValidProductType(value: unknown): value is ProductType {
  return (
    typeof value === "string" &&
    ALLOWED_PRODUCT_TYPES.includes(value as ProductType)
  );
}

function isValidCurrency(value: unknown): value is CurrencyCode {
  return (
    typeof value === "string" &&
    ALLOWED_CURRENCIES.includes(value as CurrencyCode)
  );
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
      priceCents: null,
      currency: null,
      requiresShipping: null,
      productSelected: false,
    });
  }

  const productType = product.productType;
  const currency = (isValidCurrency(product.currency) ? product.currency : "GBP") as CurrencyCode;
  const cents = getPriceCents(productType, currency);

  return NextResponse.json({
    productType,
    price: formatPrice(cents, currency),
    priceCents: cents,
    currency,
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
  const rawCurrency = body?.currency;

  if (!isValidProductType(rawProductType)) {
    return NextResponse.json(
      { error: "Invalid product type" },
      { status: 400 }
    );
  }

  const productType = rawProductType;
  const currency: CurrencyCode = isValidCurrency(rawCurrency) ? rawCurrency : "GBP";
  const cents = getPriceCents(productType, currency);

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
        currency,
        estimatedPrice: cents,
        requiresShipping: requiresShipping(productType),
        requiresPdf: true,
        updatedAt: new Date(),
      })
      .where(eq(storyProducts.id, existing.id));
  } else {
    await db.insert(storyProducts).values({
      storyId: id,
      productType,
      currency,
      estimatedPrice: cents,
      requiresShipping: requiresShipping(productType),
      requiresPdf: true,
    });
  }

  return NextResponse.json({
    productType,
    price: formatPrice(cents, currency),
    priceCents: cents,
    currency,
    requiresShipping: requiresShipping(productType),
    productSelected: true,
  });
}