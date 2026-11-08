// tests/christmas-delivery.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { CHRISTMAS } from "../src/lib/christmas";
import { christmasDelivery, CHRISTMAS_LATE_WARNING } from "../src/lib/christmas-delivery";

test("each printed format becomes late at its own exact cut-off", () => {
  for (const [bookType, cutoff] of [["storybook", CHRISTMAS.printCutoff], ["colouring_storybook", CHRISTMAS.colouringCutoff]]) {
    const time = Date.parse(cutoff);
    assert.equal(christmasDelivery("print", bookType, new Date(time - 1))?.late, false);
    assert.equal(christmasDelivery("print", bookType, new Date(time))?.message, CHRISTMAS_LATE_WARNING);
    assert.equal(christmasDelivery("print", bookType, new Date(time + 1))?.late, true);
  }
});

test("a mixed basket warns about colouring books before storybooks", () => {
  const now = new Date("2026-12-09T12:00:00Z");
  assert.equal(christmasDelivery("print", "colouring_storybook", now)?.late, true);
  assert.equal(christmasDelivery("print", "storybook", now)?.late, false);
  // Existing 'gift' means a physical hardcover, not the future gift card.
  assert.equal(christmasDelivery("gift", "storybook", new Date("2026-12-13T00:00:00Z"))?.late, true);
});

test("digital editions have no postal deadline and unknown products have no notice", () => {
  const now = new Date("2026-12-24T12:00:00Z");
  const notice = christmasDelivery("digital", "colouring_storybook", now);
  assert.equal(notice?.late, false);
  assert.equal(notice?.cutoff, null);
  assert.match(notice!.message, /once your book is finished/);
  assert.equal(christmasDelivery("unknown", "storybook", now), null);
});

test("central configuration updates checkout and email copy and switch-off", () => {
  const original = { ...CHRISTMAS };
  try {
    CHRISTMAS.printCutoff = "2026-12-15T23:59:00Z";
    CHRISTMAS.colouringCutoff = "2026-12-11T23:59:00Z";
    const now = new Date("2026-12-10T12:00:00Z");
    assert.match(christmasDelivery("print", "storybook", now)!.message, /15 December/);
    assert.match(christmasDelivery("print", "colouring_storybook", now)!.message, /11 December/);
    assert.equal(christmasDelivery("print", "storybook", new Date(CHRISTMAS.endsAt)), null);
    CHRISTMAS.enabled = false;
    assert.equal(christmasDelivery("print", "storybook", now), null);
  } finally { Object.assign(CHRISTMAS, original); }
});

test("estimates do not invent a Lulu arrival date or guarantee Christmas delivery", () => {
  const now = new Date("2026-11-08T12:00:00Z");
  assert.match(christmasDelivery("print", "colouring_storybook", now)!.estimate, /estimate is not available/);
  assert.match(christmasDelivery("print", "storybook", now)!.estimate, /not a Christmas delivery guarantee/);
  assert.doesNotMatch(JSON.stringify(christmasDelivery("print", "storybook", now)), /—/);
});
