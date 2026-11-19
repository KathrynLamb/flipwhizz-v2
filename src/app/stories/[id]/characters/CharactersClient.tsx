// src/app/stories/[id]/characters/CharactersClient.tsx
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Loader2, Sparkles, Users, Check, EyeOff, Eye } from 'lucide-react';
import type { StepKey } from '@/lib/storySteps';
import { hasPortrait, isAppearanceApproved, isCastReady, isShown } from '@/lib/characters/readiness';
import CharactersCard from './components/CharacterCard';
import GroupPhotoModal from './components/GroupPhotoModal';
import ShowCharacterModal from './components/ShowCharacterModal';
import { friendlyMessage } from '@/lib/userErrors';

export type CharacterOutfit = { id: string; outfitKey: string; outfitDescription: string; triggerConditions: string | null };
export type Character = {
  id: string; name: string; description: string | null; appearance: string | null;
  personalityTraits: string | null; portraitImageUrl: string | null;
  fullBodyImageUrl?: string | null; referenceImageUrl: string | null; locked: boolean;
  role?: string | null; age?: string | null; species?: string | null; breed?: string | null;
  outfits?: CharacterOutfit[]; visualDetails?: Record<string, unknown> | null;
  /** False = in the story but not drawn, so no card is needed. */
  shown?: boolean; appearanceNote?: string | null;
};

