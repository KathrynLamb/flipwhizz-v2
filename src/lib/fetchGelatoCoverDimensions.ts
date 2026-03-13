export async function fetchGelatoCoverDimensions(
  productUid: string,
  apiKey: string,
  pageCount: number
) {
  const url = new URL(
    `https://product.gelatoapis.com/v3/products/${productUid}/cover-dimensions`
  );
  url.searchParams.set("pageCount", String(pageCount));

  const res = await fetch(url.toString(), {
    headers: {
      "X-API-KEY": apiKey,
    },
    cache: "no-store",
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(
      `Failed to get cover dimensions: ${res.status} ${res.statusText} - ${JSON.stringify(data)}`
    );
  }

  const hasSoftcoverDims =
    !!data?.bleedSize?.width && !!data?.bleedSize?.height;

  const hasHardcoverDims =
    !!data?.wraparoundInsideSize?.width &&
    !!data?.wraparoundInsideSize?.height;

  if (!hasSoftcoverDims && !hasHardcoverDims) {
    throw new Error(
      `Gelato cover dimensions response missing usable cover size: ${JSON.stringify(data)}`
    );
  }

  return data;
}