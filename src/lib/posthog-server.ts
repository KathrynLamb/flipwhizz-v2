import { PostHog } from 'posthog-node';
import { cookies } from 'next/headers';
import { CONSENT_COOKIE, parseConsent, safeAnalyticsProperties } from './cookie-consent';

export async function captureServerEvent(distinctId: string, event: string, properties?: Record<string, unknown>) {
  // Background jobs have no visitor consent. Operational emails/logs remain separate.
  try {
    const consent = parseConsent((await cookies()).get(CONSENT_COOKIE)?.value);
    if (!consent?.analytics || !process.env.NEXT_PUBLIC_POSTHOG_KEY) return;
    const client = new PostHog(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
      host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://eu.i.posthog.com',
      flushAt: 1, flushInterval: 0,
    });
    client.capture({ distinctId, event, properties: safeAnalyticsProperties(properties) });
    await client.shutdown();
  } catch {
    // Analytics must never prevent registration, payment or book creation.
  }
}
