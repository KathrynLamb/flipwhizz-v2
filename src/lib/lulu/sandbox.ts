export function requireLuluSandbox() {
  if (process.env.LULU_ENVIRONMENT !== 'sandbox') throw new Error('Set LULU_ENVIRONMENT=sandbox on this Preview deployment. This tool cannot use production Lulu.');
  if (!process.env.LULU_CLIENT_KEY || !process.env.LULU_CLIENT_SECRET) throw new Error('Add LULU_CLIENT_KEY and LULU_CLIENT_SECRET to Preview, then redeploy the preview.');
}
export function validationPath(kind: unknown, id: unknown) {
  if ((kind !== 'interior' && kind !== 'cover') || !Number.isSafeInteger(id) || Number(id) <= 0) throw new Error('Invalid validation reference');
  return `/validate-${kind}/${id}/`;
}
