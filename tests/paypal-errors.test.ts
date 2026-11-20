// tests/paypal-errors.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import {
  PaypalApiError,
  browserSummary,
  describeBrowser,
  isRestartableDecline,
  paypalErrorFromBody,
  paypalIssue,
} from "../src/lib/paypalErrors";

// Shape of PayPal's 422 when the bank declines at capture (Georgeta, 19 Nov).
const declined = {
  name: "UNPROCESSABLE_ENTITY",
  details: [{ issue: "INSTRUMENT_DECLINED", description: "The instrument presented was either declined by the processor or bank, or it can't be used for this payment." }],
  message: "The requested action could not be performed, semantically incorrect, or failed business validation.",
  debug_id: "abc123",
};

test("reads the issue code from a PayPal error body", () => {
  assert.equal(paypalIssue(declined), "INSTRUMENT_DECLINED");
  assert.equal(paypalIssue({}), null);
  assert.equal(paypalIssue(null), null);
  assert.equal(paypalIssue({ details: "nope" }), null);
});

test("builds a structured error that keeps PayPal's message, issue and debug id", () => {
  const err = paypalErrorFromBody("Failed to capture PayPal order", declined, 422);
  assert.ok(err instanceof PaypalApiError);
  assert.equal(err.message, declined.message);
  assert.equal(err.issue, "INSTRUMENT_DECLINED");
  assert.equal(err.debugId, "abc123");
  assert.equal(err.status, 422);
  assert.equal(paypalErrorFromBody("Fallback", {}, 500).message, "Fallback");
});

test("only a card decline restarts PayPal; other failures stay errors", () => {
  assert.equal(isRestartableDecline(paypalErrorFromBody("x", declined, 422)), true);
  assert.equal(isRestartableDecline(paypalErrorFromBody("x", { details: [{ issue: "ORDER_ALREADY_CAPTURED" }] }, 422)), false);
  assert.equal(isRestartableDecline(new Error("INSTRUMENT_DECLINED")), false);
  assert.equal(isRestartableDecline(null), false);
});

test("describes phones, browsers and in-app browsers", () => {
  const iphoneSafari = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1";
  const iphoneChrome = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/131.0.0.0 Mobile/15E148 Safari/604.1";
  const iphoneInstagram = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 357.0.0.0";
  const iphoneFacebook = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/490.0.0]";
  const androidWebView = "Mozilla/5.0 (Linux; Android 14; Pixel 8; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/131.0.0.0 Mobile Safari/537.36";
  const macChrome = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

  assert.deepEqual(describeBrowser(iphoneSafari), { device: "iPhone", browser: "Safari", inApp: null });
  assert.deepEqual(describeBrowser(iphoneChrome), { device: "iPhone", browser: "Chrome", inApp: null });
  assert.equal(describeBrowser(iphoneInstagram).inApp, "Instagram");
  assert.equal(describeBrowser(iphoneFacebook).inApp, "Facebook");
  assert.equal(describeBrowser(androidWebView).inApp, "Android app web view");
  assert.equal(browserSummary(macChrome), "Mac, Chrome");
  assert.equal(browserSummary(iphoneInstagram), "iPhone, inside Instagram");
  assert.equal(browserSummary(null), "other, unknown");
});
