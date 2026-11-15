import { NextResponse } from 'next/server';
import { withAccess } from '@/lib/authz';
import { sendCardsApprovedReport } from '@/lib/emails/sendCardsReport';
import { confirmLocations } from '@/lib/locations/confirmLocations';

async function _POST(_req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  try {
    const result = await confirmLocations(id);
    // Usage and cost report to Katy. Never throws; deduped per set of pictures.
    if (result.ok) await sendCardsApprovedReport(id, 'locations');
    return NextResponse.json(result.ok ? result : {
      error: 'Generate and approve every location image before continuing.',
      missing: result.missing,
    }, { status: result.ok ? 200 : 409 });
  } catch (error) {
    console.error('Confirm cast failed', error);
    return NextResponse.json({ error: 'Could not save your approvals. Please try again.' }, { status: 500 });
  }
}
export const POST = withAccess({ story: { param: 'id' } }, _POST);
