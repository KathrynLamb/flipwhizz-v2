"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, XCircle, ArrowLeft } from "lucide-react";
import { getNextStepHref, type StepKey } from "@/lib/storySteps";

/* ─────────────────────────────────────────────────────
   TYPES
───────────────────────────────────────────────────── */

type Phase =
  | "checking"
  | "extracting_characters"
  | "extracting_locations"
  | "extracting_style"
  | "building_spreads"
  | "assigning_characters"
  | "assigning_locations"
  | "extracting_outfits"
  | "assigning_outfits"
  | "ready";

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

/* ─────────────────────────────────────────────────────
   STORY-WORLD FLAVOUR MESSAGES
   
   These rotate to make the wait feel alive.
   Grouped by phase so they feel contextual.
───────────────────────────────────────────────────── */

const FLAVOUR: Record<Phase, string[]> = {
  checking: [
    "Peeking into your story world…",
    "Seeing what's already here…",
  ],
  extracting_characters: [
    "Meeting the characters in your story…",
    "Learning who lives in this world…",
    "Figuring out who the hero is…",
    "Getting to know everyone…",
  ],
  extracting_locations: [
    "Exploring the places in your story…",
    "Mapping out the world…",
    "Discovering hidden corners…",
    "Finding where the adventure happens…",
  ],
  extracting_style: [
    "Choosing the colours for your world…",
    "Deciding how the illustrations should feel…",
    "Picking the perfect style…",
    "Making it look just right…",
  ],
  building_spreads: [
    "Laying out the pages of your book…",
    "Figuring out the best page turns…",
    "Building the rhythm of the story…",
    "Shaping each scene…",
  ],
  assigning_characters: [
    "Deciding who appears on each page…",
    "Putting everyone in their places…",
    "Making sure nobody gets left out…",
  ],
  assigning_locations: [
    "Setting each scene in the right place…",
    "Painting in the backgrounds…",
    "Building the world around each moment…",
  ],
  extracting_outfits: [
    "Choosing outfits for your characters…",
    "Making sure everyone looks their best…",
    "Picking the perfect look…",
  ],
  assigning_outfits: [
    "Dressing everyone for each scene…",
    "Almost there — final touches…",
    "Checking every detail…",
  ],
  ready: [
    "Your story world is ready!",
  ],
};

/* ─────────────────────────────────────────────────────
   PROGRESS HELPERS (unchanged logic)
───────────────────────────────────────────────────── */

function getCurrentPhase(prog: ProgressData): Phase {
  if (prog.worldComplete) return "ready";
  if (!prog.charactersExtracted) return "extracting_characters";
  if (!prog.locationsExtracted) return "extracting_locations";
  if (!prog.styleExtracted) return "extracting_style";
  if (!prog.spreadsBuilt) return "building_spreads";
  if (!prog.charactersAssigned) return "assigning_characters";
  if (!prog.locationsAssigned) return "assigning_locations";
  if (!prog.outfitsExtracted) return "extracting_outfits";
  if (!prog.outfitsAssigned) return "assigning_outfits";
  return "ready";
}

