export async function fetchGelatoCoverDimensions(
  productUid: string,
  apiKey: string
) {
  const res = await fetch(
    `https://product.gelatoapis.com/v3/products/${productUid}/cover-dimensions`,
    {
      headers: {
        "X-API-KEY": apiKey,
      },
      cache: "no-store",
    }
  );

  if (!res.ok) {
    throw new Error(
      `Failed to get cover dimensions: ${res.status} ${res.statusText}`
    );
  }

  return res.json();
}
