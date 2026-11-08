// tests/promo.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { getPromoUnusableReason, computeCheckoutCents } from "../src/lib/pricing";
import { CHRISTMAS } from "../src/lib/christmas";
import { christmasPromoSeedSQL } from "../scripts/seed-christmas-promos";
const p = { active: true, startsAt: new Date("2026-11-01"), expiresAt: new Date("2026-11-30T23:59:00Z"), maxUses: 2, currentUses: 1 };
test("promo dates are inclusive at start and exclusive at expiry", () => {
  assert.match(getPromoUnusableReason(p, new Date("2026-10-31"))!, /not yet active/);
  assert.equal(getPromoUnusableReason(p, p.startsAt), null);
  assert.equal(getPromoUnusableReason(p, new Date(p.expiresAt.getTime()-1)), null);
  assert.match(getPromoUnusableReason(p, p.expiresAt)!, /expired/);
});
test("disabled and over-used codes return friendly reasons", () => {
  const now = new Date("2026-11-08");
  assert.match(getPromoUnusableReason({...p, active:false}, now)!, /no longer active/);
  assert.match(getPromoUnusableReason({...p, currentUses:2}, now)!, /fully redeemed/);
  assert.match(getPromoUnusableReason({...p, maxUses:0}, now)!, /fully redeemed/);
  assert.equal(getPromoUnusableReason({...p, maxUses:null, currentUses:100}, now), null);
});
test("ten percent works across all Christmas products", () => {
  const promo = {discountPercent:10, digitalOverride:null, printOverride:null, giftOverride:null, label:"Christmas"};
  assert.equal(computeCheckoutCents("digital","GBP",{promo}),1260);
  assert.equal(computeCheckoutCents("print","GBP",{promo}),2610);
  assert.equal(computeCheckoutCents("gift","GBP",{promo}),3510);
  assert.equal(computeCheckoutCents("print","GBP",{promo,bookType:"colouring_storybook"}),2249);
});
test("seed reads central dates, escapes SQL and preserves existing codes", () => {
  const old={...CHRISTMAS};
  try {
    CHRISTMAS.earlyOfferCode="TEST'10"; CHRISTMAS.earlyOfferEnds="2026-11-29T23:59:00Z";
    const s=christmasPromoSeedSQL();
    assert.match(s,/TEST''10/);assert.match(s,/2026-11-29T23:59:00Z/);
    assert.match(s,/VERONICA10/);assert.match(s,/NICK10/);assert.match(s,/NOT EXISTS/);
    assert.doesNotMatch(s,/UPDATE promo_codes|—/);
  } finally {Object.assign(CHRISTMAS,old);}
});
