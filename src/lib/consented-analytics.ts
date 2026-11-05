import posthog from 'posthog-js';
import { readConsent, safeAnalyticsProperties } from './cookie-consent';
let initialized = false;
export function enableAnalytics() {
  if (!readConsent()?.analytics || !process.env.NEXT_PUBLIC_POSTHOG_KEY) return false;
  if (!initialized) {
    posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
      api_host: '/ingest', ui_host: 'https://eu.posthog.com',
      capture_pageview: false, capture_pageleave: false, autocapture: false,
      capture_exceptions: false, disable_session_recording: true,
      disable_surveys: true, advanced_disable_feature_flags: true,
      person_profiles: 'identified_only', cookie_expiration: 180,
      before_send: (event) => {
        if (!event || !readConsent()?.analytics || event.event === '$exception') return null;
        event.properties = safeAnalyticsProperties(event.properties);
        return event;
      },
    });
    initialized = true;
  }
  posthog.opt_in_capturing({ captureEventName: false });
  return true;
}
export function disableAnalytics() {
  if (initialized) posthog.opt_out_capturing();
}
