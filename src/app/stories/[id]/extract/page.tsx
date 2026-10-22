// src/app/stories/[id]/extract/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2, XCircle, ArrowLeft } from "lucide-react";
import { brandFontClass, brandFontStyle } from "@/app/fonts";

/* Landing page tokens (src/app/home.css) */
const INK = "#24182f";
const BODY = "#4e4259";
const MUTED = "#6a5e73";
const PURPLE = "#7040a5";
const PURPLE_DARK = "#542c83";
const ACCENT = "#7946b4";
const PINK = "#c878bf";
const LINE = "#e0c9ee";
const PAPER = "#fffafd";
const RAINBOW =
  "linear-gradient(90deg,#F3807B 0% 12.5%,#F18B5A 12.5% 25%,#FAD15D 25% 37.5%,#BCD570 37.5% 50%,#7AD3C1 50% 62.5%,#83AAD3 62.5% 75%,#9693CC 75% 87.5%,#C878BF 87.5%)";
const BOOK_FONT = "var(--font-book, Georgia), Georgia, serif";

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
      <main className={`${brandFontClass} flex min-h-screen items-center justify-center p-5`} style={{ ...brandFontStyle, background: "#ffffff" }}>
        <div className="w-full max-w-sm text-center" style={{ borderTop: `4px solid #F3807B`, paddingTop: 28 }}>
          <XCircle className="mx-auto h-8 w-8" style={{ color: "#e8455c" }} aria-hidden="true" />
          <h1 className="mt-5 text-3xl" style={{ fontFamily: BOOK_FONT, fontWeight: 400, letterSpacing: "-0.03em", color: INK }}>
            Something went <em style={{ color: ACCENT }}>wrong.</em>
          </h1>
          <p className="mt-3 text-base leading-7" style={{ color: BODY }}>{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-7 w-full text-base font-semibold text-white transition-colors"
            style={{ background: PURPLE, borderRadius: 3, minHeight: 54, padding: "14px 24px" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = PURPLE_DARK)}
            onMouseLeave={(e) => (e.currentTarget.style.background = PURPLE)}
          >
            Try again
          </button>
        </div>
      </main>
    );
  }

  if (redirectingToBook) {
    return (
      <main className={`${brandFontClass} flex min-h-screen items-center justify-center`} style={{ ...brandFontStyle, background: "#ffffff" }}>
        <div className="flex items-center gap-3 text-base" style={{ color: BODY }} role="status" aria-live="polite">
          <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" style={{ color: PURPLE }} />
          Opening your book…
        </div>
      </main>
    );
  }

  /* ─────────────── RENDER ─────────────── */

  const charactersReady = progress.charactersExtracted;

  const items = [
    { title: "Meet the cast", label: "01 / Characters", detail: "Every hero, sidekick and scene-stealer.", done: progress.charactersExtracted, active: phase === "extracting_characters", icon: "cast", color: "#F3807B" },
    { title: "Set the scene", label: "02 / Places", detail: "From familiar homes to faraway worlds.", done: progress.locationsExtracted, active: phase === "extracting_locations", icon: "place", color: "#7AD3C1" },
    { title: "The little details", label: "03 / Wardrobe", detail: "The outfits that help tell their story.", done: progress.outfitsExtracted, active: phase === "extracting_outfits", icon: "outfit", color: "#83AAD3" },
  ];

  return (
    <main className={`${brandFontClass} min-h-screen`} style={{ ...brandFontStyle, background: "#ffffff", color: BODY }}>
      {/* Rainbow thread, same as the homepage masthead */}
      <div aria-hidden="true" style={{ height: 6, background: RAINBOW }} />

      <div className="mx-auto w-[calc(100%-40px)] max-w-[1180px] pb-20 pt-5 sm:w-[calc(100%-80px)]">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 text-sm font-semibold transition-colors"
          style={{ color: PURPLE, borderBottom: "1px solid currentColor", paddingBlock: "6px 3px" }}
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back
        </button>

        <div className="mt-10 flex justify-between gap-5 pt-4 text-[10px] font-semibold uppercase tracking-[0.1em] sm:text-[11px] sm:tracking-[0.13em]" style={{ borderTop: `1px solid ${PINK}`, color: PURPLE }}>
          <span>The story workshop / 02</span>
          <span>Big stories start small.</span>
        </div>

        <div className="mt-10 pb-12" style={{ borderBottom: `1px solid ${LINE}` }}>
          <h1
            className="max-w-3xl text-[clamp(44px,8vw,80px)] leading-[1.01]"
            style={{ fontFamily: BOOK_FONT, fontWeight: 400, letterSpacing: "-0.055em", color: INK }}
          >
            Words become<br />
            <em style={{ color: ACCENT, fontWeight: 400 }}>a world.</em>
          </h1>
          <p className="mt-6 max-w-lg text-base leading-7 sm:text-lg" style={{ color: BODY }}>
            We’re gathering the people, places and little details that make this story yours. Next, you get to decide how it all looks.
          </p>
        </div>

        <div className="mt-12 grid gap-10 sm:grid-cols-3 sm:gap-8">
          {items.map((item) => (
            <article key={item.icon} style={{ borderTop: `4px solid ${item.color}`, paddingTop: 18 }}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.13em]" style={{ color: PURPLE }}>{item.label}</p>
              <svg viewBox="0 0 120 90" className="my-6 h-24 w-full" style={{ color: PURPLE }} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                {item.icon === "cast" ? <><circle cx="44" cy="30" r="14"/><path d="M20 78V66c0-24 48-24 48 0v12M35 28h1m15 0h1M39 36q5 5 10 0"/><circle cx="85" cy="42" r="10"/><path d="M72 78V68q13-22 26 0v10"/></> : item.icon === "place" ? <><path d="M22 74V40L49 17l27 23v34H22zm19 0V52h17v22M14 40l35-30 35 30M91 74V40m-12 9 12-25 13 25H79"/><path d="M12 80h96"/></> : <><path d="m40 16-24 18 13 18 12-8v34h39V44l12 8 13-18-25-18q-20 18-40 0Z"/><path d="M50 21q10 13 21 0M47 65h27"/></>}
              </svg>
              <h2 className="text-2xl sm:text-[28px]" style={{ fontFamily: BOOK_FONT, fontWeight: 400, letterSpacing: "-0.035em", color: INK }}>{item.title}</h2>
              <p className="mt-2 min-h-12 text-[15px] leading-6" style={{ color: MUTED }}>{item.detail}</p>
              <p className="mt-5 flex items-center gap-2 text-sm font-semibold" style={{ color: item.done || item.active ? PURPLE : MUTED }}>
                {item.active && <Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
                {item.done ? "Ready ✓" : item.active ? "Finding in your story…" : "Still to come"}
              </p>
            </article>
          ))}
        </div>

        <div role="status" aria-live="polite" className="mt-12 flex items-center gap-3 pt-6 text-base" style={{ borderTop: `1px solid ${LINE}`, color: INK }}>
          <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" style={{ color: PURPLE }} aria-hidden="true" />
          <span>{charactersReady ? "Your cast is ready. Opening illustration styles…" : flavourText}</span>
        </div>
        {charactersReady && characters.length > 0 && (
          <p className="mt-3 text-base" style={{ color: BODY }}>
            Meet <em style={{ color: ACCENT, fontFamily: BOOK_FONT }}>{characters.map((character) => character.name).join(", ")}.</em>
          </p>
        )}
        <p className="mt-3 text-sm leading-6" style={{ color: MUTED }}>
          You’ll move on as soon as your characters are ready. The remaining details can finish in the background.
        </p>
      </div>
    </main>
  );
}