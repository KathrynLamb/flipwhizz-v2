"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Loader2,
  ImagePlus,
  Download,
  Sparkles,
  Wand2,
  MessageSquare,
  X,
  ChevronLeft,
  ChevronRight,
  Check,
} from "lucide-react";
import { motion, useMotionValue, animate, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import OrderBookButton from "@/components/OrderBookButton";

/* -------------------------------------------------------------------------- */
/*                                    Types                                   */
/* -------------------------------------------------------------------------- */

type Page = {
  id: string;
  pageNumber: number;
  text: string;
  imageUrl: string | null;
};

type Spread = {
  id: string;
  left: Page;
  right: Page | null;
};

/* -------------------------------------------------------------------------- */
/*                                   Helpers                                  */
/* -------------------------------------------------------------------------- */

function groupIntoSpreads(pages: Page[]): Spread[] {
  const spreads: Spread[] = [];
  const sorted = [...pages].sort((a, b) => a.pageNumber - b.pageNumber);
  for (let i = 0; i < sorted.length; i += 2) {
    spreads.push({
      id: `spread-${sorted[i].id}`,
      left: sorted[i],
      right: sorted[i + 1] || null,
    });
  }
  return spreads;
}

/* -------------------------------------------------------------------------- */
/*                            Feedback Bottom Sheet                           */
/* -------------------------------------------------------------------------- */

function FeedbackSheet({
  onClose,
  onSubmit,
  isSubmitting,
}: {
  onClose: () => void;
  onSubmit: (feedback: string) => void;
  isSubmitting: boolean;
}) {
  const [feedback, setFeedback] = useState("");

  return (
    <div
      className="fixed inset-0 z-50 flex items-end"
      style={{ background: "rgba(20,8,40,0.6)", backdropFilter: "blur(6px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
        className="w-full"
        style={{
          background: "white",
          borderRadius: "24px 24px 0 0",
          fontFamily: "'Bricolage Grotesque', system-ui, sans-serif",
        }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full" style={{ background: "rgba(180,150,210,0.25)" }} />
        </div>

        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: "1px solid rgba(180,150,210,0.1)" }}
        >
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #B05CE6, #D946EF)" }}
            >
              <Wand2 className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="text-base font-extrabold" style={{ color: "#2D2235" }}>
                Request Changes
              </h3>
              <p className="text-[11px]" style={{ color: "#8B7BA0" }}>
                Describe what to improve
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full"
            style={{ background: "rgba(180,150,210,0.08)", border: "none", color: "#8B7BA0" }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Textarea */}
        <div className="px-6 py-5">
          <textarea
            autoFocus
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            rows={5}
            disabled={isSubmitting}
            placeholder="e.g. Make the background more detailed, adjust the lighting, add more warmth to the colours…"
            className="w-full rounded-2xl px-4 py-3 text-sm leading-relaxed outline-none resize-none"
            style={{
              border: "1.5px solid rgba(180,150,210,0.2)",
              background: "#FDFBFF",
              color: "#2D2235",
              fontFamily: "inherit",
            }}
          />
        </div>

        {/* Actions */}
        <div className="px-6 pb-10 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3.5 rounded-2xl text-sm font-semibold"
            style={{
              background: "rgba(180,150,210,0.08)",
              color: "#6B5C80",
              border: "none",
              fontFamily: "inherit",
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => {
              if (feedback.trim()) {
                onSubmit(feedback);
                setFeedback("");
              }
            }}
            disabled={isSubmitting || !feedback.trim()}
            className="flex-1 py-3.5 rounded-2xl text-sm font-bold text-white flex items-center justify-center gap-2 disabled:opacity-40"
            style={{
              background: "linear-gradient(135deg, #B05CE6, #E91E8C)",
              boxShadow: "0 4px 16px rgba(176,92,230,0.3)",
              border: "none",
              fontFamily: "inherit",
            }}
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Regenerate
              </>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                            Dot Progress Indicator                          */
/* -------------------------------------------------------------------------- */

function DotProgress({
  total,
  current,
  onDotClick,
}: {
  total: number;
  current: number;
  onDotClick: (i: number) => void;
}) {
  // Show max 7 dots; collapse to a counter if more
  const MAX_DOTS = 7;

  if (total > MAX_DOTS) {
    return (
      <div
        className="px-4 py-1.5 rounded-full text-xs font-bold"
        style={{
          background: "rgba(176,92,230,0.12)",
          color: "#9B59D0",
          fontFamily: "'Bricolage Grotesque', system-ui, sans-serif",
        }}
      >
        {current + 1} / {total}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }).map((_, i) => (
        <button
          key={i}
          onClick={() => onDotClick(i)}
          className="transition-all duration-300"
          style={{
            width: i === current ? 20 : 7,
            height: 7,
            borderRadius: 99,
            background:
              i === current
                ? "linear-gradient(90deg, #B05CE6, #E91E8C)"
                : "rgba(176,92,230,0.2)",
            border: "none",
            padding: 0,
            cursor: "pointer",
          }}
        />
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                              Spread Card                                   */
/* -------------------------------------------------------------------------- */

function SpreadCard({
  spread,
  isGenerating,
  onFeedback,
}: {
  spread: Spread;
  isGenerating: boolean;
  onFeedback: () => void;
}) {
  const hasImage = !!spread.left.imageUrl;

  return (
    <div className="w-full px-4">
      <div
        className="w-full overflow-hidden relative"
        style={{
          borderRadius: 20,
          boxShadow: hasImage
            ? "0 12px 48px rgba(100,40,160,0.18), 0 2px 8px rgba(100,40,160,0.1)"
            : "0 4px 24px rgba(100,40,160,0.08)",
          background: hasImage ? "transparent" : "rgba(176,92,230,0.06)",
          border: hasImage ? "none" : "1.5px dashed rgba(176,92,230,0.2)",
          aspectRatio: "2 / 1",
        }}
      >
        {hasImage ? (
          <>
            <img
              src={spread.left.imageUrl!}
              alt={`Pages ${spread.left.pageNumber}–${spread.right?.pageNumber ?? ""}`}
              className="w-full h-full object-cover"
              draggable={false}
            />

            {/* Page badge */}
            <div
              className="absolute top-3 left-3 px-3 py-1.5 rounded-full text-xs font-bold text-white"
              style={{ background: "rgba(30,10,50,0.7)", backdropFilter: "blur(8px)" }}
            >
              Pages {spread.left.pageNumber}
              {spread.right ? `–${spread.right.pageNumber}` : ""}
            </div>

            {/* Feedback button */}
            <button
              onClick={onFeedback}
              className="absolute top-3 right-3 w-9 h-9 rounded-full flex items-center justify-center text-white transition-transform active:scale-95"
              style={{
                background: "linear-gradient(135deg, #B05CE6, #E91E8C)",
                boxShadow: "0 4px 12px rgba(176,92,230,0.4)",
                border: "none",
              }}
            >
              <Wand2 className="w-4 h-4" />
            </button>
          </>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-3">
            {isGenerating ? (
              <>
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center"
                  style={{ background: "rgba(176,92,230,0.1)" }}
                >
                  <Loader2
                    className="w-6 h-6 animate-spin"
                    style={{ color: "#B05CE6" }}
                  />
                </div>
                <p className="text-xs font-semibold" style={{ color: "#9B59D0" }}>
                  Illustrating…
                </p>
              </>
            ) : (
              <>
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center"
                  style={{ background: "rgba(176,92,230,0.08)" }}
                >
                  <ImagePlus className="w-6 h-6" style={{ color: "#C4A0E0" }} />
                </div>
                <p className="text-xs font-semibold" style={{ color: "#C4A0E0" }}>
                  Not yet illustrated
                </p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                               Mobile Studio                                */
/* -------------------------------------------------------------------------- */

export default function MobileStudio({
  story,
  pages: initialPages,
  mode,
}: {
  story: any;
  pages: Page[];
  mode: "live" | "edit";
}) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);

  const [pages, setPages] = useState<Page[]>(initialPages);
  const [isPolling, setIsPolling] = useState(
    mode === "live" || story.status === "generating"
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);

  const [index, setIndex] = useState(0);
  const [viewportWidth, setViewportWidth] = useState<number | null>(null);
  const x = useMotionValue(0);

  const interiorSpreads = useMemo(() => groupIntoSpreads(pages), [pages]);
  const slides = useMemo(() => {
    if (!story.coverSpreadUrl) return interiorSpreads;
    return ["__COVER__", ...interiorSpreads];
  }, [interiorSpreads, story.coverSpreadUrl]);

  const completedCount = pages.filter((p) => p.imageUrl).length;
  const totalCount = pages.length;
  const allGenerated = completedCount === totalCount && totalCount > 0;

  const currentSlide = slides[index];
  const isCover = currentSlide === "__COVER__";
  const currentSpread = !isCover ? (currentSlide as Spread) : null;

  /* ── Measure ── */
  useEffect(() => {
    const measure = () => {
      const w = containerRef.current?.getBoundingClientRect().width ?? window.innerWidth;
      setViewportWidth(w);
      animate(x, -index * w, { duration: 0 });
    };
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("orientationchange", measure);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("orientationchange", measure);
    };
  }, [index, x]);

  /* ── Polling ── */
  useEffect(() => {
    if (!isPolling) return;
    const interval = setInterval(async () => {
      const res = await fetch(`/api/stories/${story.id}/pages`, { cache: "no-store" });
      if (!res.ok) return;
      const updated: Page[] = await res.json();
      setPages(updated);
      if (updated.every((p) => p.imageUrl)) {
        setIsPolling(false);
        setIsGenerating(false);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [isPolling, story.id]);

  /* ── Navigation ── */
  function clamp(i: number) {
    return Math.max(0, Math.min(i, slides.length - 1));
  }

  function snapTo(i: number) {
    if (viewportWidth == null) return;
    const next = clamp(i);
    setIndex(next);
    animate(x, -next * viewportWidth, { type: "spring", stiffness: 300, damping: 34 });
  }

  function onDragEnd(_: any, info: any) {
    if (viewportWidth == null) return;
    const { offset, velocity } = info;
    if (offset.x < -viewportWidth * 0.15 || velocity.x < -500) snapTo(index + 1);
    else if (offset.x > viewportWidth * 0.15 || velocity.x > 500) snapTo(index - 1);
    else snapTo(index);
  }

  /* ── Actions ── */
  async function handleGenerateAll() {
    if (isGenerating) return;
    setIsGenerating(true);
    setIsPolling(true);
    try {
      const res = await fetch(`/api/stories/${story.id}/generate-all`, { method: "POST" });
      if (!res.ok) throw new Error();
    } catch {
      alert("Failed to start generation");
      setIsGenerating(false);
      setIsPolling(false);
    }
  }

  async function handleFeedback(feedback: string) {
    setIsSubmittingFeedback(true);
    try {
      setFeedbackOpen(false);
      setIsPolling(true);
      setIsGenerating(true);
    } catch {
      alert("Failed to submit feedback");
    } finally {
      setIsSubmittingFeedback(false);
    }
  }

  async function handleExportPDF() {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const res = await fetch(`/api/stories/${story.id}/export-complete`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error();
      window.open(data.url, "_blank");
    } catch {
      alert("Failed to export PDF");
    } finally {
      setIsExporting(false);
    }
  }

  /* ── Render ── */
  if (viewportWidth == null) {
    return (
      <div
        className="w-full flex items-center justify-center py-24"
        style={{ background: "#FDFBFF" }}
      >
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: "#B05CE6" }} />
      </div>
    );
  }

  return (
    <div
      className="w-full flex flex-col"
      style={{
        background: "#FDFBFF",
        fontFamily: "'Bricolage Grotesque', system-ui, sans-serif",
        minHeight: "100%",
      }}
    >
      {/* ── Progress bar (completion) ── */}
      {!allGenerated && (
        <div className="px-4 pt-4 pb-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "#9B59D0" }}>
              Illustrating
            </span>
            <span className="text-[11px] font-bold" style={{ color: "#9B59D0" }}>
              {completedCount}/{totalCount} spreads
            </span>
          </div>
          <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(176,92,230,0.12)" }}>
            <motion.div
              className="h-full rounded-full"
              style={{ background: "linear-gradient(90deg, #B05CE6, #E91E8C)" }}
              initial={{ width: 0 }}
              animate={{ width: `${(completedCount / Math.max(totalCount, 1)) * 100}%` }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            />
          </div>
        </div>
      )}

      {/* ── Generate All button (when not complete) ── */}
      {!allGenerated && (
        <div className="px-4 pt-3 pb-1">
          <button
            onClick={handleGenerateAll}
            disabled={isGenerating}
            className="w-full py-3.5 rounded-2xl text-sm font-bold text-white flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98] transition-transform"
            style={{
              background: "linear-gradient(135deg, #B05CE6, #E91E8C)",
              boxShadow: "0 4px 20px rgba(176,92,230,0.3)",
              border: "none",
            }}
          >
            {isGenerating ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Illustrating your story…</>
            ) : (
              <><Sparkles className="w-4 h-4" /> Generate All Illustrations</>
            )}
          </button>
        </div>
      )}

      {/* ── All done banner ── */}
      {allGenerated && (
        <div
          className="mx-4 mt-4 mb-1 px-4 py-3 rounded-2xl flex items-center gap-2.5"
          style={{ background: "rgba(67,184,156,0.08)", border: "1px solid rgba(67,184,156,0.2)" }}
        >
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(67,184,156,0.15)" }}
          >
            <Check className="w-3.5 h-3.5" style={{ color: "#2FA482" }} />
          </div>
          <p className="text-sm font-semibold" style={{ color: "#2FA482" }}>
            All illustrations complete!
          </p>
        </div>
      )}

      {/* ── Swipe viewer ── */}
      <div ref={containerRef} className="w-full overflow-hidden mt-4">
        <motion.div
          className="flex"
          style={{ x }}
          drag="x"
          dragConstraints={{ left: -((slides.length - 1) * viewportWidth), right: 0 }}
          dragElastic={0.08}
          onDragEnd={onDragEnd}
        >
          {slides.map((s, i) => {
            const isCoverSlide = s === "__COVER__";

            return (
              <div
                key={isCoverSlide ? "cover" : (s as Spread).id}
                style={{ width: viewportWidth, flexShrink: 0 }}
              >
                {isCoverSlide ? (
                  <div className="w-full px-4">
                    <div
                      className="w-full overflow-hidden relative"
                      style={{
                        borderRadius: 20,
                        boxShadow: "0 12px 48px rgba(100,40,160,0.18)",
                        aspectRatio: "2 / 1",
                      }}
                    >
                      <img
                        src={story.coverSpreadUrl}
                        alt="Book cover"
                        className="w-full h-full object-cover"
                        draggable={false}
                      />
                      <div
                        className="absolute top-3 left-3 px-3 py-1.5 rounded-full text-xs font-bold text-white"
                        style={{ background: "rgba(30,10,50,0.7)", backdropFilter: "blur(8px)" }}
                      >
                        Cover
                      </div>
                    </div>
                  </div>
                ) : (
                  <SpreadCard
                    spread={s as Spread}
                    isGenerating={isGenerating}
                    onFeedback={() => setFeedbackOpen(true)}
                  />
                )}
              </div>
            );
          })}
        </motion.div>
      </div>

      {/* ── Navigation row: prev · dots · next ── */}
      <div className="flex items-center justify-between px-6 py-4">
        {/* Prev arrow */}
        <button
          onClick={() => snapTo(index - 1)}
          disabled={index === 0}
          className="w-10 h-10 rounded-full flex items-center justify-center transition-all active:scale-95 disabled:opacity-25"
          style={{
            background: index === 0 ? "rgba(180,150,210,0.08)" : "rgba(176,92,230,0.12)",
            border: "none",
            color: "#9B59D0",
          }}
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        {/* Dot indicators */}
        <DotProgress
          total={slides.length}
          current={index}
          onDotClick={snapTo}
        />

        {/* Next arrow */}
        <button
          onClick={() => snapTo(index + 1)}
          disabled={index === slides.length - 1}
          className="w-10 h-10 rounded-full flex items-center justify-center transition-all active:scale-95 disabled:opacity-25"
          style={{
            background: index === slides.length - 1
              ? "rgba(180,150,210,0.08)"
              : "rgba(176,92,230,0.12)",
            border: "none",
            color: "#9B59D0",
          }}
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* ── Bottom actions ── */}
      <div className="px-4 pb-8 flex flex-col gap-3">
        {/* Design Cover */}
        <button
          onClick={() => router.push(`/stories/${story.id}/cover`)}
          className="w-full py-4 rounded-2xl text-base font-bold text-white flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
          style={{
            background: "linear-gradient(135deg, #B05CE6, #E91E8C)",
            boxShadow: "0 4px 20px rgba(176,92,230,0.28)",
            border: "none",
          }}
        >
          <Wand2 className="w-5 h-5" />
          Design Cover
        </button>

        {/* Export PDF (only when done) */}


// In the bottom actions div, replace with:
{allGenerated && story.coverSpreadUrl && (
  <OrderBookButton storyId={story.id} />
)}

{/* Keep Design Cover button for when cover isn't done */}
{!story.coverSpreadUrl && (
  <button
    onClick={() => router.push(`/stories/${story.id}/cover`)}
    className="w-full py-4 rounded-2xl text-base font-bold text-white flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
    style={{
      background: "linear-gradient(135deg, #B05CE6, #E91E8C)",
      boxShadow: "0 4px 20px rgba(176,92,230,0.28)",
      border: "none",
    }}
  >
    <Wand2 className="w-5 h-5" />
    Design Cover
  </button>
)}

      </div>

      {/* ── Feedback Sheet ── */}
      <AnimatePresence>
        {feedbackOpen && (
          <FeedbackSheet
            onClose={() => setFeedbackOpen(false)}
            onSubmit={handleFeedback}
            isSubmitting={isSubmittingFeedback}
          />
        )}
      </AnimatePresence>
    </div>
  );
}