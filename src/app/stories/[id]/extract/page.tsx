// src/app/stories/[id]/extract/ExtractWorldPage.tsx
"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, XCircle, ArrowLeft, User } from "lucide-react";
import type { StepKey } from "@/lib/storySteps";

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
type ExtractedLocation = { id: string; name: string; portraitImageUrl: string | null };

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

function needsWork(p: ProgressData) {
  return !p.worldComplete && !(p.charactersExtracted && p.locationsExtracted && p.styleExtracted && p.spreadsBuilt && p.charactersAssigned && p.locationsAssigned && p.outfitsExtracted && p.outfitsAssigned);
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
  const applyProgressRef = useRef<(p: ProgressData) => void>();
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
  const checkProgressRef = useRef<() => Promise<void>>();
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
  const showProgress = phase !== "checking" && !progress.charactersExtracted;

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
        {/* Background */}
        <div className="fixed inset-0 -z-10" style={{ background: `radial-gradient(ellipse 80% 60% at 20% 10%, rgba(232,190,255,0.3) 0%, transparent 60%), radial-gradient(ellipse 70% 50% at 85% 80%, rgba(255,182,210,0.25) 0%, transparent 55%), radial-gradient(ellipse 50% 40% at 50% 50%, rgba(200,210,255,0.15) 0%, transparent 50%), #F9F5FF` }}>
          <div className="absolute inset-0 opacity-50" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23c4b5d4' fill-opacity='0.04'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")` }} />
        </div>

        {/* Header */}
        <header className="relative z-10 px-4 py-4">
          <div className="max-w-lg mx-auto flex items-center justify-between">
            <button onClick={() => router.back()} className="flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition-all active:scale-[0.97]" style={{ background: "white", color: "#6B5C80", border: "1px solid rgba(180,150,210,0.15)", boxShadow: "0 1px 4px rgba(100,60,140,0.06)" }}>
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
          </div>
        </header>

        {/* Main — centered */}
        <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 pb-20">
          <div className="w-full max-w-lg">

            {/* Title */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-8">
              <h1 className="text-2xl sm:text-3xl font-extrabold" style={{ color: "#2D2235", letterSpacing: "-0.03em" }}>
                Building your story world
              </h1>
              <div className="mt-2 h-6">
                <AnimatePresence mode="wait">
                  <motion.p key={flavourText} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} className="text-sm" style={{ color: "#7B6E90" }}>
                    {flavourText}
                  </motion.p>
                </AnimatePresence>
              </div>
            </motion.div>

            {/* Progress bar */}
            {showProgress && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-8">
                <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(180,150,210,0.12)" }}>
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: "linear-gradient(90deg, #B05CE6, #D45DA0)" }}
                    initial={{ width: "5%" }}
                    animate={{ width: charactersReady ? "100%" : "60%" }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                  />
                </div>
              </motion.div>
            )}

            {/* Characters step card */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-[18px] overflow-hidden transition-all"
              style={{
                background: "white",
                border: charactersReady ? "1px solid rgba(67,184,156,0.2)" : "1px solid rgba(176,92,230,0.2)",
                boxShadow: charactersReady ? "0 2px 12px rgba(67,184,156,0.08)" : "0 2px 12px rgba(176,92,230,0.08)",
              }}
            >
              <div className="flex items-center gap-3 px-4 py-3.5">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{
                  background: charactersReady ? "rgba(67,184,156,0.1)" : "linear-gradient(135deg, #B05CE6, #D45DA0)",
                }}>
                  {charactersReady ? (
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 300 }}>
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8.5L6.5 12L13 4" stroke="#2FA482" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </motion.div>
                  ) : (
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                  )}
                </div>

                <span className="text-sm font-bold flex-1" style={{ color: "#2D2235" }}>
                  Characters
                </span>

                {charactersReady && (
                  <motion.span initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: "rgba(67,184,156,0.1)", color: "#2FA482" }}>
                    Done
                  </motion.span>
                )}
              </div>

              {/* Show extracted characters */}
              {charactersReady && characters.length > 0 && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} transition={{ duration: 0.3 }} className="overflow-hidden">
                  <div className="px-4 pb-3 flex gap-2 overflow-x-auto" style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
                    {characters.map((c, ci) => (
                      <motion.div key={c.id} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: ci * 0.1 }} className="flex flex-col items-center gap-1 flex-shrink-0">
                        {c.portraitImageUrl ? (
                          <img src={c.portraitImageUrl} alt={c.name} className="w-12 h-12 rounded-xl object-cover" style={{ border: "2px solid rgba(180,150,210,0.15)" }} />
                        ) : (
                          <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: "rgba(199,125,255,0.1)" }}>
                            <User className="w-5 h-5" style={{ color: "#C4A8E0" }} />
                          </div>
                        )}
                        <span className="text-[10px] font-semibold text-center max-w-[60px] truncate" style={{ color: "#5A4D6B" }}>{c.name}</span>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}
            </motion.div>

            {/* "Rest continues in background" note after characters done */}
            {charactersReady && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="mt-6 text-center">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold" style={{ background: "rgba(67,184,156,0.1)", color: "#2FA482" }}>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Taking you to set up your characters…
                </div>
                <p className="mt-2 text-[11px]" style={{ color: "#A897BD" }}>
                  Locations, style, and page layout are being prepared in the background.
                </p>
              </motion.div>
            )}

            {/* Checking state */}
            {phase === "checking" && (
              <div className="mt-8 flex items-center justify-center gap-2 text-sm" style={{ color: "#A897BD" }}>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Checking your story…</span>
              </div>
            )}
          </div>
        </main>
      </div>
    </>
  );
}