// src/lib/printSpecs.ts

export type StoryProductType = "digital" | "print" | "gift";

export type PrintSpec = {
  gelatoProductUid: string;
  coverType: "softcover" | "hardcover";
  trimSize: "8x8";
  /** Number of interior-sized pages available for content + padding in the PDF */
  interiorPageTarget: number;
  /**
   * The page count sent to Gelato APIs (cover dimensions + order).
   * For a "30 page" Gelato book this is 30.
   * Gelato expects (totalProductPageCount + 3) total pages in the PDF file:
   *   cover spread + inside-front blank + N interior + inside-back blank.
   */
  totalProductPageCount: number;
};

export const PRINT_SPECS: Record<
  Exclude<StoryProductType, "digital">,
  PrintSpec
> = {
  print: {
    // gelatoProductUid: process.env.GELATO_SOFTCOVER_8X8_UID!,
    gelatoProductUid: process.env.GELATO_PRODUCT_UID_SOFTCOVER!,
    coverType: "softcover",
    trimSize: "8x8",
    interiorPageTarget: 30,
    totalProductPageCount: 30,
  },
  gift: {
    // gelatoProductUid: process.env.GELATO_HARDCOVER_8X8_UID!,
    gelatoProductUid: process.env.GELATO_PRODUCT_UID_HARDCOVER!,
    coverType: "hardcover",
    trimSize: "8x8",
    interiorPageTarget: 30,
    totalProductPageCount: 30,
  },
};

export function getPrintSpec(
  productType: string | null | undefined
): PrintSpec & { productType: "print" | "gift" } {
  if (productType === "print")
    return { ...PRINT_SPECS.print, productType: "print" };
  if (productType === "gift")
    return { ...PRINT_SPECS.gift, productType: "gift" };

  throw new Error(
    `Story product is not a physical print product. Received productType="${productType ?? "null"}"`
  );
}