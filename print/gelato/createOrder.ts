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
  countryIsoCode: string; // "GB", "US"
  email: string;
  phone?: string;
}

interface CreateOrderParams {
  orderReferenceId: string;   // your internal order id
  customerReferenceId: string; // user id
  pdfUrl: string;
  shippingAddress: ShippingAddress;
}

export async function createGelatoOrder(params: CreateOrderParams) {
  const { orderReferenceId, customerReferenceId, pdfUrl, shippingAddress } = params;

  const apiKey = process.env.GELATO_API_KEY;
  const productUid = process.env.GELATO_PRODUCT_UID;

  if (!apiKey || !productUid) {
    throw new Error("Missing Gelato configuration in environment variables");
  }

  const payload = {
    orderType: "order", // ✅ MUST be "order" in production
    orderReferenceId,
    customerReferenceId,
    currency: "GBP",

    items: [
      {
        itemReferenceId: uuidv4(),
        productUid,
        quantity: 1,

        // ✅ Correct for books
        assets: {
          interior: {
            url: pdfUrl,
          },
        },
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

  const response = await fetch("https://order.gelatoapis.com/v4/orders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`, // ✅ FIXED
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(
      `Gelato API Error ${response.status}: ${JSON.stringify(error)}`
    );
  }

  return await response.json();
}
