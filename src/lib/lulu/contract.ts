export type ShippingAddress = { firstName: string; lastName: string; addressLine1: string; addressLine2?: string; city: string; state?: string; postCode: string; countryIsoCode: string; email: string; phone?: string };
export function luluShippingAddress(a: ShippingAddress) {
  if (!a || ![a.firstName, a.lastName, a.addressLine1, a.city, a.postCode, a.countryIsoCode, a.email, a.phone].every(v => typeof v === "string" && v.trim())) throw new Error("Complete the shipping address, email and contact phone number before ordering.");
  if (!/^[A-Z]{2}$/i.test(a.countryIsoCode)) throw new Error("Invalid shipping country");
  return { name: `${a.firstName.trim()} ${a.lastName.trim()}`, street1: a.addressLine1, street2: a.addressLine2 ?? "", city: a.city, state_code: a.state ?? "", postcode: a.postCode, country_code: a.countryIsoCode.toUpperCase(), phone_number: a.phone! };
}
export function luluJobPayload(input: { orderId: string; title: string; podPackageId: string; coverUrl: string; interiorUrl: string; shipping: ReturnType<typeof luluShippingAddress>; contactEmail: string; shippingLevel: string }) {
  for (const url of [input.coverUrl, input.interiorUrl]) if (new URL(url).protocol !== "https:") throw new Error("Print files must use HTTPS");
  return { contact_email: input.contactEmail, external_id: input.orderId, production_delay: 120, shipping_level: input.shippingLevel, shipping_address: input.shipping,
    line_items: [{ external_id: input.orderId, title: input.title, quantity: 1, printable_normalization: { pod_package_id: input.podPackageId, cover: { source_url: input.coverUrl }, interior: { source_url: input.interiorUrl } } }] };
}
