// src/lib/paypal.ts
const PAYPAL_ENV = process.env.PAYPAL_ENV || "sandbox";

export const PAYPAL_BASE_URL =
  PAYPAL_ENV === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";

// ✅ server-side client id/secret (NOT NEXT_PUBLIC)
const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID!;
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET!;

if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
  console.warn("[PayPal] Missing PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET");
}

export async function getPaypalAccessToken(): Promise<string> {
  const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString("base64");

  const res = await fetch(`${PAYPAL_BASE_URL}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("[PayPal] Failed to get access token:", text);
    throw new Error("Failed to get PayPal access token");
  }

  const data = await res.json();
  return data.access_token as string;
}

type CreateOrderArgs = {
  storyId: string;
  product: string;
  amount: string; // "29.99"
  currency?: string; // "GBP"
};

export async function paypalCreateOrder(args: CreateOrderArgs) {
  const token = await getPaypalAccessToken();

  const res = await fetch(`${PAYPAL_BASE_URL}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: args.storyId,
          custom_id: args.storyId, // ✅ crucial so capture can map back to story
          description: args.product,
          amount: {
            currency_code: args.currency ?? "GBP",
            value: args.amount,
          },
        },
      ],
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    console.error("[PayPal] create order failed:", data);
    throw new Error(data?.message || "Failed to create PayPal order");
  }

  return data; // includes id
}

export async function paypalCaptureOrder(orderID: string) {
  const token = await getPaypalAccessToken();

  const res = await fetch(`${PAYPAL_BASE_URL}/v2/checkout/orders/${orderID}/capture`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  const data = await res.json();
  if (!res.ok) {
    console.error("[PayPal] capture failed:", data);
    throw new Error(data?.message || "Failed to capture PayPal order");
  }

  return data;
}
