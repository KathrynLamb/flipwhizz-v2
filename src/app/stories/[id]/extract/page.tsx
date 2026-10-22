// src/app/stories/[id]/extract/ExtractWorldPage.tsx
"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2, XCircle, ArrowLeft } from "lucide-react";

/* ─────────────── TYPES ─────────────── */

type Phase =
  | "checking" | "extracting_characters" | "extracting_locations"
  | "extracting_style" | "building_spreads" | "assigning_characters"
  | "assigning_locations" | "extracting_outfits" | "assigning_outfits" | "ready";

type ProgressData = {
  phase: Phase;
  charactersExtracted: boolean;
  locationsExtracted: boolean;
  styleExtracted: boolean;
  spreadsBuilt: boolean;
  charactersAssigned: boolean;
  locationsAssigned: boolean;
  outfitsExtracted: boolean;
  outfitsAssigned: boolean;
  worldComplete: boolean;
};

type ExtractedCharacter = { id: string; name: string; portraitImageUrl: string | null; species: string | null };

/* ─────────────── FLAVOUR MESSAGES ─────────────── */

const FLAVOUR: Record<Phase, string[]> = {
  checking: ["Opening the book…"],
  extracting_characters: ["Meeting the characters…", "Who's in this story?", "Getting to know everyone…"],
  extracting_locations: ["Nearly there…", "Just a moment more…"],
  extracting_style: ["Nearly there…"],
  building_spreads: ["Nearly there…"],
  assigning_characters: ["Nearly there…"],
  assigning_locations: ["Nearly there…"],
  extracting_outfits: ["Nearly there…"],
  assigning_outfits: ["Nearly there…"],
  ready: ["Your story world is ready!"],
};

/* ─────────────── PROGRESS HELPERS ─────────────── */

function getCurrentPhase(p: ProgressData): Phase {
  if (p.worldComplete) return "ready";
  if (!p.charactersExtracted) return "extracting_characters";
  if (!p.locationsExtracted) return "extracting_locations";
  if (!p.styleExtracted) return "extracting_style";
  if (!p.spreadsBuilt) return "building_spreads";
  if (!p.charactersAssigned) return "assigning_characters";
  if (!p.locationsAssigned) return "assigning_locations";
  if (!p.outfitsExtracted) return "extracting_outfits";
  if (!p.outfitsAssigned) return "assigning_outfits";
  return "ready";
}

function parseProgress(incoming: any): ProgressData {
  const built: ProgressData = {
    phase: "checking",
    charactersExtracted: !!incoming.charactersExtracted,
    locationsExtracted: !!incoming.locationsExtracted,
    styleExtracted: !!incoming.styleExtracted,
    spreadsBuilt: !!incoming.spreadsBuilt,
    charactersAssigned: !!incoming.charactersAssigned,
    locationsAssigned: !!incoming.locationsAssigned,
    outfitsExtracted: !!incoming.outfitsExtracted,
    outfitsAssigned: !!incoming.outfitsAssigned,
    worldComplete: !!incoming.worldComplete,
  };
  built.phase = getCurrentPhase(built);
  return built;
}

/* ─────────────── FONT ─────────────── */

function FontLoader() {
  return (
    <link
      href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,300;12..96,400;12..96,600;12..96,700;12..96,800&display=swap"
      rel="stylesheet"
    />
  );
}

/* ─────────────── MAIN COMPONENT ─────────────── */

