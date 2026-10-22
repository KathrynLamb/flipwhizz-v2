// src/app/stories/[id]/locations/components/LocationCard.tsx
'use client';
import { prepareReferencePhoto, REFERENCE_PHOTO_ACCEPT } from '@/lib/heicPreview';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebaseClient';
import { useState, useRef, useEffect } from 'react';
import { Sparkles, Check, Loader2, Camera, Pencil, RefreshCw, MapPin } from 'lucide-react';
import type { Location } from '../locationsClient';
import { hasPortrait } from '@/lib/characters/readiness';

export default function LocationCard({ location, storyId, onUpdate, disabled = false, generating = false,
  externalError, onBusyChange, bookType,
}: { location: Location; storyId: string; index?: number; onUpdate?: () => void;
  disabled?: boolean; generating?: boolean; externalError?: string; bookType?: string;
  onBusyChange?: (id: string, busy: boolean) => void;
}) {
  const [portrait, setPortrait] = useState(location.portraitImageUrl);
  const [approved, setApproved] = useState(location.locked && hasPortrait(location));
  const [action, setAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [description, setDescription] = useState(location.description ?? '');
  const uploadRef = useRef<HTMLInputElement>(null);
  const actionRunning = useRef(false);
  const busy = Boolean(action) || disabled || generating;
  useEffect(() => {
    setPortrait(location.portraitImageUrl);
    setApproved(location.locked && hasPortrait({ portraitImageUrl: location.portraitImageUrl, locked: location.locked }));
  }, [location.portraitImageUrl, location.locked]);

  async function request(url: string, body: unknown, method = 'POST') {
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.error || 'That didn’t work. Please try again.');
    return data;
  }
  async function run(label: string, work: () => Promise<void>) {
    if (busy || actionRunning.current) return;
    actionRunning.current = true; setAction(label); setError(null); onBusyChange?.(location.id, true);
    try { await work(); onUpdate?.(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Please try again.'); onUpdate?.(); }
    finally { setAction(null); actionRunning.current = false; onBusyChange?.(location.id, false); }
  }
  async function generate(mode: "description" | "reference" = "description") {
    const data = await request('/api/locations/use-ai-image', { locationId: location.id, mode });
    if (!data?.url) throw new Error('No image was returned. Please try again.');
    setPortrait(data.url); setApproved(false);
  }
  function startEdit() {
    setDescription(location.description ?? ''); setEditing(true);
  }
  async function saveDetails() {
    if (!description.trim()) throw new Error('Add a description for this location.');
    await request('/api/locations/update', { locationId: location.id, description: description.trim() });
    if (description.trim() !== location.description) setPortrait(null);
    setApproved(false); setEditing(false);
  }
  async function upload(file: File) {
    if (file.size > 15 * 1024 * 1024) throw new Error('Choose a photo smaller than 15 MB.');
    const uploadFile = await prepareReferencePhoto(file);
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(uploadFile.type)) throw new Error('Choose a JPG, PNG, WebP or HEIC photo.');
    const path = `story-references/${storyId}/${crypto.randomUUID()}`;
    const object = ref(storage, path);
    await uploadBytes(object, uploadFile, { contentType: uploadFile.type });
    const imageUrl = await getDownloadURL(object);
    setApproved(false);
    await request('/api/locations/upload-reference', { locationId: location.id, imageUrl, storagePath: path });
    setAction('Creating scene…');
    await generate("reference");
  }
  const shownError = error || externalError;
  const fieldClass = 'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm leading-6 outline-none focus:border-[#7655A3] focus:ring-2 focus:ring-[#7655A3]/15';
  return <article aria-label={location.name} aria-busy={Boolean(action) || generating} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
    <div className="flex items-start justify-between gap-3 px-5 pb-3 pt-5">
      <div><h2 className="text-xl font-semibold tracking-tight">{location.name}</h2></div>
      {(() => {
        const working = generating || Boolean(action);
        const tone = working ? 'bg-violet-50 text-violet-700' : approved ? 'bg-emerald-50 text-emerald-700' : portrait ? 'bg-amber-50 text-amber-800' : 'bg-slate-100 text-slate-600';
        const label = working ? 'Working on it…' : approved ? 'Approved' : portrait ? 'Needs your OK' : 'No picture yet';
        return <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${tone}`}>
          {working ? <Loader2 className="h-3 w-3 animate-spin" /> : approved ? <Check className="h-3 w-3" /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}{label}
        </span>;
      })()}
    </div>
    <div className="px-5">
      {portrait ? <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-[#F5F3F7]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={portrait} alt={`Generated scene of ${location.name}`} className="h-full w-full object-contain" />
        {(generating || action) && <div role="status" className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white/85 px-4 text-center text-sm font-medium"><Loader2 className="h-6 w-6 animate-spin text-[#7655A3]" />{generating ? 'Creating scene…' : action}</div>}
      </div> : <div className="flex min-h-36 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 bg-[#FAF9FC] px-5 py-6 text-center">
        {generating || action ? <Loader2 className="h-7 w-7 animate-spin text-[#7655A3]" /> : <MapPin className="h-7 w-7 text-[#9B88CF]" />}
        <p role="status" className="text-sm text-slate-600">{generating ? 'Creating scene…' : action || 'The scene starts with your description'}</p>
      </div>}
    </div>
    <div className="space-y-4 p-5">
      {editing ? <div className="space-y-3">
        <label className="block text-xs font-medium">Description<textarea value={description} onChange={e => setDescription(e.target.value)} rows={5} className={fieldClass} disabled={busy} placeholder="Describe the landscape, buildings, lighting and details…" /></label>
        {portrait && <p className="text-xs leading-5 text-slate-500">Changing the description means generating a new image to review.</p>}
        <div className="flex gap-2"><button disabled={busy} onClick={() => void run('Saving details…', saveDetails)} className="min-h-11 flex-1 rounded-xl bg-[#7655A3] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">Save details</button><button disabled={busy} onClick={() => setEditing(false)} className="min-h-11 rounded-xl px-3 text-sm text-slate-600">Cancel</button></div>
      </div> : <>
        <p className="line-clamp-3 text-sm leading-6 text-slate-600">{location.description || 'Add a description to help us imagine this location.'}</p>
        {portrait ? <button disabled={busy || approved} onClick={() => void run('Approving scene…', async () => {
          await request('/api/locations/lock', { locationId: location.id, portraitImageUrl: portrait }); setApproved(true);
        })} className={`flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-base font-semibold disabled:cursor-default ${approved ? 'bg-emerald-50 text-emerald-700' : 'bg-[#7655A3] text-white hover:bg-[#62438F] disabled:opacity-50'}`}><Check className="h-4 w-4" />{approved ? 'Approved' : 'Looks good, approve'}</button>
          : <button disabled={busy} onClick={() => void run('Creating scene…', () => generate())} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#7655A3] px-4 py-3 text-base font-semibold text-white hover:bg-[#62438F] disabled:opacity-50"><Sparkles className="h-4 w-4" />Create the picture</button>}
        <div className="border-t border-slate-100 pt-3">
          <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-slate-400">{portrait ? 'Not quite right?' : 'Or start another way'}</p>
          <div className={`grid gap-1 ${portrait ? 'grid-cols-3' : 'grid-cols-2'}`}>
            {portrait && <button disabled={busy} onClick={() => void run('Creating another scene…', () => generate())} className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg px-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"><RefreshCw className="h-4 w-4" />{bookType === 'colouring_storybook' ? 'Redraw as outline' : 'Try another'}</button>}
            <button disabled={busy} onClick={startEdit} className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg px-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"><Pencil className="h-4 w-4" />Edit description</button>
            <button disabled={busy} onClick={() => uploadRef.current?.click()} className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg px-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"><Camera className="h-4 w-4" />Use a photo</button>
          </div>
        </div>
      </>}
      {shownError && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm leading-6 text-rose-700">{shownError}</p>}
      <input ref={uploadRef} type="file" accept={REFERENCE_PHOTO_ACCEPT} className="hidden" aria-label={`Choose a photo of ${location.name}`} onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; if (file) void run('Uploading photo…', () => upload(file)); }} />
    </div>
  </article>;
}
