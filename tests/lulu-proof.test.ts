import test from 'node:test';
import assert from 'node:assert/strict';
import { signProofQuote, readProofQuote, requireProofConfiguration, type ProofQuote } from '../src/lib/lulu/proof';
import { luluPrintEnabled } from '../src/lib/lulu/client';
test('proof quotes bind admin, files, address and amount; reject tampering and expiry', () => {
  const keys = ['NEXTAUTH_SECRET', 'LULU_COLOURING_POD_PACKAGE_ID', 'LULU_ENVIRONMENT', 'LULU_CLIENT_KEY', 'LULU_CLIENT_SECRET', 'LULU_CONTACT_EMAIL', 'LULU_PRINT_ENABLED'];
  const old = keys.map(k => process.env[k]);
  try {
    Object.assign(process.env, { NEXTAUTH_SECRET: 'test-secret-only', LULU_COLOURING_POD_PACKAGE_ID: '0850X0850.BW.STD.CO.060UW444.MXX', LULU_ENVIRONMENT: 'production', LULU_CLIENT_KEY: 'test', LULU_CLIENT_SECRET: 'test', LULU_CONTACT_EMAIL: 'test@example.com', LULU_PRINT_ENABLED: 'false' });
    assert.doesNotThrow(requireProofConfiguration);
    assert.equal(luluPrintEnabled(), false);
    const q: ProofQuote = { userId: 'admin1', storyId: 'story1', expiresAt: Date.now() + 10000, address: { firstName: 'Test', lastName: 'Reader', addressLine1: '1 Test Road', city: 'York', countryIsoCode: 'GB', postCode: 'TEST', email: 'test@example.com', phone: '01234567890' }, shippingLevel: 'MAIL', total: '10.00', currency: 'GBP', files: { interiorUrl: 'https://example.com/interior.pdf', coverUrl: 'https://example.com/cover.pdf', pageCount: 32, podPackageId: process.env.LULU_COLOURING_POD_PACKAGE_ID! } };
    const token = signProofQuote(q);
    assert.deepEqual(readProofQuote(token, 'admin1'), q);
    assert.throws(() => readProofQuote(token, 'admin2'));
    assert.throws(() => readProofQuote(token + 'x', 'admin1'));
    const altered = Buffer.from(JSON.stringify({ ...q, total: '1.00' })).toString('base64url') + '.' + token.split('.')[1];
    assert.throws(() => readProofQuote(altered, 'admin1'));
    assert.throws(() => readProofQuote(signProofQuote({ ...q, expiresAt: Date.now() - 1 }), 'admin1'));
    process.env.LULU_ENVIRONMENT = 'sandbox';
    assert.throws(requireProofConfiguration, /production/);
  } finally { keys.forEach((key, i) => { if (old[i] === undefined) delete process.env[key]; else process.env[key] = old[i]; }); }
});