export default function ExtractWorldPage() {
  const params = useParams();
  const router = useRouter();
  const storyIdRef = useRef<string | null>(null);

  const storyId = useMemo(() => {
    const raw = (params as any)?.id;
    const id = typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : null;
    storyIdRef.current = id;
    return id;
  }, [params]);
  const [redirectingToBook, setRedirectingToBook] = useState(false);
  const [phase, setPhase] = useState<Phase>("checking");
  const [progress, setProgress] = useState<ProgressData>({
    phase: "checking", charactersExtracted: false, locationsExtracted: false,
    styleExtracted: false, spreadsBuilt: false, charactersAssigned: false,
    locationsAssigned: false, outfitsExtracted: false, outfitsAssigned: false, worldComplete: false,
  });
  const [error, setError] = useState<string | null>(null);
  const [flavourIndex, setFlavourIndex] = useState(0);

  // Extracted data (fetched when characters complete)
  const [characters, setCharacters] = useState<ExtractedCharacter[]>([]);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const errorCount = useRef(0);
  const lastPhaseRef = useRef<Phase>("checking");
  const hasBootstrapped = useRef(false);
  const workflowTriggered = useRef(false);
  const pollingStarted = useRef(false);
  const hasRedirected = useRef(false);

  /* ── Flavour rotation ── */
  useEffect(() => {
    const t = setInterval(() => setFlavourIndex((i) => i + 1), 3200);
    return () => clearInterval(t);
  }, []);

  const flavourText = useMemo(() => {
    const msgs = FLAVOUR[phase] || FLAVOUR.checking;
    return msgs[flavourIndex % msgs.length];
  }, [phase, flavourIndex]);

  /* ── Apply progress ── */
  const applyProgressRef = useRef<((p: ProgressData) => void) | undefined>(undefined);
  applyProgressRef.current = (newProgress: ProgressData) => {
    const currentPhase = getCurrentPhase(newProgress);
    if (currentPhase !== lastPhaseRef.current) {
      lastPhaseRef.current = currentPhase;
      setFlavourIndex(0);
    }
    setPhase(currentPhase);
    setProgress(newProgress);

    // Stop polling once characters are extracted — we're about to redirect
    if (newProgress.charactersExtracted && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  /* ── Poll ── */
  const checkProgressRef = useRef<(() => Promise<void>) | undefined>(undefined);
  checkProgressRef.current = async () => {
    const id = storyIdRef.current;
    if (!id) return;
    try {
      const res = await fetch(`/api/stories/${id}/workflow-progress`, { cache: "no-store" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (data?.progress) applyProgressRef.current?.(parseProgress(data.progress));
      errorCount.current = 0;
    } catch {
      errorCount.current++;
      if (errorCount.current > 10) {
        setError("Unable to check progress. Please refresh.");
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      }
    }
  };

  const doStartPolling = useCallback(() => {
    if (pollingStarted.current) return;
    pollingStarted.current = true;
    const tick = () => checkProgressRef.current?.();
    tick();
    pollRef.current = setInterval(tick, 2000);
  }, []);

  /* ── Bootstrap ── */
  useEffect(() => {
    if (!storyId || hasBootstrapped.current) return;
    hasBootstrapped.current = true;
    let cancelled = false;

    const run = async () => {
      try {
        setPhase("checking");
        lastPhaseRef.current = "checking";

        // ── Guard: story must be confirmed before extraction ──
        try {
          const storyRes = await fetch(`/api/stories/${storyId}`, { cache: "no-store" });
          if (storyRes.ok) {
            const storyData = await storyRes.json();
            const s = storyData.story;

            if (s?.paymentStatus === "paid" && s?.pdfUrl) {
              setRedirectingToBook(true);
              router.push(`/stories/${storyId}/book`);
              return;
            }
        
            // If book is locked (paid + has PDF), go to book page
            if (s?.paymentStatus === "paid" && s?.pdfUrl) {
              router.push(`/stories/${storyId}/book`);
              return;
            }
        
            if (!s?.storyConfirmed) {
              router.push(`/stories/${storyId}/pages`);
              return;
            }
          }
        } catch {}

        if (cancelled) return;

        let p: ProgressData | null = null;
        try {
          const res = await fetch(`/api/stories/${storyId}/workflow-progress`, { cache: "no-store" });
          if (res.ok) { const d = await res.json(); if (d?.progress) p = parseProgress(d.progress); }
        } catch {}

        if (cancelled) return;

        // If characters already extracted, skip straight to redirect
        if (p && p.charactersExtracted) {
          setProgress(p);
          setPhase(getCurrentPhase(p));
          if (!hasRedirected.current) {
            router.push(`/stories/${storyId}/illustration-style`);
          }
          return;
        }

        if (p) { setProgress(p); const cp = getCurrentPhase(p); setPhase(cp); lastPhaseRef.current = cp; }

        if (!workflowTriggered.current) {
          workflowTriggered.current = true;
          try {
            const res = await fetch(`/api/stories/${storyId}/ensure-world`, { method: "POST" });
            if (res.status === 400) {
              router.push(`/stories/${storyId}/chat`);
              return;
            }
          } catch {}
        }
        if (!cancelled) doStartPolling();
      } catch {
        if (!cancelled) setError("Failed to start. Please refresh.");
      }
    };

    run();
    const safety = setTimeout(() => { if (!pollingStarted.current && !cancelled) doStartPolling(); }, 8000);

    return () => {
      cancelled = true;
      hasBootstrapped.current = false; workflowTriggered.current = false;
      pollingStarted.current = false; lastPhaseRef.current = "checking";
      hasRedirected.current = false;
      errorCount.current = 0; clearTimeout(safety);
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    };
  }, [storyId, doStartPolling, router]);

  /* ── Redirect as soon as characters are extracted ── */
  useEffect(() => {
    if (!storyId || hasRedirected.current) return;
    if (!progress.charactersExtracted) return;

    hasRedirected.current = true;

    // Brief delay so the user sees "Characters — Done" before redirect
    const timer = setTimeout(() => {
      router.push(`/stories/${storyId}/illustration-style`);
    }, 1200);

    return () => clearTimeout(timer);
  }, [progress.charactersExtracted, storyId, router]);

  /* ── Fetch character names when extracted ── */
  useEffect(() => {
    if (!storyId || !progress.charactersExtracted) return;
    fetch(`/api/stories/${storyId}/world`).then(r => r.json()).then(data => {
      if (data.characters) setCharacters(data.characters.map((c: any) => ({
        id: c.id, name: c.name, portraitImageUrl: c.portraitImageUrl || c.imageUrl, species: c.species,
      })));
    }).catch(() => {});
  }, [progress.charactersExtracted, storyId]);

  /* ── Overall progress (only up to characters for this page) ── */

  /* ─────────────── ERROR ─────────────── */

  if (error) {
    return (
      <>
        <FontLoader />
        <div className="flex min-h-screen items-center justify-center p-4" style={{ background: "#F9F5FF", fontFamily: "'Bricolage Grotesque', system-ui, sans-serif" }}>
          <div className="w-full max-w-sm rounded-[22px] p-8 text-center" style={{ background: "white", border: "1px solid rgba(180,150,210,0.12)", boxShadow: "0 4px 24px rgba(100,60,140,0.1)" }}>
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: "rgba(233,30,99,0.08)" }}>
              <XCircle className="h-7 w-7" style={{ color: "#E91E63" }} />
            </div>
            <h1 className="mt-5 text-xl font-extrabold" style={{ color: "#2D2235" }}>Something went wrong</h1>
            <p className="mt-2 text-sm leading-6" style={{ color: "#7B6E90" }}>{error}</p>
            <button onClick={() => window.location.reload()} className="mt-6 w-full rounded-xl py-3 text-sm font-bold text-white active:scale-[0.98] transition-transform" style={{ background: "linear-gradient(135deg, #B05CE6, #D45DA0)", boxShadow: "0 4px 16px rgba(176,92,230,0.25)", border: "none" }}>
              Try again
            </button>
          </div>
        </div>
      </>
    );
  }


  if (redirectingToBook) {
    return (
      <>
        <FontLoader />
        <div className="min-h-screen flex items-center justify-center"
          style={{ fontFamily: "'Bricolage Grotesque', system-ui, sans-serif", background: "#F9F5FF" }}>
          <div className="text-center">
            <span className="text-4xl mb-4 block">📖</span>
            <p className="text-sm font-semibold" style={{ color: "#2D2235" }}>
              Opening your book…
            </p>
          </div>
        </div>
      </>
    );
  }

  /* ─────────────── RENDER ─────────────── */

  const charactersReady = progress.charactersExtracted;

  return (
    <>
      <FontLoader />
      <div className="min-h-screen relative flex flex-col" style={{ fontFamily: "'Bricolage Grotesque', system-ui, sans-serif" }}>
        <div className="fixed inset-0 -z-10 bg-[#F6F2E9]" />
        {/* Header */}
        <header className="relative z-10 px-4 py-4">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <button onClick={() => router.back()} className="flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition-all active:scale-[0.97]" style={{ background: "white", color: "#6B5C80", border: "1px solid rgba(180,150,210,0.15)", boxShadow: "0 1px 4px rgba(100,60,140,0.06)" }}>
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
          </div>
        </header>

        {/* Main — centered */}
        <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 pb-20">
          <div className="w-full max-w-4xl">
            <div className="mb-10 border-b border-[#CEC6B7] pb-8">
              <p className="mb-4 text-xs font-bold uppercase tracking-[0.22em] text-[#716653]">The story workshop / 02</p>
              <h1 className="max-w-2xl text-4xl sm:text-6xl leading-[1.06] tracking-tight text-[#293C35]" style={{ fontFamily: 'Georgia, serif' }}>
                Words become<br /><em>a world.</em>
              </h1>
              <p className="mt-5 max-w-lg text-base leading-7 text-[#605D53]">We’re gathering the people, places and little details that make this story yours. Next, you get to decide how it all looks.</p>
            </div>
            <div className="grid gap-5 sm:grid-cols-3">
              {[
                { title: 'Meet the cast', label: '01 / Characters', detail: 'Every hero, sidekick and scene-stealer.', done: progress.charactersExtracted, active: phase === 'extracting_characters', icon: 'cast' },
                { title: 'Set the scene', label: '02 / Places', detail: 'From familiar homes to faraway worlds.', done: progress.locationsExtracted, active: phase === 'extracting_locations', icon: 'place' },
                { title: 'The little details', label: '03 / Wardrobe', detail: 'The outfits that help tell their story.', done: progress.outfitsExtracted, active: phase === 'extracting_outfits', icon: 'outfit' },
              ].map((item, index) => (
                <div key={item.icon} className="relative border border-[#D4CCBC] p-6" style={{ background: index === 1 ? '#E5EBDF' : '#FFFCF5', borderRadius: index === 1 ? '48px 48px 4px 4px' : '4px', boxShadow: '3px 4px 0 #E4DDCF' }}>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#716653]">{item.label}</p>
                  <svg viewBox="0 0 120 90" className="my-5 h-24 w-full text-[#40594B]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    {item.icon === 'cast' ? <><circle cx="44" cy="30" r="14"/><path d="M20 78V66c0-24 48-24 48 0v12M35 28h1m15 0h1M39 36q5 5 10 0"/><circle cx="85" cy="42" r="10"/><path d="M72 78V68q13-22 26 0v10"/></> : item.icon === 'place' ? <><path d="M22 74V40L49 17l27 23v34H22zm19 0V52h17v22M14 40l35-30 35 30M91 74V40m-12 9 12-25 13 25H79"/><path d="M12 80h96"/></> : <><path d="m40 16-24 18 13 18 12-8v34h39V44l12 8 13-18-25-18q-20 18-40 0Z"/><path d="M50 21q10 13 21 0M47 65h27"/></>}
                  </svg>
                  <h2 className="text-xl text-[#293C35]" style={{ fontFamily: 'Georgia, serif' }}>{item.title}</h2>
                  <p className="mt-2 min-h-12 text-sm leading-6 text-[#605D53]">{item.detail}</p>
                  <p className="mt-5 flex items-center gap-2 text-xs font-semibold text-[#40594B]">{item.active && <Loader2 className="h-3 w-3 animate-spin motion-reduce:animate-none" />}{item.done ? 'Ready ✓' : item.active ? 'Finding in your story…' : 'Still to come'}</p>
                </div>
              ))}
            </div>
            <div role="status" aria-live="polite" className="mt-8 flex items-center gap-3 border-t border-[#CEC6B7] pt-6 text-sm text-[#40594B]">
              <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />
              <span>{charactersReady ? 'Your cast is ready. Opening illustration styles…' : flavourText}</span>
            </div>
            {charactersReady && characters.length > 0 && <p className="mt-3 text-sm text-[#40594B]">Meet {characters.map(character => character.name).join(', ')}.</p>}
            <p className="mt-3 text-xs leading-5 text-[#716653]">You’ll move on as soon as your characters are ready. The remaining details can finish in the background.</p>
          </div>
        </main>
      </div>
    </>
  );
}
