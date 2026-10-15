'use client';
import { useRef, useState } from 'react';
import type { ProofQuote } from '@/lib/lulu/proof';
import type { ShippingAddress } from '@/lib/lulu/contract';
const fields: [keyof ShippingAddress, string, boolean][] = [
  ['firstName', 'First name', true], ['lastName', 'Last name', true], ['addressLine1', 'Address line 1', true], ['addressLine2', 'Address line 2', false], ['city', 'City', true], ['state', 'State / province code (if required)', false], ['postCode', 'Postcode', true], ['countryIsoCode', 'Country code (e.g. GB)', true], ['email', 'Email', true], ['phone', 'Phone', true],
];
export default function ProofClient({ configurationError }: { configurationError: string }) {
  const [storyId, setStoryId] = useState('');
  const [address, setAddress] = useState<ShippingAddress>({ firstName: '', lastName: '', addressLine1: '', city: '', postCode: '', countryIsoCode: 'GB', email: '', phone: '' });
  const [shippingLevel, setShippingLevel] = useState('MAIL');
  const [prepared, setPrepared] = useState<{ quote: ProofQuote; token: string } | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const running = useRef(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState('');
  function invalidate() { setPrepared(null); setConfirmed(false); setResult(''); }
  async function run(action: 'quote' | 'submit') {
    if (running.current) return;
    running.current = true; setBusy(true); setError('');
    if (action === 'quote') invalidate();
    try {
      const response = await fetch('/api/admin/lulu/proof', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(action === 'quote' ? { action, storyId: storyId.trim(), address, shippingLevel } : { action, token: prepared?.token, confirm: confirmed }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Request failed');
      if (action === 'quote') setPrepared(data);
      else { setResult(`Order ${data.orderId}: ${data.status}. Check the Lulu production dashboard for payment and fulfilment status. Do not submit another order if this one is pending.`); setPrepared(null); setConfirmed(false); }
    } catch (err) { setError(err instanceof Error ? err.message : 'Request failed'); }
    finally { setBusy(false); running.current = false; }
  }
  const input = 'mt-1 block w-full rounded-lg border border-white/20 bg-slate-900 p-3 text-white';
  const button = 'rounded-lg bg-violet-600 px-5 py-3 font-semibold text-white disabled:opacity-40';
  return <div className="max-w-3xl space-y-6 text-slate-200">
    <p>This orders one real coil-bound book from Lulu, charged to your Lulu account. It does not take another PayPal payment. Get a quote first, review both PDFs, then explicitly submit the order.</p>
    {configurationError && <p role="alert" className="text-rose-300">{configurationError}</p>}
    <form onSubmit={event => { event.preventDefault(); void run('quote'); }} className="space-y-4">
      <fieldset disabled={busy || !!configurationError} className="space-y-4">
        <label className="block">Story ID<input required value={storyId} onChange={event => { setStoryId(event.target.value); invalidate(); }} className={input} /></label>
        <div className="grid gap-4 sm:grid-cols-2">{fields.map(([key, label, required]) => <label key={key} className="block">{label}<input required={required} type={key === 'email' ? 'email' : key === 'phone' ? 'tel' : 'text'} maxLength={key === 'countryIsoCode' ? 2 : 200} value={address[key] ?? ''} onChange={event => { setAddress(previous => ({ ...previous, [key]: event.target.value })); invalidate(); }} className={input} /></label>)}</div>
        <label className="block">Shipping method<select value={shippingLevel} onChange={event => { setShippingLevel(event.target.value); invalidate(); }} className={input}>{['MAIL', 'PRIORITY_MAIL', 'GROUND', 'EXPEDITED', 'EXPRESS'].map(level => <option key={level}>{level}</option>)}</select></label>
        <p className="text-sm text-slate-400">Availability depends on the delivery address. MAIL is the slowest service and may be untracked. If Lulu rejects a service, choose another.</p>
        <button className={button} type="submit">Prepare PDFs and get Lulu quote</button>
      </fieldset>
    </form>
    {busy && <p role="status">Working… keep this page open. Preparing PDFs can take several minutes.</p>}
    {error && <p role="alert" className="text-rose-300">{error}</p>}
    {result && <p role="status" className="text-emerald-300">{result}</p>}
    {prepared && <section className="space-y-4 rounded-xl border border-white/20 p-5">
      <h2 className="text-xl font-semibold">One proof copy: {prepared.quote.total} {prepared.quote.currency}</h2>
      <p>Lulu’s quoted total includes printing, shipping and tax. Quote expires after 15 minutes. Final production checks happen at Lulu after submission.</p>
      <p>{prepared.quote.files.pageCount} interior pages · {prepared.quote.shippingLevel}</p>
      <div className="flex gap-5"><a className="underline" href={prepared.quote.files.interiorUrl} target="_blank" rel="noreferrer">Review interior PDF</a><a className="underline" href={prepared.quote.files.coverUrl} target="_blank" rel="noreferrer">Review cover PDF</a></div>
      <label className="flex gap-3"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} disabled={busy} /><span>I reviewed the PDFs and address and authorise one real Lulu print order at the quoted total. Lulu may charge my saved payment method automatically.</span></label>
      <button type="button" className={button} disabled={busy || !confirmed} onClick={() => void run('submit')}>Submit one real proof order</button>
    </section>}
  </div>;
}
