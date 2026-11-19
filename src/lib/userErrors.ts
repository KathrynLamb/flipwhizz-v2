// src/lib/userErrors.ts
//
// Keeps technical errors away from customers. Safe to import from both
// server and client code (no server-only imports).
//
// - looksTechnical(): is this message something a customer should never see?
// - isBillingOrQuotaError(): is this a site-wide billing / quota problem?
// - friendlyMessage(): the calm message to show instead.
// - reportClientError(): send the real error to Katy via /api/alerts/client.

export const FRIENDLY_RETRY_MESSAGE =
  "Sorry, that didn't work on our side. We've been notified and we're on it. Please try again in a few minutes.";

export const FRIENDLY_BUSY_MESSAGE =
  "Our picture studio is having a short break. We've been notified and we're fixing it. Please try again in a few minutes.";

const BILLING_OR_QUOTA_RE =
  /quota|resource[_ ]?exhausted|rate[ -]?limit|billing|outstanding balance|payment (?:required|method)|\b402\b|\b429\b|exceeded your current/i;

const TECHNICAL_RE =
  /firebase|storage\/|googleapis|generativelanguage|gemini|cloudinary|anthropic|openai|resend|drizzle|postgres|sql|neon|inngest|vercel|"code"\s*:|\{\s*"|\bECONN|ETIMEDOUT|ENOTFOUND|fetch failed|failed to fetch|networkerror|load failed|internal server error|typeerror|referenceerror|syntaxerror|cannot read propert|undefined|\bnull\b|unexpected token|stack|\bat \/|https?:\/\/|\b5\d\d\b|\b4(?:01|03|29)\b/i;

export function errorMessageOf(error: unknown): string {
  if (!error) return "";
  if (error instanceof Error) return error.message || "";
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

export function isBillingOrQuotaError(error: unknown): boolean {
  return BILLING_OR_QUOTA_RE.test(errorMessageOf(error));
}

// Account-level blocks that no retry can fix: prepaid credits gone, billing
// off, or the monthly spending cap reached (Google sends that one as a 429
// RESOURCE_EXHAUSTED, so it looks like a rate limit unless we check the text).
const BILLING_BLOCKED_RE =
  /"code"\s*:\s*402|prepayment credits|credits are depleted|billing (?:is )?(?:not enabled|disabled)|payment required|outstanding balance|spending cap|spend cap|exceeded its monthly/i;

/**
 * The Gemini account itself can't pay. Retrying can't fix this; only raising
 * the cap or topping up can. Every customer is blocked until then.
 */
export function isBillingBlocked(error: unknown): boolean {
  const status = (error as { status?: unknown; code?: unknown } | null)?.status ?? (error as { code?: unknown } | null)?.code;
  return Number(status) === 402 || BILLING_BLOCKED_RE.test(errorMessageOf(error));
}

/** True when a message is raw/technical and must not be shown to a customer. */
export function looksTechnical(message: string | null | undefined): boolean {
  if (!message) return true;
  const m = message.trim();
  if (!m) return true;
  if (m.length > 240) return true;
  return TECHNICAL_RE.test(m);
}

/** The message a customer should see for this error. */
export function friendlyMessage(error: unknown, fallback = FRIENDLY_RETRY_MESSAGE): string {
  const message = errorMessageOf(error);
  if (isBillingOrQuotaError(message)) return FRIENDLY_BUSY_MESSAGE;
  if (looksTechnical(message)) return fallback;
  return message;
}

/**
 * Browser only. Sends the real error to Katy. Never throws, never blocks.
 * `kind` must be in ALLOWED_KINDS in src/app/api/alerts/client/route.ts.
 */
export function reportClientError(
  kind: string,
  details: {
    error: unknown;
    storyId?: string | null;
    characterId?: string | null;
    action?: string | null;
    /** HTTP status, or null when no response came back at all */
    status?: number | null;
    /** True when the request never got a response (connection dropped, tab suspended) */
    network?: boolean;
    /** How long the request ran before it failed */
    elapsedMs?: number | null;
  },
): void {
  try {
    if (typeof window === "undefined") return;
    void fetch("/api/alerts/client", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        kind,
        message: errorMessageOf(details.error).slice(0, 1000),
        storyId: details.storyId ?? null,
        characterId: details.characterId ?? null,
        action: details.action ?? null,
        page: window.location.pathname,
        status: typeof details.status === "number" ? details.status : null,
        network: details.network === true,
        elapsedMs: typeof details.elapsedMs === "number" ? Math.round(details.elapsedMs) : null,
        online: typeof navigator !== "undefined" ? navigator.onLine : null,
        visibility: typeof document !== "undefined" ? document.visibilityState : null,
      }),
    }).catch(() => {});
  } catch {
    /* never let reporting break the page */
  }
}
