'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Loader2, Sparkles, Check } from 'lucide-react';
import type { StepKey } from '@/lib/storySteps';
import { hasPortrait, isAppearanceApproved, isCastReady } from '@/lib/characters/readiness';
import LocationsCard from './components/LocationCard';

export type Location = {
  id: string; name: string; description: string | null;
  portraitImageUrl: string | null; referenceImageUrl: string | null; locked: boolean;
};

export default function LocationsClient({ storyId, storyTitle = 'Your story', locations,
  bookType = 'storybook',
}: { storyId: string; storyTitle?: string; locations: Location[]; bookType?: string;
  storyConfirmed?: boolean; currentStep?: StepKey; completedSteps?: StepKey[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [cast, setCast] = useState(locations);
  const [busyIds, setBusyIds] = useState<string[]>([]);
  const [batch, setBatch] = useState(false);
  const batchRunning = useRef(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [batchDone, setBatchDone] = useState(0);
  const [batchTotal, setBatchTotal] = useState(0);
  const [failures, setFailures] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [styleReviewed, setStyleReviewed] = useState(false);
  useEffect(() => { setCast(locations); }, [locations]);
  const onBusyChange = useCallback((id: string, busy: boolean) => {
    setBusyIds(prev => busy ? [...new Set([...prev, id])] : prev.filter(v => v !== id));
  }, []);
  const approved = cast.filter(isAppearanceApproved).length;
  const missing = cast.filter(c => !hasPortrait(c));
  const busy = batch || busyIds.length > 0 || confirming;
  const styleChanged = searchParams.get('styleChanged') === 'true' && !styleReviewed;
  const ready = isCastReady(cast) && !styleChanged;

  async function generateScenes(redraw = false) {
    if (busy || batchRunning.current) return;
    const targets = redraw ? cast : missing;
    if (!targets.length) return;
    batchRunning.current = true;
    setBatch(true); setBatchDone(0); setBatchTotal(targets.length); setError(null);
    let failed = 0;
    try {
      for (const location of targets) {
        setActiveId(location.id);
        setFailures(prev => { const next = { ...prev }; delete next[location.id]; return next; });
        try {
          const res = await fetch('/api/locations/use-ai-image', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ locationId: location.id, mode: 'description' }),
          });
          const data = await res.json();
          if (!res.ok || !data.url) throw new Error('Could not generate this scene. Try again.');
          setCast(prev => prev.map(c => c.id === location.id ? { ...c, portraitImageUrl: data.url, locked: false } : c));
        } catch {
          failed++;
          setFailures(prev => ({ ...prev, [location.id]: `Couldn't generate ${location.name}. Try generating this scene again.` }));
        }
        setBatchDone(n => n + 1);
      }
      if (redraw && failed === 0) setStyleReviewed(true);
    } finally {
      setActiveId(null); setBatch(false); batchRunning.current = false;
      router.refresh();
    }
  }

  async function continueToPreview() {
    if (!ready || busy) return;
    setConfirming(true); setError(null);
    try {
      const res = await fetch(`/api/stories/${storyId}/confirm-locations`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not save your approvals. Please try again.');
      router.push(`/stories/${storyId}/preview`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Please try again.');
      setConfirming(false); router.refresh();
    }
  }

  return <div className="min-h-screen bg-[#FAF9F7] text-slate-800">
    <header className="border-b border-slate-200/70 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <Link href={`/stories/${storyId}/characters`} aria-label="Back to characters" className="rounded-xl p-2 hover:bg-slate-100"><ArrowLeft className="h-5 w-5" /></Link>
          <div className="min-w-0"><p className="text-xs font-medium text-[#7655A3]">Story studio</p><p className="truncate text-sm font-semibold">{storyTitle}</p></div>
        </div>
        <Link href="/projects" className="shrink-0 rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100">My library</Link>
      </div>
    </header>
    <main className="mx-auto max-w-6xl px-5 pb-32 pt-8 sm:px-8 sm:pt-10">
      <nav aria-label="Book setup" className="mb-6 flex items-center gap-2 text-xs text-slate-500">
        <Link href={`/stories/${storyId}/characters`} className="hover:underline">Characters</Link><span aria-hidden="true">/</span>
        <span aria-current="step" className="font-semibold text-[#7655A3]">Locations</span><span aria-hidden="true">/</span><span>Preview</span>
      </nav>
      <div className="mb-7 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
        <div className="max-w-xl">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Set the scene for your story</h1>
          <p className="mt-3 text-base leading-7 text-slate-600">Start with their descriptions, generate an image, then choose the scenes you love. No photos needed.</p>
          {bookType === 'colouring_storybook' && <p className="mt-2 text-sm leading-6 text-[#7655A3]">These references establish each place’s look. Your book’s inside pages will use outlines for colouring.</p>}
        </div>
        <div className="flex shrink-0 flex-col gap-2">
          <button onClick={() => void generateScenes()} disabled={busy || missing.length === 0} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#7655A3] px-5 py-3 text-sm font-semibold text-white hover:bg-[#62438F] disabled:opacity-50">
            {batch ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {batch ? 'Generating scenes…' : `Generate missing scenes${missing.length ? ` (${missing.length})` : ''}`}
          </button>
        </div>
      </div>
      {styleChanged && <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm"><p>Your book style changed. Regenerate the scenes, then review them in the new style.</p><button disabled={busy} onClick={() => void generateScenes(true)} className="mt-2 min-h-11 font-semibold underline disabled:opacity-50">Regenerate for this style</button></div>}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 text-sm" role="status" aria-live="polite">
        <p><span className="font-semibold">{approved} of {cast.length}</span> scenes approved</p>
        {batch ? <p className="text-[#7655A3]">{batchDone} of {batchTotal} processed · Generating {cast.find(c => c.id === activeId)?.name}</p> : <p className="text-slate-500">{missing.length ? `${missing.length} still need a scene` : 'Review each image before continuing'}</p>}
      </div>
      <div className="grid items-start gap-6 md:grid-cols-2 xl:grid-cols-3">
        {cast.map(location => <LocationsCard key={location.id} location={location} storyId={storyId}
          disabled={batch || confirming} generating={activeId === location.id}
          externalError={failures[location.id]} onBusyChange={onBusyChange}
          onUpdate={() => { setFailures(prev => { const next = { ...prev }; delete next[location.id]; return next; }); router.refresh(); }} />)}
      </div>
      {!cast.length && <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center"><h2 className="text-lg font-semibold">Your locations aren’t ready yet</h2><p className="mt-2 text-sm text-slate-600">Return to your story to prepare its locations.</p><Link href={`/stories/${storyId}/extract`} className="mt-4 inline-block text-[#7655A3] underline">Back to your story</Link></div>}
    </main>
    <footer className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-5 py-4 backdrop-blur sm:px-8" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
        <div className="text-sm"><p className="flex items-center gap-2 font-semibold">{ready && <Check className="h-4 w-4 text-emerald-600" />}{ready ? 'Your locations are ready' : `${cast.length - approved} scenes left to approve`}</p><p className="mt-1 text-xs text-slate-500">{ready ? 'Next, preview your story.' : 'Generate an image, then select “Use this scene”.'}</p>{error && <p role="alert" className="mt-1 text-sm text-rose-700">{error}</p>}</div>
        <button onClick={() => void continueToPreview()} disabled={!ready || busy} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#7655A3] px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500">{confirming ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Continue to preview<ArrowRight className="h-4 w-4" /></button>
      </div>
    </footer>
  </div>;
}
