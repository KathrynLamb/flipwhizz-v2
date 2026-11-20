// src/lib/paypalErrors.ts
//
// The pure half of PayPal error handling: no env, no fetch, so it can be unit
// tested (tests/paypal-errors.test.ts) and imported by client components.

/** Thrown by src/lib/paypal.ts when PayPal's REST API answers with an error. */
export class PaypalApiError extends Error {
  readonly issue: string | null;
  readonly debugId: string | null;
  readonly status: number | null;

  constructor(message: string, opts: { issue?: string | null; debugId?: string | null; status?: number | null } = {}) {
    super(message);
    this.name = "PaypalApiError";
    this.issue = opts.issue ?? null;
    this.debugId = opts.debugId ?? null;
    this.status = opts.status ?? null;
  }
}

/** PayPal error bodies put the machine-readable reason in details[0].issue. */
export function paypalIssue(body: unknown): string | null {
  const details = (body as { details?: Array<{ issue?: unknown }> } | null)?.details;
  const issue = Array.isArray(details) ? details[0]?.issue : null;
  return typeof issue === "string" && issue ? issue : null;
}

export function paypalErrorFromBody(fallback: string, body: unknown, status: number): PaypalApiError {
  const b = body as { message?: unknown; debug_id?: unknown } | null;
  return new PaypalApiError(typeof b?.message === "string" && b.message ? b.message : fallback, {
    issue: paypalIssue(body),
    debugId: typeof b?.debug_id === "string" ? b.debug_id : null,
    status,
  });
}

// PayPal's advice for INSTRUMENT_DECLINED is to call actions.restart() so the
// buyer can pick another card or their balance on the same order.
const RESTARTABLE_DECLINES = new Set(["INSTRUMENT_DECLINED"]);

export function isRestartableDecline(err: unknown): boolean {
  return err instanceof PaypalApiError && !!err.issue && RESTARTABLE_DECLINES.has(err.issue);
}

export const DECLINED_MESSAGE =
  "Your bank or card declined that payment, and nothing was taken. Please try another card or your PayPal balance. If it keeps happening, your bank's app usually has a button to approve the payment.";

export type BrowserInfo = {
  device: "iPhone" | "iPad" | "Android" | "Mac" | "Windows" | "other";
  browser: string;
  /** Set when the page is open inside another app's built-in browser. */
  inApp: string | null;
};

// Built-in browsers that identify themselves in the user agent. Gmail and
// WhatsApp on iPhone use Safari's own view and can't be told apart from Safari.
const IN_APP: Array<[RegExp, string]> = [
  [/FBAN|FBAV|FB_IAB/, "Facebook"],
  [/Instagram/, "Instagram"],
  [/musical_ly|BytedanceWebview|TikTok/i, "TikTok"],
  [/\bGSA\//, "Google app"],
  [/\bLine\//, "LINE"],
  [/Snapchat/, "Snapchat"],
  [/Pinterest/, "Pinterest"],
  [/; wv\)/, "Android app web view"],
];

export function describeBrowser(ua: string | null | undefined): BrowserInfo {
  const s = ua ?? "";
  const device: BrowserInfo["device"] =
    /iPhone/.test(s) ? "iPhone" : /iPad/.test(s) ? "iPad" : /Android/.test(s) ? "Android"
    : /Macintosh/.test(s) ? "Mac" : /Windows/.test(s) ? "Windows" : "other";
  const inApp = IN_APP.find(([re]) => re.test(s))?.[1] ?? null;
  const browser =
    /EdgA?\//.test(s) ? "Edge"
    : /CriOS|Chrome\//.test(s) ? "Chrome"
    : /FxiOS|Firefox\//.test(s) ? "Firefox"
    : /SamsungBrowser/.test(s) ? "Samsung Internet"
    : /Safari\//.test(s) ? "Safari"
    : "unknown";
  return { device, browser, inApp };
}

export function browserSummary(ua: string | null | undefined): string {
  const b = describeBrowser(ua);
  return b.inApp ? `${b.device}, inside ${b.inApp}` : `${b.device}, ${b.browser}`;
}
