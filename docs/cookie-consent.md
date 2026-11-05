# Cookie consent and analytics

PostHog initializes only after an explicit, current analytics choice. Do not initialize it in instrumentation-client.ts or add analytics scripts outside this boundary. Page views are sent once per pathname transition, including the page on which consent is granted. Earlier visits are not replayed. Rejection keeps sign-in and checkout available.

The versioned fw_consent cookie lasts 180 days. Optional analytics and tawk.to chat are separate choices. The footer and persistent settings button reopen preferences. Withdrawing chat reloads the page because removing a script element does not stop already-running third-party code.

NEXT_PUBLIC_POSTHOG_KEY must contain the existing project's public ingestion key at build time. The existing /ingest proxy and EU PostHog project are reused. No new paid service is introduced. Without the key the banner works, but analytics remains disabled.

Browser and server event properties use an explicit allowlist. Names, emails, story contents, nested person properties, query strings and private URL resource IDs are omitted. Autocapture, session replay, automatic exception collection and surveys are disabled. Signed-in accounts use an internal user ID to link consented conversion events; this is pseudonymous, not anonymous.

Server analytics requires a valid consent cookie in request context. Background analytics without visitor consent is skipped; operational logging and alert emails still function. Analytics failures do not block customer actions.

Validation: node --import tsx --test tests/cookie-consent.test.ts

Before release, verify in a fresh browser: no /ingest or tawk.to requests before consent; reject and navigate; accept analytics and navigate; reload with saved preferences; revoke analytics; test chat separately; check mobile layout and keyboard access. Confirm pageview and conversion events in the existing PostHog dashboard.
