// One versioned, essential preference cookie is shared by browser and API routes.
export const CONSENT_COOKIE = 'fw_consent';
export const CONSENT_MAX_AGE = 60 * 60 * 24 * 180;
export type CookieConsent = { version: 1; analytics: boolean; chat: boolean; savedAt: number };
export function parseConsent(value?: string | null): CookieConsent | null {
  try {
    const c = JSON.parse(decodeURIComponent(value || ''));
    return c.version === 1 && typeof c.analytics === 'boolean' && typeof c.chat === 'boolean'
      && Number.isFinite(c.savedAt) && c.savedAt <= Date.now()
      && Date.now() - c.savedAt < CONSENT_MAX_AGE * 1000 ? c : null;
  } catch { return null; }
}
export function readConsent(): CookieConsent | null {
  if (typeof document === 'undefined') return null;
  return parseConsent(document.cookie.split('; ').find(c => c.startsWith(CONSENT_COOKIE + '='))?.slice(CONSENT_COOKIE.length + 1));
}
// Never send URL query strings, fragments, or private resource IDs to analytics.
export function analyticsPath(path: string): string {
  return path.split(/[?#]/)[0]
    .replace(/\/(stories|projects|characters|locations|orders|series)\/[^/]+/g, (match, group) =>
      /\/(create|new)$/.test(match) ? match : `/${group}/[id]`)
    .replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, '[id]');
}
const SAFE_PROPERTIES = new Set(['distinct_id', '$device_id', '$session_id', '$window_id', '$lib', '$lib_version', '$browser', '$browser_version', '$os', '$os_version', '$device_type', '$screen_height', '$screen_width', '$viewport_height', '$viewport_width', '$insert_id', '$time', '$process_person_profile', '$is_identified', 'method', 'position', 'mode', 'product_type', 'is_upgrade', 'amount', 'currency', 'page_count', 'message_count', 'image_count', 'book_number', 'insights_count', 'via', 'purchase_intent']);
export function safeAnalyticsProperties(properties: Record<string, unknown> = {}) {
  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(properties)) {
    if (SAFE_PROPERTIES.has(key) && ['string', 'number', 'boolean'].includes(typeof value)) safe[key] = value;
    if (key === '$pathname' && typeof value === 'string') safe[key] = analyticsPath(value);
    if (key === '$current_url' && typeof value === 'string') {
      try { const url = new URL(value); safe[key] = url.origin + analyticsPath(url.pathname); } catch { /* omit malformed URL */ }
    }
  }
  return safe;
}