function needsWork(p: ProgressData) {
  if (p.worldComplete) return false;
  return !(
    p.charactersExtracted &&
    p.locationsExtracted &&
    p.styleExtracted &&
    p.spreadsBuilt &&
    p.charactersAssigned &&
    p.locationsAssigned &&
    p.outfitsExtracted &&
    p.outfitsAssigned
  );
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

const PHASE_ORDER: Phase[] = [
  "extracting_characters",
  "extracting_locations",
  "extracting_style",
  "building_spreads",
  "assigning_characters",
  "assigning_locations",
  "extracting_outfits",
  "assigning_outfits",
];

/* ─────────────────────────────────────────────────────
   MAIN COMPONENT
───────────────────────────────────────────────────── */

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

  const [phase, setPhase] = useState<Phase>("checking");
  const [progress, setProgress] = useState<ProgressData>({
    phase: "checking",
    charactersExtracted: false,
    locationsExtracted: false,
    styleExtracted: false,
    spreadsBuilt: false,
    charactersAssigned: false,
    locationsAssigned: false,
    outfitsExtracted: false,
    outfitsAssigned: false,
    worldComplete: false,
  });
  const [error, setError] = useState<string | null>(null);
  const [startTime] = useState(Date.now());
  const [flavourIndex, setFlavourIndex] = useState(0);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const errorCount = useRef(0);
  const lastPhaseRef = useRef<Phase>("checking");
  const hasBootstrapped = useRef(false);
  const workflowTriggered = useRef(false);
  const pollingStarted = useRef(false);

  /* ── Flavour text rotation ── */

  useEffect(() => {
    const interval = setInterval(() => {
      setFlavourIndex((i) => i + 1);
    }, 3500);
    return () => clearInterval(interval);
  }, []);

  const flavourText = useMemo(() => {
    const messages = FLAVOUR[phase] || FLAVOUR.checking;
    return messages[flavourIndex % messages.length];
  }, [phase, flavourIndex]);

  /* ── Progress application ── */

  const applyProgressRef = useRef<(p: ProgressData) => void>();
  applyProgressRef.current = (newProgress: ProgressData) => {
    const currentPhase = getCurrentPhase(newProgress);
    if (currentPhase !== lastPhaseRef.current) {
      lastPhaseRef.current = currentPhase;
      setFlavourIndex(0);
    }
    setPhase(currentPhase);
    setProgress(newProgress);
    if (newProgress.worldComplete && pollRef.current) {
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
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!data?.progress) return;
      applyProgressRef.current?.(parseProgress(data.progress));
      errorCount.current = 0;
    } catch {
      errorCount.current++;
      if (errorCount.current > 10) {
        setError("Unable to check progress. Please refresh the page.");
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
        errorCount.current = 0;

        let p: ProgressData | null = null;
        try {
          const res = await fetch(`/api/stories/${storyId}/workflow-progress`, { cache: "no-store" });
          if (res.ok) {
            const data = await res.json();
            if (data?.progress) p = parseProgress(data.progress);
          }
        } catch {}

        if (cancelled) return;

        if (p && !needsWork(p)) {
          setProgress(p);
          setPhase("ready");
          return;
        }

        if (p) {
          setProgress(p);
          const cp = getCurrentPhase(p);
          setPhase(cp);
          lastPhaseRef.current = cp;
        }

        if (!workflowTriggered.current) {
          workflowTriggered.current = true;
          try {
            await fetch(`/api/stories/${storyId}/ensure-world`, { method: "POST" });
          } catch {}
        }

        if (!cancelled) doStartPolling();
      } catch {
        if (!cancelled) setError("Failed to start world building. Please refresh.");
      }
    };

    run();

    const safety = setTimeout(() => {
      if (!pollingStarted.current && !cancelled) doStartPolling();
    }, 8000);

    return () => {
      cancelled = true;
      hasBootstrapped.current = false;
      workflowTriggered.current = false;
      pollingStarted.current = false;
      lastPhaseRef.current = "checking";
      errorCount.current = 0;
      clearTimeout(safety);
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    };
  }, [storyId, doStartPolling]);

  /* ── Auto-redirect on complete ── */

  useEffect(() => {
    if (phase !== "ready" || !storyId) return;
    let cancelled = false;

    const redirect = async () => {
      try {
        const res = await fetch(`/api/stories/${storyId}`, { cache: "no-store" });
        if (!res.ok) throw new Error();
        const data = await res.json();
        const story = data.story ?? data;
        if (cancelled) return;
        const href = getNextStepHref(storyId, story);
        setTimeout(() => { if (!cancelled) router.push(href); }, 1800);
      } catch {
        if (!cancelled) {
          setTimeout(() => { if (!cancelled) router.push(`/stories/${storyId}/illustration-style`); }, 1800);
        }
      }
    };

    redirect();
    return () => { cancelled = true; };
  }, [phase, storyId, router]);

  /* ── Overall progress ── */

  const overallProgress = useMemo(() => {
    const flags = [
      progress.charactersExtracted,
      progress.locationsExtracted,
      progress.styleExtracted,
      progress.spreadsBuilt,
      progress.charactersAssigned,
      progress.locationsAssigned,
      progress.outfitsExtracted,
      progress.outfitsAssigned,
    ];
    return (flags.filter(Boolean).length / flags.length) * 100;
  }, [progress]);

  /* ── Elapsed time ── */

  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startTime) / 1000)), 1000);
    return () => clearInterval(t);
  }, [startTime]);

  /* ── Completed step count for the dots ── */

  const completedSteps = useMemo(() => {
    const flags = [
      progress.charactersExtracted,
      progress.locationsExtracted,
      progress.styleExtracted,
      progress.spreadsBuilt,
      progress.charactersAssigned,
      progress.locationsAssigned,
      progress.outfitsExtracted,
      progress.outfitsAssigned,
    ];
    return flags.filter(Boolean).length;
  }, [progress]);

  /* ─────────────────────────────────────────────────────
     ERROR STATE
  ───────────────────────────────────────────────────── */

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FDF8F0] p-4">
        <div className="w-full max-w-sm rounded-[28px] bg-white p-8 text-center shadow-xl ring-1 ring-slate-200">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-rose-100">
            <XCircle className="h-7 w-7 text-rose-600" />
          </div>
          <h1 className="mt-5 text-xl font-black text-slate-900">Something went wrong</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-6 w-full rounded-full bg-[#D94590] py-3 text-sm font-bold text-white shadow-[0_6px_20px_rgba(217,69,144,0.3)] transition active:scale-[0.98]"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  /* ─────────────────────────────────────────────────────
     RENDER
  ───────────────────────────────────────────────────── */

  const isReady = phase === "ready";

  return (
    <div className="flex min-h-screen flex-col bg-[#FDF8F0] text-slate-900">
      {/* Background orbs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <motion.div
          animate={{ x: [0, 30, 0], y: [0, -20, 0] }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -top-20 left-[-40px] h-[300px] w-[300px] rounded-full bg-fuchsia-200/50 blur-3xl"
        />
        <motion.div
          animate={{ x: [0, -25, 0], y: [0, 30, 0] }}
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
          className="absolute right-[-60px] top-[20%] h-[350px] w-[350px] rounded-full bg-sky-200/50 blur-3xl"
        />
        <motion.div
          animate={{ x: [0, 20, 0], y: [0, -15, 0] }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
          className="absolute bottom-[-80px] left-[30%] h-[280px] w-[280px] rounded-full bg-amber-200/40 blur-3xl"
        />
      </div>

      {/* Header */}
      <header className="relative z-10">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-4 sm:px-6">
          <button
            onClick={() => router.push(`/stories/${storyId}/hub`)}
            className="flex items-center gap-2 rounded-full bg-white/80 px-3 py-1.5 text-sm font-semibold text-slate-600 ring-1 ring-slate-200 backdrop-blur transition hover:bg-white"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Back</span>
          </button>
        </div>
      </header>

      {/* Main content — vertically centered */}
      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 pb-20 sm:px-6">
        <div className="w-full max-w-md text-center">

          {/* ── Animated icon ── */}
          <div className="mx-auto mb-8 flex h-28 w-28 items-center justify-center">
            {isReady ? (
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 200, damping: 15 }}
                className="flex h-24 w-24 items-center justify-center rounded-[28px] bg-gradient-to-br from-emerald-400 to-green-500 shadow-[0_12px_40px_rgba(16,185,129,0.35)]"
              >
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="text-4xl"
                >
                  ✨
                </motion.span>
              </motion.div>
            ) : (
              <div className="relative flex h-24 w-24 items-center justify-center">
                {/* Spinning outer ring */}
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                  className="absolute inset-0 rounded-[28px] bg-gradient-to-br from-[#D94590] via-purple-500 to-sky-500 p-[3px]"
                >
                  <div className="h-full w-full rounded-[26px] bg-[#FDF8F0]" />
                </motion.div>

                {/* Inner book emoji — gently breathing */}
                <motion.span
                  animate={{ scale: [1, 1.08, 1] }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                  className="relative z-10 text-4xl"
                >
                  📖
                </motion.span>
              </div>
            )}
          </div>

          {/* ── Heading ── */}
          <AnimatePresence mode="wait">
            <motion.h1
              key={isReady ? "done" : "building"}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl"
            >
              {isReady ? "Your story world is ready" : "Building your story world"}
            </motion.h1>
          </AnimatePresence>

          {/* ── Flavour text (rotating) ── */}
          <div className="mt-3 h-7">
            <AnimatePresence mode="wait">
              <motion.p
                key={flavourText}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.25 }}
                className="text-base text-slate-500"
              >
                {flavourText}
              </motion.p>
            </AnimatePresence>
          </div>

          {/* ── Progress bar ── */}
          {!isReady && phase !== "checking" && (
            <div className="mx-auto mt-8 max-w-xs">
              <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-[#D94590] to-purple-500"
                  initial={{ width: "0%" }}
                  animate={{ width: `${overallProgress}%` }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                />
              </div>

              {/* Step dots */}
              <div className="mt-4 flex items-center justify-center gap-2">
                {PHASE_ORDER.map((_, i) => (
                  <motion.div
                    key={i}
                    initial={false}
                    animate={{
                      scale: i === completedSteps ? [1, 1.3, 1] : 1,
                      backgroundColor:
                        i < completedSteps
                          ? "#D94590"
                          : i === completedSteps
                            ? "#D94590"
                            : "#E2E8F0",
                    }}
                    transition={{
                      scale: { duration: 1.5, repeat: i === completedSteps ? Infinity : 0, ease: "easeInOut" },
                      backgroundColor: { duration: 0.3 },
                    }}
                    className="h-2 w-2 rounded-full"
                    style={{
                      opacity: i < completedSteps ? 1 : i === completedSteps ? 1 : 0.5,
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* ── Ready state ── */}
          {isReady && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="mt-6 text-sm text-slate-400"
            >
              Taking you to the next step…
            </motion.p>
          )}

          {/* ── Slow warning ── */}
          {elapsed > 240 && !isReady && phase !== "checking" && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mx-auto mt-8 max-w-sm rounded-[18px] bg-amber-50 px-5 py-4 ring-1 ring-amber-200"
            >
              <p className="text-sm font-bold text-amber-900">
                Taking a little longer than usual
              </p>
              <p className="mt-1 text-sm text-amber-700">
                Complex stories with lots of characters can take a few extra
                minutes. Hang tight — it&apos;ll be worth it.
              </p>
            </motion.div>
          )}

          {/* ── Checking state ── */}
          {phase === "checking" && (
            <div className="mt-8 flex items-center justify-center gap-2 text-sm text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Checking your story…</span>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}