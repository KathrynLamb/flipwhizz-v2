'use client';
import { useRef, useState } from 'react';
import { Card } from '../ui';

type Validation = { kind: string; result?: { id?: number; status?: string; errors?: unknown; [key: string]: unknown }; error?: string };
type Files = { interiorUrl: string; coverUrl: string; pageCount: number; podPackageId: string };
export default function LuluTestClient({ environment, configured }: { environment: string; configured: { key: string; present: boolean }[] }) {
  const [storyId, setStoryId] = useState('');
  const [busy, setBusy] = useState(false);
  const running = useRef(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [files, setFiles] = useState<Files | null>(null);
  const [validations, setValidations] = useState<Validation[]>([]);
  async function run(action: string, validation?: Validation) {
    if (running.current) return;
    running.current = true; setBusy(true); setError(''); setMessage('');
    if (action === 'validate') { setFiles(null); setValidations([]); }
    try {
      const response = await fetch('/api/admin/lulu', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, storyId: storyId.trim(), kind: validation?.kind, id: validation?.result?.id }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'The check failed.');
      if (action === 'connection') { setMessage(data.message); setError(data.packageError ?? ''); }
      if (action === 'validate') { setFiles(data.files); setValidations(data.validations); setMessage('Files exported. Check both validation results below; processing can take a little time.'); }
      if (action === 'status') setValidations(previous => previous.map(item => item.kind === validation?.kind ? { ...item, result: data.result, error: undefined } : item));
    } catch (err) { setError(err instanceof Error ? err.message : 'Please try again.'); }
    finally { setBusy(false); running.current = false; }
  }
  const button = 'rounded-lg bg-violet-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-40';
  return <div className="space-y-5 text-slate-200">
    <Card title="1. Connection">
      <p className="mb-3 text-sm">Lulu environment: <strong>{environment}</strong></p>
      <ul className="mb-4 space-y-1 text-sm">{configured.map(item => <li key={item.key} className="break-all">{item.present ? '✓' : 'Missing:'} {item.key}</li>)}</ul>
      {environment !== 'sandbox' && <p className="mb-4 text-sm text-amber-300">Open a Vercel Preview deployment with the sandbox variables, then visit /admin/lulu. Variables added after deployment require a new deployment.</p>}
      <button className={button} disabled={busy || environment !== 'sandbox'} onClick={() => void run('connection')}>Test sandbox connection</button>
    </Card>
    <Card title="2. Export and validate a finished colouring book">
      <label className="block text-sm">Story ID<input value={storyId} onChange={event => setStoryId(event.target.value)} disabled={busy} placeholder="Copy the ID between /stories/ and /book in its URL" className="my-2 block w-full rounded-lg border border-white/20 bg-slate-900 p-3 text-white" /></label>
      <p className="mb-4 text-sm text-slate-400">Finish the illustrations and cover first. This creates separate interior and cover PDFs and sends them to Lulu for validation. It does not purchase or print a book.</p>
      <button className={button} disabled={busy || !storyId.trim() || environment !== 'sandbox'} onClick={() => void run('validate')}>Export and validate PDFs</button>
    </Card>
    {busy && <p role="status">Working… PDF export can take several minutes. Keep this page open.</p>}
    {message && <p role="status" className="text-emerald-300">{message}</p>}
    {error && <p role="alert" className="whitespace-pre-wrap text-rose-300">{error}</p>}
    {files && <Card title="Exported files"><p className="mb-3 break-all text-sm">{files.pageCount} interior pages · {files.podPackageId}</p><div className="flex gap-5"><a className="text-violet-300 underline" href={files.interiorUrl} target="_blank" rel="noreferrer">Open interior PDF</a><a className="text-violet-300 underline" href={files.coverUrl} target="_blank" rel="noreferrer">Open cover PDF</a></div></Card>}
    {validations.map(validation => <Card key={validation.kind} title={`${validation.kind === 'interior' ? 'Interior' : 'Cover'} validation`}>
      <p className="mb-3 text-sm">Status: {validation.result?.status ?? (validation.error ? 'Request failed' : 'Submitted — awaiting status')}</p>
      {validation.error && <p role="alert" className="mb-3 text-rose-300">{validation.error}</p>}
      {validation.result?.errors != null && <pre className="mb-3 whitespace-pre-wrap break-words text-xs">{JSON.stringify(validation.result.errors, null, 2)}</pre>}
      {validation.result?.id && <button className={button} disabled={busy} onClick={() => void run('status', validation)}>Refresh {validation.kind} result</button>}
    </Card>)}
  </div>;
}
