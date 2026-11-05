import test from 'node:test';
import assert from 'node:assert/strict';
import { parseConsent, CONSENT_MAX_AGE, analyticsPath, safeAnalyticsProperties } from '../src/lib/cookie-consent';

test('only explicit, current, versioned choices are accepted', () => {
  const choice = { version: 1, analytics: true, chat: false, savedAt: Date.now() };
  assert.deepEqual(parseConsent(encodeURIComponent(JSON.stringify(choice))), choice);
  for (const input of [undefined, '', '%bad', '{}', JSON.stringify({ ...choice, version: 2 }), JSON.stringify({ ...choice, analytics: 'true' }), JSON.stringify({ ...choice, savedAt: Date.now() - CONSENT_MAX_AGE * 1000 - 1 }), JSON.stringify({ ...choice, savedAt: Date.now() + 100000 })]) assert.equal(parseConsent(input), null);
  assert.equal(parseConsent(JSON.stringify({ ...choice, analytics: false }))?.analytics, false);
});
test('page views remove private IDs, query strings and fragments', () => {
  assert.equal(analyticsPath('/stories/child-secret/checkout?name=Sophia#photo'), '/stories/[id]/checkout');
  assert.equal(analyticsPath('/projects/create?idea=secret'), '/projects/create');
  assert.equal(analyticsPath('/pricing'), '/pricing');
});
test('event allowlist removes personal content, nested profiles and automatic referrers', () => {
  const properties = safeAnalyticsProperties({ story_title: 'Sophia', reader_name: 'Sophia', payer_email: 'private@example.com', $set: { email: 'private' }, $referrer: 'https://example.com?private', error: 'private', amount: 24.99, currency: 'GBP', $current_url: 'https://flipwhizz.com/stories/secret/hub?name=Sophia', $pathname: '/stories/secret/hub' });
  assert.deepEqual(properties, { amount: 24.99, currency: 'GBP', $current_url: 'https://flipwhizz.com/stories/[id]/hub', $pathname: '/stories/[id]/hub' });
});

test('analytics waits for consent and drops events after withdrawal', async () => {
  const { readFileSync } = await import('node:fs');
  const { runInNewContext } = await import('node:vm');
  const ts = await import('typescript');
  let allowed = false;
  let initCount = 0;
  let optOutCount = 0;
  let config: any;
  const sdk = {
    init: (_key: string, options: unknown) => { initCount++; config = options; },
    opt_in_capturing: () => {},
    opt_out_capturing: () => { optOutCount++; },
  };
  const exports: any = {};
  const source = readFileSync(new URL('../src/lib/consented-analytics.ts', import.meta.url), 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
  runInNewContext(output, { exports, process: { env: { NEXT_PUBLIC_POSTHOG_KEY: 'test' } }, require: (id: string) => id === 'posthog-js' ? sdk : { readConsent: () => ({ analytics: allowed }), safeAnalyticsProperties } });
  assert.equal(exports.enableAnalytics(), false);
  assert.equal(initCount, 0);
  allowed = true;
  assert.equal(exports.enableAnalytics(), true);
  assert.equal(initCount, 1);
  assert.equal(config.autocapture, false);
  assert.equal(config.disable_session_recording, true);
  assert.equal(config.capture_pageview, false);
  assert.deepEqual(config.before_send({ event: 'story_created', properties: { reader_name: 'Private', page_count: 28 } }).properties, { page_count: 28 });
  allowed = false;
  exports.disableAnalytics();
  assert.equal(optOutCount, 1);
  assert.equal(config.before_send({ event: '$pageview', properties: {} }), null);
  assert.equal(exports.enableAnalytics(), false);
  allowed = true;
  exports.enableAnalytics();
  assert.equal(initCount, 1);
});
