// src/lib/getPrintSpecForProductType.ts

import { PRINT_SPECS, StoryProductType } from "@/lib/printSpecs";

export function getPrintSpecForProductType(productType: StoryProductType) {
  if (productType === "digital") {
    return null;
  }

  return PRINT_SPECS[productType];
}