import test from "node:test";
import assert from "node:assert/strict";
import { getPriceCents, getUpgradePriceCents, countryToCurrency, formatPrice, resolvePromoDiscount, applyDiscount, type CurrencyCode } from "../src/lib/pricing";
import { shippingOptionsPayload, selectShippingLevel } from "../src/lib/lulu/shipping";

test("colouring retail prices, digital credit and unchanged storybooks", () => {
  const cases: [CurrencyCode, number, number][] = [["GBP",2499,2900],["USD",2999,3500],["EUR",2899,3300],["AUD",3899,4500],["CAD",3999,4700]];
  for (const [currency, price, standard] of cases) {
    assert.equal(getPriceCents("print", currency, "colouring_storybook"), price);
    assert.equal(getPriceCents("print", currency), standard);
    assert.equal(getUpgradePriceCents("digital", "print", currency, "colouring_storybook"), price-getPriceCents("digital",currency));
    const promo = resolvePromoDiscount({discountPercent:20,digitalOverride:null,printOverride:null,giftOverride:null,label:null},"print",currency,"colouring_storybook");
    assert.equal(applyDiscount(price,promo.discountPercent,promo.isFree), Math.round(price*.8));
  }
  assert.equal(formatPrice(2499,"GBP"),"£24.99");
  assert.equal(countryToCurrency("ca"),"CAD");
});
test("regional delivery quotes use recipient country and local supported currency", () => {
  for (const [country,currency] of [["GB","GBP"],["US","USD"],["CA","CAD"],["AU","AUD"],["FR","EUR"]]) {
    const body=shippingOptionsPayload({firstName:"Test",lastName:"Reader",email:"test@example.com",addressLine1:"1 Test St",city:"Test",state:"TEST",postCode:"TEST",countryIsoCode:country},"sku",32);
    assert.equal(body.currency,currency); assert.equal(body.shipping_address.country,country); assert.equal(body.line_items[0].quantity,1);
  }
  assert.equal(selectShippingLevel([{level:"MAIL"},{level:"GROUND",cost_excl_tax:"5"}],"MAIL"),"MAIL");
  assert.equal(selectShippingLevel([{level:"GROUND",cost_excl_tax:"5"},{level:"PRIORITY_MAIL",cost_excl_tax:"4"}],"MAIL"),"PRIORITY_MAIL");
  assert.throws(()=>selectShippingLevel([{level:"EXPRESS",cost_excl_tax:"50"}],"MAIL"));
});
