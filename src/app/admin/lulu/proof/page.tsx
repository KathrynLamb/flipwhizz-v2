import { requireAdminPage } from '@/lib/pageGuards';
import { PageHeader } from '../../ui';
import ProofClient from './ProofClient';
import { requireProofConfiguration } from '@/lib/lulu/proof';
export const dynamic = 'force-dynamic';
export default async function ProofPage() {
  await requireAdminPage();
  let configurationError = '';
  try { requireProofConfiguration(); } catch (error) { configurationError = error instanceof Error ? error.message : 'Check Lulu configuration'; }
  return <><PageHeader title="Order one Lulu proof copy" subtitle="Admin only. Customer printing stays controlled by the public launch switch." /><ProofClient configurationError={configurationError} /></>;
}
