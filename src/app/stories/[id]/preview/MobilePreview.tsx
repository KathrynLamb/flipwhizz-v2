
// src/app/stories/[id]/preview/components/MobilePreview.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Loader2,
  Wand2,
  RefreshCw,
  ChevronRight,
  ChevronLeft,
  AlertCircle,
  Lock,
  BookOpen,
} from "lucide-react";
import RedrawModal from "@/app/stories/[id]/studio/components/redrawModal";

/* ------------------------------------------------------------------ */
/* TYPES                                                              */
/* ------------------------------------------------------------------ */

interface SpreadCharacter {
  id: string;
  name: string;
  imageUrl: string | null;
}

interface SpreadLocation {
  id: string;
  name: string;
  imageUrl: string | null;
}

interface SpreadOption {
  spreadId: string;
  spreadIndex: number;
  pageLabel: string;
  leftPageId: string;
  rightPageId: string | null;
  leftText: string;
  rightText: string | null;
  existingImageUrl: string | null;
  scene: string;
  mood: string | null;
  characters: SpreadCharacter[];
  location: SpreadLocation | null;
}

type GenerationStatus = "idle" | "queued" | "generating" | "done" | "error";

type RedrawSubmitPayload = {
  feedback: string;
  includedCharacterIds: string[];
  outfitOverrides: Record<string, string>;
  primaryLocationId: string | null;
  includedLocationIds: string[];
  freshStart?: boolean;
};

/* ------------------------------------------------------------------ */
/* CONSTANTS                                                          */
/* ------------------------------------------------------------------ */

const FONT = "'Bricolage Grotesque', system-ui, sans-serif";

/* ------------------------------------------------------------------ */
/* MAIN COMPONENT                                                      */
/* ------------------------------------------------------------------ */

