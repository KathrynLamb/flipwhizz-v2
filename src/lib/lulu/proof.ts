import { createHmac, timingSafeEqual } from 'node:crypto';
import { colouringPodPackageId } from './client';
import type { ShippingAddress } from './contract';

export const PROOF_SHIPPING = ['MAIL', 'PRIORITY_MAIL', 'GROUND', 'EXPEDITED', 'EXPRESS'] as const;
export type ProofQuote = {
  userId: string; storyId: string; expiresAt: number; address: ShippingAddress;
  shippingLevel: string; total: string; currency: string;
  files: { interiorUrl: string; coverUrl: string; podPackageId: string; pageCount: number };
};
export function requireProofConfiguration() {
  if (process.env.LULU_ENVIRONMENT !== 'production') throw new Error('Set LULU_ENVIRONMENT=production and use production Lulu credentials.');
  const missing = ['LULU_CLIENT_KEY', 'LULU_CLIENT_SECRET', 'LULU_CONTACT_EMAIL'].filter(key => !process.env[key]?.trim());
  if (missing.length) throw new Error(`Missing in this running deployment: ${missing.join(', ')}. Add these exact names to flipwhizz-v2 → Production in Vercel, then redeploy.`);
  colouringPodPackageId();
  if (!process.env.NEXTAUTH_SECRET) throw new Error('NEXTAUTH_SECRET is required to secure proof quotes.');
}
function signature(payload: string) {
  if (!process.env.NEXTAUTH_SECRET) throw new Error('Missing signing configuration');
  return createHmac('sha256', process.env.NEXTAUTH_SECRET).update('lulu-proof-v1:' + payload).digest('base64url');
}
export function signProofQuote(quote: ProofQuote) {
  const payload = Buffer.from(JSON.stringify(quote)).toString('base64url');
  return `${payload}.${signature(payload)}`;
}
export function readProofQuote(token: string, userId: string): ProofQuote {
  if (typeof token !== 'string' || token.length > 20000) throw new Error('Invalid proof quote');
  const [payload, supplied, extra] = token.split('.');
  if (!payload || !supplied || extra) throw new Error('Invalid proof quote');
  const expected = Buffer.from(signature(payload));
  const actual = Buffer.from(supplied);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new Error('Invalid proof quote');
  const quote = JSON.parse(Buffer.from(payload, 'base64url').toString()) as ProofQuote;
  if (quote.userId !== userId || !Number.isFinite(quote.expiresAt) || quote.expiresAt < Date.now()) throw new Error('This quote has expired or belongs to another admin. Get a new quote.');
  if (quote.files.podPackageId !== colouringPodPackageId()) throw new Error('The print product changed. Get a new quote.');
  return quote;
}
