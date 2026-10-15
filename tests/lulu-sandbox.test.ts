import test from 'node:test';
import assert from 'node:assert/strict';
import { requireLuluSandbox, validationPath } from '../src/lib/lulu/sandbox';

test('sandbox tools reject production, unset environment and absent credentials', () => {
  const keys = ['LULU_ENVIRONMENT', 'LULU_CLIENT_KEY', 'LULU_CLIENT_SECRET'];
  const old = keys.map(key => process.env[key]);
  try {
    process.env.LULU_CLIENT_KEY = 'test'; process.env.LULU_CLIENT_SECRET = 'test';
    for (const environment of ['production', '', 'invalid']) { process.env.LULU_ENVIRONMENT = environment; assert.throws(requireLuluSandbox, /cannot use production/); }
    process.env.LULU_ENVIRONMENT = 'sandbox'; assert.doesNotThrow(requireLuluSandbox);
    delete process.env.LULU_CLIENT_SECRET; assert.throws(requireLuluSandbox, /Preview/);
  } finally { keys.forEach((key, i) => { if (old[i] === undefined) delete process.env[key]; else process.env[key] = old[i]; }); }
});
test('validation refresh accepts only numeric IDs on validation endpoints', () => {
  assert.equal(validationPath('cover', 1), '/validate-cover/1/');
  assert.equal(validationPath('interior', 42), '/validate-interior/42/');
  for (const id of ['../print-jobs', '1', -1, 0, 1.2, null]) assert.throws(() => validationPath('cover', id));
  assert.throws(() => validationPath('print-jobs', 1));
});
