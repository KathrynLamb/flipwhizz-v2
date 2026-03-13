// src/print/gelato/createOrder.ts

import { v4 as uuidv4 } from "uuid";

interface ShippingAddress {
  firstName: string;
  lastName: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state?: string;
  postCode: string;
  countryIsoCode: string;
  email: string;
  phone?: string;
}

export interface CreateOrderParams {
  orderReferenceId: string;
  customerReferenceId: string;
  pdfUrl: string;
  shippingAddress: ShippingAddress;
  productUid: string;
  /** Must match the Gelato product page count — no default, caller must provide */
  pageCount: number;
}

export async function createGelatoOrder(params: CreateOrderParams) {
  const {
    orderReferenceId,
    customerReferenceId,
    pdfUrl,
    shippingAddress,
    productUid,
    pageCount,
  } = params;

  const apiKey = process.env.GELATO_API_KEY;

  if (!apiKey) {
    throw new Error("Missing GELATO_API_KEY in environment variables");
  }

  if (!productUid) {
    throw new Error("Missing Gelato productUid for order creation");
  }

  if (!pdfUrl) {
    throw new Error("Missing PDF URL for Gelato order creation");
  }

  if (!pageCount || pageCount < 1) {
    throw new Error(
      `Invalid pageCount for Gelato order: ${pageCount}. Must be a positive integer.`
    );
  }

  const payload = {
    orderType: "order",
    orderReferenceId,
    customerReferenceId,
    currency: "GBP",
    items: [
      {
        itemReferenceId: uuidv4(),
        productUid,
        pageCount,
        quantity: 1,
        files: [
          {
            type: "default",
            url: pdfUrl,
          },
        ],
      },
    ],
    shippingAddress: {
      firstName: shippingAddress.firstName,
      lastName: shippingAddress.lastName,
      addressLine1: shippingAddress.addressLine1,
      addressLine2: shippingAddress.addressLine2 ?? "",
      city: shippingAddress.city,
      state: shippingAddress.state ?? "",
      postCode: shippingAddress.postCode,
      country: shippingAddress.countryIsoCode,
      email: shippingAddress.email,
      phone: shippingAddress.phone ?? "",
    },
  };

  console.log("📦 Submitting Gelato order:", {
    orderReferenceId,
    customerReferenceId,
    productUid,
    pageCount,
    pdfUrl,
    country: shippingAddress.countryIsoCode,
  });

  const response = await fetch("https://order.gelatoapis.com/v4/orders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": apiKey,
    },
    body: JSON.stringify(payload),
  });

  const text = await response.text();

  let data: unknown;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!response.ok) {
    console.error("❌ Gelato order error:", data);
    throw new Error(
      `Gelato API Error ${response.status}: ${
        typeof data === "string" ? data : JSON.stringify(data)
      }`
    );
  }

  console.log("✅ Gelato order created:", data);
  return data;
}