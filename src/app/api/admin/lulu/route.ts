import { NextResponse } from 'next/server';
import { withAccess } from '@/lib/authz';
import { luluClient, colouringPodPackageId } from '@/lib/lulu/client';
import { requireLuluSandbox, validationPath } from '@/lib/lulu/sandbox';
import { buildColouringFiles } from '@/lib/lulu/export';

export const runtime = 'nodejs';
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

async function run(req: Request) {
  try {
    requireLuluSandbox();
    const body = await req.json();
    const client = luluClient();
    if (body.action === 'connection') {
      // Authenticated read only. Never return the account's print jobs or tokens.
      await client.request('/print-jobs/?page_size=1');
      let packageError: string | null = null;
      try { colouringPodPackageId(); } catch (error) { packageError = error instanceof Error ? error.message : 'Invalid print package'; }
      return NextResponse.json({ message: 'Connected to Lulu sandbox.', packageError });
    }
    if (body.action === 'status') {
      const result = await client.request(validationPath(body.kind, body.id));
      return NextResponse.json({ result });
    }
    if (body.action === 'validate') {
      if (typeof body.storyId !== 'string' || !/^[a-f0-9-]{36}$/i.test(body.storyId)) return NextResponse.json({ error: 'Enter a valid story ID.' }, { status: 400 });
      // Do not overwrite saved production export pointers with sandbox results.
      const files = await buildColouringFiles(body.storyId, true, false);
      const results = await Promise.allSettled([
        client.validateInterior(files.interiorUrl, files.podPackageId!),
        client.validateCover(files.coverUrl!, files.podPackageId!, files.pageCount),
      ]);
      const validations = results.map((result, i) => ({
        kind: i === 0 ? 'interior' : 'cover',
        ...(result.status === 'fulfilled' ? { result: result.value } : { error: result.reason instanceof Error ? result.reason.message : 'Validation request failed' }),
      }));
      return NextResponse.json({ files: { interiorUrl: files.interiorUrl, coverUrl: files.coverUrl, pageCount: files.pageCount, podPackageId: files.podPackageId }, validations });
    }
    return NextResponse.json({ error: 'Unknown test action' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Lulu check failed' }, { status: 400 });
  }
}
export const POST = withAccess({ admin: true }, run);
