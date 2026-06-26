// src/lib/pricing.ts

export type CurrencyCode = "GBP" | "USD" | "EUR" | "AUD";
export type ProductType = "digital" | "print" | "gift";

export type CurrencyConfig = {
  code: CurrencyCode;
  symbol: string;
  label: string;
  flag: string;
};

export const CURRENCIES: Record<CurrencyCode, CurrencyConfig> = {
  GBP: { code: "GBP", symbol: "£", label: "British Pound", flag: "🇬🇧" },
  USD: { code: "USD", symbol: "$", label: "US Dollar", flag: "🇺🇸" },
  EUR: { code: "EUR", symbol: "€", label: "Euro", flag: "🇪🇺" },
  AUD: { code: "AUD", symbol: "A$", label: "Australian Dollar", flag: "🇦🇺" },
};

// Prices in minor units (cents/pence) per currency per product
export const PRICES: Record<CurrencyCode, Record<ProductType, number>> = {
  GBP: { digital: 1400, print: 2900, gift: 3900 },
  USD: { digital: 1700, print: 3500, gift: 4700 },
  EUR: { digital: 1600, print: 3300, gift: 4500 },
  AUD: { digital: 2200, print: 4500, gift: 5900 },
};

/** Map country ISO code → currency */
const COUNTRY_TO_CURRENCY: Record<string, CurrencyCode> = {
  // GBP
  GB: "GBP",
  // USD
  US: "USD", CA: "USD",
  // EUR
  DE: "EUR", FR: "EUR", IT: "EUR", ES: "EUR", NL: "EUR", BE: "EUR",
  AT: "EUR", PT: "EUR", IE: "EUR", FI: "EUR", GR: "EUR", LU: "EUR",
  SK: "EUR", SI: "EUR", EE: "EUR", LV: "EUR", LT: "EUR", MT: "EUR",
  CY: "EUR", HR: "EUR",
  // Also map non-euro European to EUR as closest
  SE: "EUR", NO: "EUR", DK: "EUR", CH: "EUR", PL: "EUR", CZ: "EUR",
  HU: "EUR", RO: "EUR", BG: "EUR",
  // AUD
  AU: "AUD", NZ: "AUD",
};

export function countryToCurrency(countryCode: string | null | undefined): CurrencyCode {
  if (!countryCode) return "GBP";
  return COUNTRY_TO_CURRENCY[countryCode.toUpperCase()] ?? "GBP";
}

export function formatPrice(cents: number, currency: CurrencyCode): string {
  const config = CURRENCIES[currency];
  const amount = (cents / 100).toFixed(2);
  // Strip trailing .00
  const clean = amount.endsWith(".00") ? amount.slice(0, -3) : amount;
  return `${config.symbol}${clean}`;
}

export function getPriceCents(product: ProductType, currency: CurrencyCode): number {
  return PRICES[currency]?.[product] ?? PRICES.GBP[product];
}

export function getUpgradePriceCents(
  from: ProductType,
  to: ProductType,
  currency: CurrencyCode
): number {
  const fromCents = getPriceCents(from, currency);
  const toCents = getPriceCents(to, currency);
  return Math.max(0, toCents - fromCents);
}

/**
 * Apply a promo discount to a price in cents.
 * Returns the discounted price (never below 0).
 *
 * @param priceCents - original price in cents
 * @param discountPercent - 0–100 (0 = free when used as override)
 * @param isFree - whether this product is explicitly free (override === 0)
 */
export function applyDiscount(
  priceCents: number,
  discountPercent: number,
  isFree: boolean
): number {
  if (isFree) return 0;
  if (discountPercent <= 0) return priceCents;
  if (discountPercent >= 100) return 0;
  return Math.round(priceCents * (1 - discountPercent / 100));
}

/**
 * Given a promo code record and a product type, resolve the effective discount.
 * Returns { discountPercent, isFree, label }.
 */
// src/lib/pricing.ts

export function resolvePromoDiscount(
  promo: {
    discountPercent: number | null;
    digitalOverride: number | null;
    printOverride: number | null;
    giftOverride: number | null;
    label: string | null;
  },
  product: ProductType,
  currency: CurrencyCode = "GBP"
): { discountPercent: number; isFree: boolean; label: string } {
  const overrideMap: Record<ProductType, number | null> = {
    digital: promo.digitalOverride,
    print: promo.printOverride,
    gift: promo.giftOverride,
  };

  const override = overrideMap[product];
  const basePercent = promo.discountPercent ?? 0;

  if (override === 0) {
    // Explicitly free
    return { discountPercent: 100, isFree: true, label: promo.label ?? "Promo" };
  }

  if (override !== null && override !== undefined) {
    // Override is a fixed price in cents — convert to a discount percent
    const originalCents = getPriceCents(product, currency);
    const discountPercent = Math.round(((originalCents - override) / originalCents) * 100);
    const isFree = override === 0;
    return { discountPercent, isFree, label: promo.label ?? "Promo" };
  }

  // No product override — use the code's global discountPercent
  return { discountPercent: basePercent, isFree: false, label: promo.label ?? "Promo" };
}