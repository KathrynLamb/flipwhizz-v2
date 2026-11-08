// tests/christmas.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import {
  CHRISTMAS, christmasPhase, isBeforePrintCutoff, isBeforeColouringCutoff,
  daysUntilPrintCutoff, formatChristmasDate,
} from "../src/lib/christmas";

test("phases change at the exact configured instants", () => {
  assert.equal(christmasPhase(new Date("2026-11-07T12:00:00Z")), "early");
  for (const [deadline, before, after] of [
    [CHRISTMAS.earlyOfferEnds, "early", "print"],
    [CHRISTMAS.printCutoff, "print", "digital-only"],
    [CHRISTMAS.endsAt, "digital-only", "over"],
  ] as const) {
    assert.equal(christmasPhase(new Date(Date.parse(deadline) - 1)), before);
    assert.equal(christmasPhase(new Date(deadline)), after);
  }
});

test("each product uses its own exclusive deadline", () => {
  for (const [deadline, check] of [
    [CHRISTMAS.printCutoff, isBeforePrintCutoff],
    [CHRISTMAS.colouringCutoff, isBeforeColouringCutoff],
  ] as const) {
    assert.equal(check(new Date(Date.parse(deadline) - 1)), true);
    assert.equal(check(new Date(deadline)), false);
    assert.equal(check(new Date(Date.parse(deadline) + 1)), false);
  }
  const now = new Date("2026-12-09T12:00:00Z");
  assert.equal(isBeforeColouringCutoff(now), false);
  assert.equal(isBeforePrintCutoff(now), true);
});

test("countdown uses calendar days and never becomes negative", () => {
  assert.equal(daysUntilPrintCutoff(new Date("2026-12-11T00:00:00Z")), 1);
  assert.equal(daysUntilPrintCutoff(new Date("2026-12-12T00:00:00Z")), 0);
  assert.equal(daysUntilPrintCutoff(new Date("2026-12-13T00:00:00Z")), 0);
});

test("formatting uses UK dates including British Summer Time", () => {
  assert.equal(formatChristmasDate(CHRISTMAS.printCutoff), "12 December");
  assert.equal(formatChristmasDate("2026-06-01T23:30:00Z"), "2 June");
});

test("changing config is reflected immediately and disabling ends the campaign", () => {
  const original = { ...CHRISTMAS };
  try {
    CHRISTMAS.printCutoff = "2026-12-15T23:59:00Z";
    assert.equal(christmasPhase(new Date("2026-12-13T12:00:00Z")), "print");
    assert.equal(daysUntilPrintCutoff(new Date("2026-12-13T12:00:00Z")), 2);
    CHRISTMAS.enabled = false;
    assert.equal(christmasPhase(new Date("2026-11-07T12:00:00Z")), "over");
  } finally {
    Object.assign(CHRISTMAS, original);
  }
});

test("invalid dates are rejected", () => {
  assert.throws(() => christmasPhase(new Date("invalid")), RangeError);
  assert.throws(() => daysUntilPrintCutoff(new Date("invalid")), RangeError);
});
