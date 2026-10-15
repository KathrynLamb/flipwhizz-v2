import { NextResponse } from 'next/server';
import { getAuthUser, withAccess } from '@/lib/authz';
import { db } from '@/db';
import { stories, storyProducts } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { buildColouringFiles } from '@/lib/lulu/export';
import { luluClient } from '@/lib/lulu/client';
import { luluShippingAddress } from '@/lib/lulu/contract';
import { PROOF_SHIPPING, requireProofConfiguration, signProofQuote, readProofQuote } from '@/lib/lulu/proof';
import { submitColouringOrder } from '@/lib/lulu/order';
export const runtime = 'nodejs';
export const maxDuration = 300;
export const dynamic = 'force-dynamic';
async function run(req: Request) {
  try {
    requireProofConfiguration();
    const user = await getAuthUser();
    if (!user?.isAdmin) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const body = await req.json();
    if (body.action === 'submit') {
      if (body.confirm !== true) throw new Error('Confirm the real print order before submitting.');
      const quote = readProofQuote(body.token, user.id);
      const result = await submitColouringOrder(quote.storyId, quote.address, body.token);
      return NextResponse.json(result);
    }
    if (body.action !== 'quote') throw new Error('Unknown action');
    if (typeof body.storyId !== 'string' || !/^[a-f0-9-]{36}$/i.test(body.storyId)) throw new Error('Enter a valid story ID.');
    if (!PROOF_SHIPPING.includes(body.shippingLevel)) throw new Error('Choose a shipping method.');
    const shipping = luluShippingAddress(body.address);
    const story = await db.query.stories.findFirst({ where: eq(stories.id, body.storyId) });
    const product = await db.query.storyProducts.findFirst({ where: eq(storyProducts.storyId, body.storyId) });
    if (story?.bookType !== 'colouring_storybook' || story.paymentStatus !== 'paid' || !story.paymentId || product?.productType !== 'print') throw new Error('Choose a paid colouring print book (a completed promo checkout also qualifies).');
    const files = await buildColouringFiles(body.storyId, true, false);
    if (!files.coverUrl || !files.podPackageId) throw new Error('Print files were not prepared.');
    const cost = await luluClient().request<{ total_cost_incl_tax: string; currency: string }>('/print-job-cost-calculations/', {
      line_items: [{ page_count: files.pageCount, pod_package_id: files.podPackageId, quantity: 1 }],
      shipping_address: shipping, shipping_option: body.shippingLevel,
    });
    if (!/^\d+(\.\d+)?$/.test(String(cost.total_cost_incl_tax)) || Number(cost.total_cost_incl_tax) <= 0 || !/^[A-Z]{3}$/.test(cost.currency)) throw new Error('Lulu did not return a usable total. No order was placed.');
    const quote = { userId: user.id, storyId: body.storyId, expiresAt: Date.now() + 15 * 60 * 1000, address: body.address, shippingLevel: body.shippingLevel, total: cost.total_cost_incl_tax, currency: cost.currency, files: { interiorUrl: files.interiorUrl, coverUrl: files.coverUrl, podPackageId: files.podPackageId, pageCount: files.pageCount } };
    return NextResponse.json({ quote, token: signProofQuote(quote) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Proof request failed' }, { status: 400 });
  }
}
export const POST = withAccess({ admin: true }, run);