export default function MobilePreview({
  storyId,
  storyTitle,
  onContinue,
}: {
  storyId: string;
  storyTitle: string;
  onContinue: () => void;
}) {
  const [spreads, setSpreads] = useState<SpreadOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [previewGeneratedId, setPreviewGeneratedId] = useState<string | null>(null);

  // Generation state
  const [status, setStatus] = useState<GenerationStatus>("idle");
  const [resultImageUrl, setResultImageUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);

  // Redraw modal
  const [showRedraw, setShowRedraw] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Text expanded
  const [textExpanded, setTextExpanded] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* ── Load spreads ── */
  useEffect(() => {
    setLoading(true);
    fetch(`/api/stories/${storyId}/spreads-preview`)
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to load spreads");
        return res.json();
      })
      .then((data: SpreadOption[]) => {
        const seen = new Set<string>();
        const unique = data.filter((s) => {
          if (seen.has(s.spreadId)) return false;
          seen.add(s.spreadId);
          return true;
        });
        setSpreads(unique);
        const existing = unique.find((s) => s.existingImageUrl);
        if (existing) {
          setPreviewGeneratedId(existing.spreadId);
          setSelectedIdx(unique.indexOf(existing));
        }
      })
      .catch((e) => setFetchError(e.message))
      .finally(() => setLoading(false));
  }, [storyId]);

  /* ── Reset generation state when switching spreads ── */
  const selected = spreads[selectedIdx] ?? null;

  useEffect(() => {
    if (!selected) return;
    if (pollRef.current) clearInterval(pollRef.current);
    setStatus("idle");
    setResultImageUrl(selected.existingImageUrl);
    setError(null);
    setJobId(null);
    setShowRedraw(false);
    setIsSubmitting(false);
    setTextExpanded(false);
  }, [selected?.spreadId]);

  /* ── Poll for generation status ── */
  useEffect(() => {
    if (!jobId || (status !== "queued" && status !== "generating")) return;
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/inngest/job-status/${jobId}`);
        if (!res.ok) return;
        const data = await res.json();
        setStatus(data.status);
        if (data.imageUrl) setResultImageUrl(data.imageUrl);
        if (data.status === "done" || data.status === "error") {
          if (pollRef.current) clearInterval(pollRef.current);
          if (data.status === "error") setError("Generation failed — try again.");
        }
      } catch { /* swallow */ }
    }, 2500);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [jobId, status]);

  /* ── Actions ── */

  const busy = status === "queued" || status === "generating";
  const hasUsedFreePreview = !!previewGeneratedId;
  const isLocked = hasUsedFreePreview && selected && previewGeneratedId !== selected.spreadId;

  async function handleGenerate() {
    if (!selected) return;
    setError(null);
    setStatus("queued");
    try {
      const res = await fetch(`/api/stories/${storyId}/generate-spread`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leftPageId: selected.leftPageId,
          rightPageId: selected.rightPageId,
          pageLabel: selected.pageLabel,
        }),
      });
      if (!res.ok) throw new Error((await res.text()) || "Request failed");
      const data = await res.json();
      setJobId(data.jobId);
      setStatus("generating");
      setPreviewGeneratedId(selected.spreadId);
    } catch (e: any) {
      setError(e.message);
      setStatus("error");
    }
  }

  async function handleRedrawSubmit(payload: RedrawSubmitPayload) {
    if (!selected) return;
    setIsSubmitting(true);
    setError(null);
    setShowRedraw(false);
    setStatus("queued");
    try {
      const res = await fetch(`/api/stories/${storyId}/generate-spread`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leftPageId: selected.leftPageId,
          rightPageId: selected.rightPageId,
          pageLabel: selected.pageLabel,
          feedback: payload.feedback?.trim() || undefined,
          existingSpreadImageUrl: payload.freshStart ? null : resultImageUrl ?? selected.existingImageUrl ?? null,
          freshStart: payload.freshStart ?? false,
          referenceOverrides: {
            includedCharacterIds: payload.includedCharacterIds,
            outfitOverrides: payload.outfitOverrides,
            primaryLocationId: payload.primaryLocationId,
            includedLocationIds: payload.includedLocationIds,
          },
        }),
      });
      if (!res.ok) throw new Error((await res.text()) || "Request failed");
      const data = await res.json();
      setJobId(data.jobId);
      setStatus("generating");
    } catch (e: any) {
      setError(e.message);
      setStatus("error");
    } finally {
      setIsSubmitting(false);
    }
  }

  function goToPrev() {
    if (selectedIdx > 0) setSelectedIdx(selectedIdx - 1);
  }
  function goToNext() {
    if (selectedIdx < spreads.length - 1) setSelectedIdx(selectedIdx + 1);
  }

  /* ── Derived ── */
  const storyText = selected
    ? [selected.leftText, selected.rightText].filter(Boolean).join(" ")
    : "";
  const textIsLong = storyText.length > 140;
  const displayText = textExpanded || !textIsLong ? storyText : storyText.slice(0, 140) + "…";

  /* ------------------------------------------------------------------ */
  /* RENDER                                                              */
  /* ------------------------------------------------------------------ */

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]" style={{ fontFamily: FONT }}>
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: "#B05CE6" }} />
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="px-6 py-20 text-center" style={{ fontFamily: FONT }}>
        <AlertCircle className="w-8 h-8 mx-auto mb-3" style={{ color: "#E91E63" }} />
        <p className="text-sm" style={{ color: "#E91E63" }}>{fetchError}</p>
      </div>
    );
  }

  if (!selected) return null;

  return (
    <div className="flex flex-col" style={{ fontFamily: FONT, minHeight: "100%", background: "#FDFBFF" }}>

      {/* ━━━ SPREAD DOTS + NAV ━━━ */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <button onClick={goToPrev} disabled={selectedIdx === 0}
          className="w-8 h-8 rounded-full flex items-center justify-center disabled:opacity-20 active:scale-90 transition-all"
          style={{ background: "rgba(180,150,210,0.08)" }}>
          <ChevronLeft className="w-4 h-4" style={{ color: "#6B5C80" }} />
        </button>

        <div className="flex items-center gap-1.5">
          {spreads.map((s, i) => (
            <button key={s.spreadId} onClick={() => setSelectedIdx(i)}
              className="transition-all rounded-full"
              style={{
                width: i === selectedIdx ? 20 : 7,
                height: 7,
                background: i === selectedIdx
                  ? "linear-gradient(135deg, #B05CE6, #D45DA0)"
                  : s.existingImageUrl
                    ? "#43B89C"
                    : "rgba(180,150,210,0.2)",
              }}
            />
          ))}
        </div>

        <button onClick={goToNext} disabled={selectedIdx === spreads.length - 1}
          className="w-8 h-8 rounded-full flex items-center justify-center disabled:opacity-20 active:scale-90 transition-all"
          style={{ background: "rgba(180,150,210,0.08)" }}>
          <ChevronRight className="w-4 h-4" style={{ color: "#6B5C80" }} />
        </button>
      </div>

      {/* Spread label */}
      <p className="text-center text-[11px] font-bold mb-2" style={{ color: "#A897BD" }}>
        {selected.pageLabel}
        {selected.location && <span className="font-normal"> · {selected.location.name}</span>}
      </p>

      {/* ━━━ ILLUSTRATION AREA ━━━ */}
      <div className="mx-3 rounded-2xl overflow-hidden relative" style={{
        aspectRatio: "2 / 1",
        boxShadow: resultImageUrl ? "0 8px 32px rgba(100,40,160,0.12)" : "none",
        border: resultImageUrl ? "none" : "2px dashed rgba(176,92,230,0.15)",
        background: resultImageUrl ? "#000" : "rgba(176,92,230,0.03)",
      }}>
        <AnimatePresence mode="wait">
          {/* Busy state */}
          {busy && (
            <motion.div key="busy" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center gap-2.5"
              style={{ background: resultImageUrl ? "rgba(0,0,0,0.5)" : "transparent" }}>
              {resultImageUrl && <img src={resultImageUrl} alt="" className="absolute inset-0 w-full h-full object-cover opacity-30 blur-sm" />}
              <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2.5, ease: "linear" }}
                className="w-11 h-11 rounded-xl flex items-center justify-center relative z-10"
                style={{ background: "linear-gradient(135deg, #B05CE6, #D45DA0)", boxShadow: "0 4px 16px rgba(176,92,230,0.3)" }}>
                <Sparkles className="w-5 h-5 text-white" />
              </motion.div>
              <p className="text-xs font-bold relative z-10" style={{ color: resultImageUrl ? "white" : "#9B59D0" }}>
                {status === "queued" ? "Queued…" : "Illustrating…"}
              </p>
            </motion.div>
          )}

          {/* Result image */}
          {!busy && resultImageUrl && (
            <motion.img key="img" initial={{ opacity: 0, scale: 1.02 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
              src={resultImageUrl} alt={selected.pageLabel} className="w-full h-full object-cover" draggable={false} />
          )}

          {/* Empty — can generate */}
          {!busy && !resultImageUrl && !isLocked && (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center gap-2">
              <BookOpen className="w-8 h-8" style={{ color: "rgba(176,92,230,0.25)" }} />
              <p className="text-[11px] font-semibold" style={{ color: "#C4A0E0" }}>Tap generate below</p>
            </motion.div>
          )}

          {/* Locked — used free preview on another spread */}
          {!busy && !resultImageUrl && isLocked && (
            <motion.div key="locked" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6">
              <Lock className="w-7 h-7" style={{ color: "rgba(176,92,230,0.2)" }} />
              <p className="text-[11px] font-semibold text-center" style={{ color: "#C4A0E0" }}>
                Free preview used on another spread
              </p>
              <p className="text-[10px] text-center" style={{ color: "#D4C6E6" }}>
                Order to generate all spreads
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ━━━ ACTION BUTTON ━━━ */}
      <div className="px-4 pt-3">
        {!resultImageUrl && !busy && !isLocked && (
          <button onClick={handleGenerate}
            className="w-full py-3.5 rounded-2xl text-sm font-bold text-white flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
            style={{ background: "linear-gradient(135deg, #B05CE6, #D45DA0)", boxShadow: "0 4px 16px rgba(176,92,230,0.25)", border: "none", fontFamily: FONT }}>
            <Wand2 className="w-4 h-4" /> Generate Free Preview
          </button>
        )}

        {resultImageUrl && !busy && (
          <button onClick={() => setShowRedraw(true)}
            className="w-full py-3 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
            style={{ background: "rgba(176,92,230,0.08)", color: "#8B5CC6", border: "1.5px solid rgba(176,92,230,0.15)", fontFamily: FONT }}>
            <RefreshCw className="w-4 h-4" /> Redraw This Spread
          </button>
        )}

        {busy && (
          <button disabled
            className="w-full py-3.5 rounded-2xl text-sm font-bold text-white flex items-center justify-center gap-2 opacity-50"
            style={{ background: "rgba(176,92,230,0.3)", border: "none", fontFamily: FONT }}>
            <Loader2 className="w-4 h-4 animate-spin" />
            {status === "queued" ? "Queued…" : "Generating…"}
          </button>
        )}

        {error && (
          <div className="flex items-center gap-2 mt-2 px-3 py-2 rounded-xl text-[11px]" style={{ background: "rgba(233,30,99,0.06)", color: "#E91E63" }}>
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="flex-1">{error}</span>
            <button onClick={handleGenerate} className="font-bold underline">Retry</button>
          </div>
        )}
      </div>

      {/* ━━━ STORY TEXT ━━━ */}
      {storyText && (
        <div className="mx-4 mt-3 rounded-2xl px-4 py-3" style={{ background: "white", border: "1px solid rgba(180,150,210,0.08)" }}>
          <p className="text-[13px] leading-relaxed" style={{ color: "#2D2235", fontFamily: "'Lora', serif" }}>
            {displayText}
          </p>
          {textIsLong && (
            <button onClick={() => setTextExpanded(!textExpanded)}
              className="text-[11px] font-semibold mt-1 active:opacity-60" style={{ color: "#B05CE6" }}>
              {textExpanded ? "Show less" : "Read more"}
            </button>
          )}
        </div>
      )}

      {/* ━━━ CHARACTER AVATARS (compact row) ━━━ */}
      {selected.characters.length > 0 && (
        <div className="flex items-center gap-1 px-4 mt-3">
          <div className="flex -space-x-2">
            {selected.characters.slice(0, 5).map((c) => (
              <div key={c.id} className="w-7 h-7 rounded-full overflow-hidden flex-shrink-0"
                style={{ border: "2px solid #FDFBFF", background: "rgba(199,125,255,0.1)" }}>
                {c.imageUrl ? (
                  <img src={c.imageUrl} alt={c.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-[9px] font-bold" style={{ color: "#C4A0E0" }}>{c.name[0]}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
          <span className="text-[11px] ml-1.5" style={{ color: "#A897BD" }}>
            {selected.characters.map(c => c.name).join(", ")}
          </span>
        </div>
      )}

      {/* ━━━ CONTINUE ━━━ */}
      <div className="px-4 pt-4 pb-6 mt-auto">
        <button onClick={onContinue}
          className="w-full py-4 rounded-2xl text-sm font-bold text-white flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
          style={{ background: "linear-gradient(135deg, #43B89C, #2FA482)", boxShadow: "0 4px 16px rgba(67,184,156,0.25)", border: "none", fontFamily: FONT }}>
          Continue to Order <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* ━━━ REDRAW MODAL ━━━ */}
      {selected && (
        <RedrawModal
          isOpen={showRedraw}
          onClose={() => setShowRedraw(false)}
          onSubmit={handleRedrawSubmit}
          isSubmitting={isSubmitting}
          storyId={storyId}
          spreadId={selected.spreadId}
          spreadLabel={selected.pageLabel}
        />
      )}
    </div>
  );
}