import { requireAdminPage } from '@/lib/pageGuards';
import { PageHeader } from '../ui';
import LuluTestClient from './LuluTestClient';

export const dynamic = 'force-dynamic';
export default async function LuluTestPage() {
  await requireAdminPage();
  const keys = ['LULU_ENVIRONMENT', 'LULU_CLIENT_KEY', 'LULU_CLIENT_SECRET', 'LULU_COLOURING_POD_PACKAGE_ID'];
  return <>
    <PageHeader title="Lulu sandbox checks" subtitle="Check the connection and print files before enabling customer orders. These buttons never place an order." />
    <LuluTestClient environment={process.env.LULU_ENVIRONMENT ?? 'Not configured'} configured={keys.map(key => ({ key, present: Boolean(process.env[key]) }))} />
  </>;
}
