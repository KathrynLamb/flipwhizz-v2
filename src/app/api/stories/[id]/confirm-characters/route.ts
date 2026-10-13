import { NextResponse } from 'next/server';
import { withAccess } from '@/lib/authz';
import { confirmCast } from '@/lib/characters/confirmCast';

async function _POST(_req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  try {
    const result = await confirmCast(id);
    return NextResponse.json(result.ok ? result : {
      error: 'Generate and approve every character appearance before continuing.',
      missing: result.missing,
    }, { status: result.ok ? 200 : 409 });
  } catch (error) {
    console.error('Confirm cast failed', error);
    return NextResponse.json({ error: 'Could not save your approvals. Please try again.' }, { status: 500 });
  }
}
export const POST = withAccess({ story: { param: 'id' } }, _POST);
