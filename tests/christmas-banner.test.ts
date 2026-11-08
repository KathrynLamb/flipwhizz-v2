// tests/christmas-banner.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { runInNewContext } from "node:vm";
import { CHRISTMAS } from "../src/lib/christmas";
import { christmasBannerMessage, christmasBannerVersion, christmasBannerBootScript, isChristmasAdminPath } from "../src/lib/christmas-banner";

test("banner messages follow each campaign phase", () => {
  assert.equal(christmasBannerMessage(new Date("2026-11-07T12:00:00Z")), "Order by 12 December for Christmas delivery. 10% off with CHRISTMAS10 until 30 November.");
  assert.equal(christmasBannerMessage(new Date("2026-12-10T12:00:00Z")), "Order by 12 December for Christmas delivery. 2 days left.");
  assert.match(christmasBannerMessage(new Date("2026-12-11T12:00:00Z"))!, /1 day left/);
  assert.match(christmasBannerMessage(new Date("2026-12-12T12:00:00Z"))!, /Last day to order/);
  assert.match(christmasBannerMessage(new Date(CHRISTMAS.printCutoff))!, /^Too late for post/);
  assert.equal(christmasBannerMessage(new Date(CHRISTMAS.endsAt)), null);
});

test("admin matching excludes only the admin route tree", () => {
  assert.equal(isChristmasAdminPath("/admin"), true);
  assert.equal(isChristmasAdminPath("/admin/orders/123"), true);
  assert.equal(isChristmasAdminPath("/administrator"), false);
  assert.equal(isChristmasAdminPath("/projects"), false);
});

test("pre-paint visibility agrees with phases, dismissal and blocked storage", () => {
  for (const date of ["2026-11-07T12:00:00Z", CHRISTMAS.earlyOfferEnds, CHRISTMAS.printCutoff, CHRISTMAS.endsAt]) {
    const now = new Date(date);
    for (const storage of ["empty", "dismissed", "blocked"]) {
      const root = { dataset: {} as Record<string, string> };
      runInNewContext(christmasBannerBootScript(), {
        Date: { now: () => now.getTime(), parse: Date.parse },
        document: { documentElement: root },
        localStorage: { getItem: () => {
          if (storage === "blocked") throw new Error("Storage blocked");
          return storage === "dismissed" ? christmasBannerVersion(now) : null;
        } },
      });
      assert.equal(root.dataset.christmasBannerHidden, String(storage === "dismissed" || !christmasBannerMessage(now)));
    }
  }
});

test("new phases and edited dates renew the notice", () => {
  const early = christmasBannerVersion(new Date("2026-11-07T12:00:00Z"));
  assert.notEqual(early, christmasBannerVersion(new Date("2026-12-01T12:00:00Z")));
  const original = { ...CHRISTMAS };
  try {
    CHRISTMAS.printCutoff = "2026-12-14T23:59:00Z";
    CHRISTMAS.earlyOfferCode = "FESTIVE10";
    assert.match(christmasBannerMessage(new Date("2026-11-07T12:00:00Z"))!, /14 December.*FESTIVE10/);
    assert.notEqual(early, christmasBannerVersion(new Date("2026-11-07T12:00:00Z")));
    CHRISTMAS.enabled = false;
    assert.equal(christmasBannerMessage(new Date("2026-11-07T12:00:00Z")), null);
  } finally { Object.assign(CHRISTMAS, original); }
});
