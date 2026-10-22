// src/app/stories/[id]/characters/components/CharacterCard.tsx
'use client';
import { prepareReferencePhoto, REFERENCE_PHOTO_ACCEPT } from '@/lib/heicPreview';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebaseClient';
import { useState, useRef, useEffect } from 'react';
import { Sparkles, Check, Loader2, Camera, Pencil, RefreshCw, User, ChevronDown } from 'lucide-react';
import type { Character } from '../CharactersClient';
import { hasPortrait } from '@/lib/characters/readiness';

export default function CharacterCard({ character, storyId, onUpdate, disabled = false, generating = false,
  externalError, onBusyChange, bookType,
}: { character: Character; storyId: string; index?: number; onUpdate?: () => void;
  disabled?: boolean; generating?: boolean; externalError?: string; bookType?: string;
  onBusyChange?: (id: string, busy: boolean) => void;
}) {
  const [portrait, setPortrait] = useState(character.portraitImageUrl);
  const [approved, setApproved] = useState(character.locked && hasPortrait(character));
  const [action, setAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [details, setDetails] = useState(false);
  const [name, setName] = useState(character.name);
  const [description, setDescription] = useState(character.description ?? '');
  const [appearance, setAppearance] = useState(character.appearance ?? '');
  const [traits, setTraits] = useState(character.personalityTraits ?? '');
  const [outfits, setOutfits] = useState<Record<string, string>>({});
  const uploadRef = useRef<HTMLInputElement>(null);
  const actionRunning = useRef(false);
  const busy = Boolean(action) || disabled || generating;
  useEffect(() => {
    setPortrait(character.portraitImageUrl);
    setApproved(character.locked && hasPortrait({ portraitImageUrl: character.portraitImageUrl, locked: character.locked }));
  }, [character.portraitImageUrl, character.locked]);

  async function request(url: string, body: unknown, method = 'POST') {
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.error || 'That didn’t work. Please try again.');
    return data;
  }
  async function run(label: string, work: () => Promise<void>) {
    if (busy || actionRunning.current) return;
    actionRunning.current = true; setAction(label); setError(null); onBusyChange?.(character.id, true);
    try { await work(); onUpdate?.(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Please try again.'); onUpdate?.(); }
    finally { setAction(null); actionRunning.current = false; onBusyChange?.(character.id, false); }
  }
  async function generate() {
    const data = await request('/api/characters/use-ai-image', { characterId: character.id, outfitMode: 'story' });
    if (!data?.url) throw new Error('No image was returned. Please try again.');
    setPortrait(data.url); setApproved(false);
  }
  function startEdit() {
    setName(character.name); setDescription(character.description ?? ''); setAppearance(character.appearance ?? '');
    setTraits(character.personalityTraits ?? '');
    setOutfits(Object.fromEntries((character.outfits ?? []).map(o => [o.id, o.outfitDescription])));
    setEditing(true);
  }
  async function saveDetails() {
    if (!name.trim() || !(appearance.trim() || description.trim())) throw new Error('Add a name and an appearance or description.');
    await request(`/api/characters/${character.id}`, { name: name.trim(), description, appearance, personalityTraits: traits }, 'PATCH');
    for (const outfit of character.outfits ?? []) {
      if (outfits[outfit.id] !== outfit.outfitDescription) {
        await request(`/api/stories/${storyId}/outfits/${outfit.id}`, { outfitDescription: outfits[outfit.id] }, 'PATCH');
      }
    }
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
    setAction('Checking photo…');
    const validation = await request('/api/characters/validate-reference', { imageUrl, characterName: character.name });
    if (!validation?.valid) throw new Error(validation?.message || 'Please choose a clear photo of one character.');
    await request('/api/characters/unlock', { characterId: character.id });
    setApproved(false);
    await request('/api/characters/upload-reference', { characterId: character.id, imageUrl, storagePath: path });
    setAction('Creating appearance…');
    await generate();
  }
  const shownError = error || externalError;
  const fieldClass = 'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm leading-6 outline-none focus:border-[#7655A3] focus:ring-2 focus:ring-[#7655A3]/15';
  return <article aria-label={character.name} aria-busy={Boolean(action) || generating} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
    <div className="flex items-start justify-between gap-3 px-5 pb-3 pt-5">
      <div><h2 className="text-xl font-semibold tracking-tight">{character.name}</h2>{character.role && <p className="mt-1 text-xs text-slate-500">{character.role}</p>}</div>
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
      {portrait ? <div className="relative aspect-square overflow-hidden rounded-xl bg-[#F5F3F7]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={portrait} alt={`Generated appearance of ${character.name}`} className="h-full w-full object-contain" />
        {(generating || action) && <div role="status" className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white/85 px-4 text-center text-sm font-medium"><Loader2 className="h-6 w-6 animate-spin text-[#7655A3]" />{generating ? 'Creating appearance…' : action}</div>}
      </div> : <div className="flex min-h-36 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 bg-[#FAF9FC] px-5 py-6 text-center">
        {generating || action ? <Loader2 className="h-7 w-7 animate-spin text-[#7655A3]" /> : <User className="h-7 w-7 text-[#9B88CF]" />}
        <p role="status" className="text-sm text-slate-600">{generating ? 'Creating appearance…' : action || 'Their appearance starts with your description'}</p>
      </div>}
    </div>
    <div className="space-y-4 p-5">
      {editing ? <div className="space-y-3">
        <label className="block text-xs font-medium">Name<input value={name} onChange={e => setName(e.target.value)} className={fieldClass} disabled={busy} /></label>
        <label className="block text-xs font-medium">Appearance<textarea value={appearance} onChange={e => setAppearance(e.target.value)} rows={4} className={fieldClass} disabled={busy} placeholder="Hair, eyes, clothes, size, distinctive features…" /></label>
        <details><summary className="cursor-pointer py-2 text-sm text-slate-600">Story details and outfits</summary>
          <label className="mt-2 block text-xs font-medium">Description<textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} className={fieldClass} disabled={busy} /></label>
          <label className="mt-2 block text-xs font-medium">Personality<input value={traits} onChange={e => setTraits(e.target.value)} className={fieldClass} disabled={busy} /></label>
          {(character.outfits ?? []).map(o => <label key={o.id} className="mt-2 block text-xs font-medium">{o.outfitKey.replace(/_/g, ' ')}<textarea value={outfits[o.id] ?? o.outfitDescription} onChange={e => setOutfits(prev => ({ ...prev, [o.id]: e.target.value }))} rows={2} className={fieldClass} disabled={busy} /></label>)}
        </details>
        {portrait && <p className="text-xs leading-5 text-slate-500">Changing the appearance, description or outfits means generating a new image to review.</p>}
        <div className="flex gap-2"><button disabled={busy} onClick={() => void run('Saving details…', saveDetails)} className="min-h-11 flex-1 rounded-xl bg-[#7655A3] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">Save details</button><button disabled={busy} onClick={() => setEditing(false)} className="min-h-11 rounded-xl px-3 text-sm text-slate-600">Cancel</button></div>
      </div> : <>
        <p className="line-clamp-3 text-sm leading-6 text-slate-600">{character.appearance || character.description || 'Add a description to help us imagine this character.'}</p>
        {portrait ? <button disabled={busy || approved} onClick={() => void run('Approving appearance…', async () => {
          await request('/api/characters/lock', { characterId: character.id, portraitImageUrl: portrait }); setApproved(true);
        })} className={`flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-base font-semibold disabled:cursor-default ${approved ? 'bg-emerald-50 text-emerald-700' : 'bg-[#7655A3] text-white hover:bg-[#62438F] disabled:opacity-50'}`}><Check className="h-4 w-4" />{approved ? 'Approved' : 'Looks good, approve'}</button>
          : <button disabled={busy} onClick={() => void run('Creating appearance…', generate)} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#7655A3] px-4 py-3 text-base font-semibold text-white hover:bg-[#62438F] disabled:opacity-50"><Sparkles className="h-4 w-4" />Create their picture</button>}
        <div className="border-t border-slate-100 pt-3">
          <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-slate-400">{portrait ? 'Not quite right?' : 'Or start another way'}</p>
          <div className={`grid gap-1 ${portrait ? 'grid-cols-3' : 'grid-cols-2'}`}>
            {portrait && <button disabled={busy} onClick={() => void run('Creating another appearance…', generate)} className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg px-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"><RefreshCw className="h-4 w-4" />{bookType === 'colouring_storybook' ? 'Redraw as outline' : 'Try another'}</button>}
            <button disabled={busy} onClick={startEdit} className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg px-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"><Pencil className="h-4 w-4" />Edit description</button>
            <button disabled={busy} onClick={() => uploadRef.current?.click()} className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg px-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"><Camera className="h-4 w-4" />Use a photo</button>
          </div>
        </div>
        {(character.outfits?.length || character.personalityTraits || character.description !== character.appearance) ? <div className="border-t border-slate-100 pt-2">
          <button aria-expanded={details} onClick={() => setDetails(!details)} className="flex min-h-11 w-full items-center justify-between text-xs text-slate-500">Story details{character.outfits?.length ? ` · ${character.outfits.length} outfits` : ''}<ChevronDown className={`h-4 w-4 ${details ? 'rotate-180' : ''}`} /></button>
          {details && <div className="space-y-2 pb-2 text-xs leading-6 text-slate-600"><p>{character.description}</p><p>{character.personalityTraits}</p>{character.outfits?.map(o => <p key={o.id}><strong>{o.outfitKey.replace(/_/g, ' ')}:</strong> {o.outfitDescription}</p>)}</div>}
        </div> : null}
      </>}
      {shownError && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm leading-6 text-rose-700">{shownError}</p>}
      <input ref={uploadRef} type="file" accept={REFERENCE_PHOTO_ACCEPT} className="hidden" aria-label={`Choose a photo of ${character.name}`} onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; if (file) void run('Uploading photo…', () => upload(file)); }} />
    </div>
  </article>;
}