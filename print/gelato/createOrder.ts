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
  countryIsoCode: string; // e.g., "GB", "US"
  email: string;
  phone?: string;
}

interface CreateOrderParams {
  orderReferenceId: string; // Your internal Order ID
  customerReferenceId: string; // Your internal User ID
  pdfUrl: string;
  shippingAddress: ShippingAddress;
}

export async function createGelatoOrder(params: CreateOrderParams) {
  const { orderReferenceId, customerReferenceId, pdfUrl, shippingAddress } = params;

  const apiKey = process.env.GELATO_API_KEY;
  const productUid = process.env.GELATO_PRODUCT_UID;

  if (!apiKey || !productUid) {
    throw new Error("Missing Gelato configuration in .env");
  }

  // Construct the payload required by Gelato
  const payload = {
    orderType: "draft", // ⚠️ Change to "order" to actually print and charge!
    orderReferenceId: orderReferenceId, 
    customerReferenceId: customerReferenceId,
    currency: "GBP", // Or "USD", based on your preference
    items: [
      {
        itemReferenceId: uuidv4(),
        productUid: productUid,
        quantity: 1,
        files: [
          {
            type: "default",
            url: pdfUrl, // The Firebase URL we just generated
          },
        ],
      },
    ],
    shippingAddress: {
      firstName: shippingAddress.firstName,
      lastName: shippingAddress.lastName,
      addressLine1: shippingAddress.addressLine1,
      addressLine2: shippingAddress.addressLine2 || "",
      city: shippingAddress.city,
      state: shippingAddress.state || "",
      postCode: shippingAddress.postCode,
      country: shippingAddress.countryIsoCode,
      email: shippingAddress.email,
      phone: shippingAddress.phone || "",
    },
  };

  const response = await fetch("https://order.gelatoapis.com/v4/orders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": apiKey,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(
      `Gelato API Error: ${response.statusText} - ${JSON.stringify(errorData)}`
    );
  }

  return await response.json();
}