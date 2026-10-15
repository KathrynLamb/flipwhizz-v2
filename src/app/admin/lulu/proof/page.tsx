import { requireAdminPage } from '@/lib/pageGuards';
import { PageHeader } from '../../ui';
import ProofClient from './ProofClient';
import { requireProofConfiguration } from '@/lib/lulu/proof';
export const dynamic = 'force-dynamic';
export default async function ProofPage() {
  await requireAdminPage();
  let configurationError = '';
  try { requireProofConfiguration(); } catch (error) { configurationError = error instanceof Error ? error.message : 'Check Lulu configuration'; }
  const keys = ['LULU_ENVIRONMENT', 'LULU_CLIENT_KEY', 'LULU_CLIENT_SECRET', 'LULU_CONTACT_EMAIL', 'LULU_COLOURING_POD_PACKAGE_ID', 'NEXTAUTH_SECRET'];
  return <><PageHeader title="Order one Lulu proof copy" subtitle="Admin only. Customer printing stays controlled by the public launch switch." /><section className="mb-6 rounded-xl border border-white/20 p-5 text-slate-200">
    <h2 className="mb-3 font-semibold">Configuration visible to this deployment</h2>
    <p className="mb-3 text-sm">Vercel environment: {process.env.VERCEL_ENV ?? 'Local'} · Build: {process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'Unknown'} · Lulu: {process.env.LULU_ENVIRONMENT ?? 'Not configured'}</p>
    <ul className="space-y-1 text-sm">{keys.map(key => <li key={key}>{process.env[key]?.trim() ? 'Present' : 'MISSING'} — {key}</li>)}</ul>
    <p className="mt-3 text-sm text-slate-400">Presence checks only; secret values are never displayed. This does not verify Lulu authentication.</p>
  </section><ProofClient configurationError={configurationError} /></>;
}
