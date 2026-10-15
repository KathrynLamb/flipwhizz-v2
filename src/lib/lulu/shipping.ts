import { countryToCurrency } from "../pricing";
import type { ShippingAddress } from "./contract";

// The shipping-options endpoint supports quote currency. Print-job creation does
// not: Lulu bills in the account currency and controls printer routing itself.
export function shippingOptionsPayload(address: ShippingAddress, podPackageId: string, pageCount: number) {
  return {
    currency: countryToCurrency(address.countryIsoCode),
    line_items: [{ pod_package_id: podPackageId, page_count: pageCount, quantity: 1 }],
    shipping_address: { country: address.countryIsoCode.toUpperCase(), city: address.city, postcode: address.postCode, state: address.state ?? "", street1: address.addressLine1, street2: address.addressLine2 ?? "" },
  };
}
type ShippingOption = { level: string; cost_excl_tax?: string | null; business_only?: boolean };
export function selectShippingLevel(options: ShippingOption[], preferred: string) {
  const available = options.filter(o => ["MAIL", "PRIORITY_MAIL", "GROUND", "GROUND_HD"].includes(o.level) && !o.business_only);
  const exact = available.find(o => o.level === preferred);
  if (exact) return exact.level;
  const priced = available.filter(o => o.cost_excl_tax != null && Number.isFinite(Number(o.cost_excl_tax)) && Number(o.cost_excl_tax) >= 0);
  priced.sort((a, b) => Number(a.cost_excl_tax) - Number(b.cost_excl_tax));
  if (!priced.length) throw new Error("Standard delivery is unavailable for this address. Please contact support before ordering.");
  return priced[0].level;
}