export default function CharactersClient({ storyId, storyTitle = 'Your story', characters,
  bookType = 'storybook',
}: { storyId: string; storyTitle?: string; characters: Character[]; bookType?: string;
  storyConfirmed?: boolean; currentStep?: StepKey; completedSteps?: StepKey[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [cast, setCast] = useState(characters);
  const [busyIds, setBusyIds] = useState<string[]>([]);
  const [batch, setBatch] = useState(false);
  const batchRunning = useRef(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [batchDone, setBatchDone] = useState(0);
  const [batchTotal, setBatchTotal] = useState(0);
  const [failures, setFailures] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [showGroupPhoto, setShowGroupPhoto] = useState(false);
  const [groupRemaining, setGroupRemaining] = useState(0);
  const [styleReviewed, setStyleReviewed] = useState(false);
  const [approvingAll, setApprovingAll] = useState(false);
  const [showing, setShowing] = useState<Character | null>(null);
  const [hideAsk, setHideAsk] = useState<string | null>(null);
  const [hidingId, setHidingId] = useState<string | null>(null);
  useEffect(() => { setCast(characters); }, [characters]);
  const onBusyChange = useCallback((id: string, busy: boolean) => {
    setBusyIds(prev => busy ? [...new Set([...prev, id])] : prev.filter(v => v !== id));
  }, []);
  // Characters in the story but not drawn need no card (src/lib/characters/visibility.ts).
  const drawn = cast.filter(isShown);
  const notDrawn = cast.filter(c => !isShown(c));
  const approved = drawn.filter(isAppearanceApproved).length;
  const missing = drawn.filter(c => !hasPortrait(c));
  const toApprove = drawn.filter(c => hasPortrait(c) && !c.locked);
  const busy = batch || busyIds.length > 0 || groupRemaining > 0 || confirming || approvingAll || !!hidingId;
  const styleChanged = searchParams.get('styleChanged') === 'true' && !styleReviewed;
  const ready = isCastReady(cast) && !styleChanged;

  async function generateAppearances(redraw = false) {
    if (busy || batchRunning.current) return;
    const targets = redraw ? drawn : missing;
    if (!targets.length) return;
    batchRunning.current = true;
    setBatch(true); setBatchDone(0); setBatchTotal(targets.length); setError(null);
    let failed = 0;
    try {
      for (const character of targets) {
        setActiveId(character.id);
        setFailures(prev => { const next = { ...prev }; delete next[character.id]; return next; });
        try {
          const res = await fetch('/api/characters/use-ai-image', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ characterId: character.id, outfitMode: 'story' }),
          });
          const data = await res.json();
          if (!res.ok || !data.url) throw new Error('Could not generate this appearance. Try again.');
          setCast(prev => prev.map(c => c.id === character.id ? { ...c, portraitImageUrl: data.url, locked: false,
            appearance: data.updatedAppearance ?? c.appearance, description: data.updatedDescription ?? c.description } : c));
        } catch {
          failed++;
          setFailures(prev => ({ ...prev, [character.id]: `Couldn't generate ${character.name}. Try generating this appearance again.` }));
        }
        setBatchDone(n => n + 1);
      }
      if (redraw && failed === 0) setStyleReviewed(true);
    } finally {
      setActiveId(null); setBatch(false); batchRunning.current = false;
      router.refresh();
    }
  }

  async function approveAll() {
    if (busy || !toApprove.length) return;
    setApprovingAll(true); setError(null);
    const results = await Promise.allSettled(toApprove.map(async character => {
      const res = await fetch('/api/characters/lock', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ characterId: character.id, portraitImageUrl: character.portraitImageUrl }),
      });
      if (!res.ok) throw new Error(character.name);
      return character.id;
    }));
    const okIds = new Set<string>();
    const failedNames: string[] = [];
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') okIds.add(r.value);
      else failedNames.push(toApprove[i].name);
    });
    setCast(prev => prev.map(c => okIds.has(c.id) ? { ...c, locked: true } : c));
    if (failedNames.length) setError(`Couldn't approve ${failedNames.join(', ')}. Check ${failedNames.length === 1 ? 'that picture' : 'those pictures'} and try again.`);
    setApprovingAll(false);
    router.refresh();
  }

  async function hideCharacter(character: Character) {
    if (busy) return;
    setHidingId(character.id); setHideAsk(null); setError(null);
    try {
      const res = await fetch(`/api/stories/${storyId}/characters/${character.id}/visibility`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ shown: false }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Could not take ${character.name} out of the pictures. Please try again.`);
      setCast(prev => prev.map(c => c.id === character.id ? { ...c, shown: false } : c));
    } catch (err) {
      setError(friendlyMessage(err));
    } finally {
      setHidingId(null); router.refresh();
    }
  }

  async function continueToLocations() {
    if (!ready || busy) return;
    setConfirming(true); setError(null);
    try {
      const res = await fetch(`/api/stories/${storyId}/confirm-characters`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not save your approvals. Please try again.');
      router.push(`/stories/${storyId}/locations`);
    } catch (err) {
      setError(friendlyMessage(err));
      setConfirming(false); router.refresh();
    }
  }

  return <div className="min-h-screen bg-[#FAF9F7] text-slate-800">
    <header className="border-b border-slate-200/70 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <Link href={`/stories/${storyId}/design`} aria-label="Back to book design" className="rounded-xl p-2 hover:bg-slate-100"><ArrowLeft className="h-5 w-5" /></Link>
          <div className="min-w-0"><p className="text-xs font-medium text-[#7655A3]">Story studio</p><p className="truncate text-sm font-semibold">{storyTitle}</p></div>
        </div>
        <Link href="/projects" className="shrink-0 rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100">My library</Link>
      </div>
    </header>
    <main className="mx-auto max-w-6xl px-5 pb-32 pt-8 sm:px-8 sm:pt-10">
      <nav aria-label="Book setup" className="mb-6 flex items-center gap-2 text-xs text-slate-500">
        <Link href={`/stories/${storyId}/design`} className="hover:underline">Design</Link><span aria-hidden="true">/</span>
        <span aria-current="step" className="font-semibold text-[#7655A3]">Characters</span><span aria-hidden="true">/</span><span>Locations</span>
      </nav>
      <div className="mb-7 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
        <div className="max-w-xl">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Bring your characters to life</h1>
          <p className="mt-3 text-base leading-7 text-slate-600">Start with their descriptions, generate an appearance, then choose the looks you love. No photos needed.</p>
          {bookType === 'colouring_storybook' && <p className="mt-2 text-sm leading-6 text-[#7655A3]">Your references will use black outlines on white, matching the colouring pages inside your book. Photos are used for identity and shape only.</p>}
        </div>
        <div className="flex shrink-0 flex-col gap-2">
          <button onClick={() => void generateAppearances()} disabled={busy || missing.length === 0} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#7655A3] px-5 py-3 text-sm font-semibold text-white hover:bg-[#62438F] disabled:opacity-50">
            {batch ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {batch ? 'Generating appearances…' : `Generate missing appearances${missing.length ? ` (${missing.length})` : ''}`}
          </button>
          <button onClick={() => setShowGroupPhoto(true)} disabled={busy} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm text-slate-600 hover:bg-white disabled:opacity-50"><Users className="h-4 w-4" /> Use a group photo instead</button>
        </div>
      </div>
      {bookType === 'colouring_storybook' && cast.some(hasPortrait) && <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4 text-sm">
        <p className="text-slate-600">Have coloured references from earlier? Regenerate them as outlines, then approve the new images.</p>
        <button disabled={busy} onClick={() => void generateAppearances(true)} className="mt-2 min-h-11 font-semibold text-[#7655A3] underline disabled:opacity-50">Regenerate all as outlines</button>
      </div>}
      {styleChanged && <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm"><p>Your book style changed. Regenerate the appearances, then review them in the new style.</p><button disabled={busy} onClick={() => void generateAppearances(true)} className="mt-2 min-h-11 font-semibold underline disabled:opacity-50">Regenerate for this style</button></div>}
      <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5" role="status" aria-live="polite">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold">{approved} of {drawn.length} characters approved</p>
            <div className="mt-2 h-2 w-48 max-w-full overflow-hidden rounded-full bg-slate-100" aria-hidden="true"><div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${drawn.length ? (approved / drawn.length) * 100 : 0}%` }} /></div>
            <p className="mt-2 text-sm text-slate-600">
              {batch ? `Creating pictures: ${batchDone} of ${batchTotal} done${cast.find(c => c.id === activeId) ? `, now ${cast.find(c => c.id === activeId)?.name}` : ''}`
                : groupRemaining > 0 ? `Creating pictures from your photo, ${groupRemaining} to go`
                : approvingAll ? 'Approving…'
                : ready ? 'All approved. You can move on to the places in your story.'
                : missing.length ? `Step 1: ${missing.length} ${missing.length === 1 ? 'character needs' : 'characters need'} a picture.`
                : `Step 2: look through the pictures. Happy with them all? Approve them in one go.`}
            </p>
          </div>
          {!ready && !missing.length && toApprove.length > 0 && !batch && groupRemaining === 0 && (
            <button onClick={() => void approveAll()} disabled={busy} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#7655A3] px-5 py-3 text-sm font-semibold text-white hover:bg-[#62438F] disabled:opacity-50">
              {approvingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}Approve all{toApprove.length > 1 ? ` (${toApprove.length})` : ''}
            </button>
          )}
        </div>
      </div>
      <div className="grid items-start gap-6 md:grid-cols-2 xl:grid-cols-3">
        {drawn.map(character => <div key={character.id}>
          <CharactersCard character={character} storyId={storyId} bookType={bookType}
            disabled={batch || confirming || approvingAll || groupRemaining > 0 || !!hidingId} generating={activeId === character.id}
            externalError={failures[character.id]} onBusyChange={onBusyChange}
            onUpdate={() => { setFailures(prev => { const next = { ...prev }; delete next[character.id]; return next; }); router.refresh(); }} />
          {hideAsk === character.id ? (
            <div className="mt-2 rounded-xl border border-slate-200 bg-white p-3 text-sm">
              <p className="text-slate-700">Keep {character.name} in the story but leave them out of every picture? You can bring them back any time.</p>
              <div className="mt-2 flex gap-2">
                <button onClick={() => void hideCharacter(character)} disabled={busy} className="min-h-11 rounded-lg bg-slate-800 px-4 text-sm font-semibold text-white disabled:opacity-50">Leave them out</button>
                <button onClick={() => setHideAsk(null)} className="min-h-11 rounded-lg px-4 text-sm text-slate-600 hover:bg-slate-100">Cancel</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setHideAsk(character.id)} disabled={busy} className="mt-2 inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-xs text-slate-500 hover:text-slate-800 disabled:opacity-50">
              {hidingId === character.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <EyeOff className="h-3.5 w-3.5" />}
              Not in the pictures? Leave {character.name} out
            </button>
          )}
        </div>)}
      </div>
      {notDrawn.length > 0 && <section className="mt-10" aria-labelledby="not-drawn-heading">
        <h2 id="not-drawn-heading" className="text-lg font-semibold">In the story, not in the pictures</h2>
        <p className="mt-1 text-sm text-slate-600">These characters are part of your story but aren’t drawn, so they don’t need a picture. Want one of them in the pictures? Tell us how and we’ll plan the pages again.</p>
        <ul className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {notDrawn.map(c => <li key={c.id} className="rounded-2xl border border-dashed border-slate-300 bg-white p-4">
            <p className="font-semibold">{c.name}</p>
            {c.description && <p className="mt-1 text-sm text-slate-600">{c.description}</p>}
            {c.appearanceNote && <p className="mt-2 text-xs text-slate-500">Earlier idea: {c.appearanceNote}</p>}
            <button onClick={() => setShowing(c)} disabled={busy} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#7655A3] px-4 text-sm font-semibold text-[#7655A3] hover:bg-violet-50 disabled:opacity-50">
              <Eye className="h-4 w-4" /> Show {c.name} in the pictures
            </button>
          </li>)}
        </ul>
      </section>}
      {!cast.length && <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center"><h2 className="text-lg font-semibold">Your cast isn’t ready yet</h2><p className="mt-2 text-sm text-slate-600">Return to your story to prepare its characters.</p><Link href={`/stories/${storyId}/extract`} className="mt-4 inline-block text-[#7655A3] underline">Back to your story</Link></div>}
    </main>
    <footer className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-5 py-4 backdrop-blur sm:px-8" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
        <div className="text-sm"><p className="flex items-center gap-2 font-semibold">{ready && <Check className="h-4 w-4 text-emerald-600" />}{ready ? 'Your cast is ready' : `${drawn.length - approved} ${drawn.length - approved === 1 ? 'character' : 'characters'} left to approve`}</p><p className="mt-1 text-xs text-slate-500">{ready ? 'Next, choose the places in your story.' : missing.length ? 'Create a picture for each character first.' : 'Approve each picture, or use “Approve all” at the top.'}</p>{error && <p role="alert" className="mt-1 text-sm text-rose-700">{error}</p>}</div>
        <button onClick={() => void continueToLocations()} disabled={!ready || busy} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#7655A3] px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500">{confirming ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Continue to locations<ArrowRight className="h-4 w-4" /></button>
      </div>
    </footer>
    {showing && <ShowCharacterModal storyId={storyId} character={showing}
      onClose={() => setShowing(null)}
      onDone={() => { const id = showing.id; setShowing(null); setCast(prev => prev.map(c => c.id === id ? { ...c, shown: true } : c)); router.refresh(); }} />}
    {showGroupPhoto && <GroupPhotoModal storyId={storyId} characters={drawn}
      onGeneratingStart={ids => { setGroupRemaining(ids.length); }}
      onFailure={id => { setGroupRemaining(n => Math.max(0, n - 1)); setFailures(prev => ({ ...prev, [id]: 'Could not generate from this photo. Try again on this card.' })); router.refresh(); }}
      onComplete={() => { setGroupRemaining(n => Math.max(0, n - 1)); router.refresh(); }} onClose={() => setShowGroupPhoto(false)} />}
  </div>;
}