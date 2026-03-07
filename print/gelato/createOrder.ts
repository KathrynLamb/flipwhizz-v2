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

interface CreateOrderParams {
  orderReferenceId: string;
  customerReferenceId: string;
  pdfUrl: string;
  shippingAddress: ShippingAddress;
  productUid: string;  // NEW
}


export async function createGelatoOrder(params: CreateOrderParams) {
  const { orderReferenceId, customerReferenceId, pdfUrl, shippingAddress, productUid } = params;

  const apiKey = process.env.GELATO_API_KEY;


  if (!apiKey || !productUid) {
    throw new Error("Missing Gelato configuration in environment variables");
  }

  const payload = {
    orderType: "order",  // ⚠️ Use "draft" for testing, change to "order" for production
    orderReferenceId,
    customerReferenceId,
    currency: "GBP",
    items: [
      {
        itemReferenceId: uuidv4(),
        productUid,
        pageCount: 30,  
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

  console.log("📦 Submitting Gelato order:", JSON.stringify(payload, null, 2));

  const response = await fetch("https://order.gelatoapis.com/v4/orders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": apiKey,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.json();
    console.error("❌ Gelato order error:", JSON.stringify(error, null, 2));
    throw new Error(
      `Gelato API Error ${response.status}: ${JSON.stringify(error)}`
    );
  }

  const result = await response.json();
  console.log("✅ Gelato order created:", result.id);
  return result;
}