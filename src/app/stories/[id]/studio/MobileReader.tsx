"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  LayoutGrid,
  X,
  Loader2,
  RefreshCw,
  ImagePlus,
  Play,
  Download,
  Sparkles,
  Wand2,
  Zap,
  Check,
} from "lucide-react";
import { motion, useMotionValue, animate, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";

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

function prefetchImage(src?: string | null) {
  if (!src) return;
  const img = new Image();
  img.src = src;
}

/* -------------------------------------------------------------------------- */
/*                               Feedback Modal                               */
/* -------------------------------------------------------------------------- */

function FeedbackModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (feedback: string) => void;
  isSubmitting: boolean;
}) {
  const [feedback, setFeedback] = useState("");

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, y: 100 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 100 }}
        className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md overflow-hidden max-h-[85vh]"
      >
        <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gradient-to-b from-gray-50 to-white">
          <div>
            <h3 className="font-bold text-lg text-gray-900 flex items-center gap-2">
              <Wand2 className="w-5 h-5 text-purple-600" />
              Redraw Spread
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Tell our AI what to change
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-200 rounded-lg text-gray-500 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          <textarea
            autoFocus
            className="w-full border-2 border-gray-200 rounded-xl p-4 text-sm focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none resize-none h-36 transition-all placeholder:text-gray-400"
            placeholder="e.g. Make the bear friendlier, add flowers, sunset sky..."
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            disabled={isSubmitting}
          />
        </div>

        <div className="px-6 pb-6 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            onClick={() => onSubmit(feedback)}
            disabled={isSubmitting || !feedback.trim()}
            className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 text-white px-4 py-2.5 rounded-xl text-sm font-bold hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-purple-500/25 transition-all"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Creating...
              </>
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
/*                           Premium Loading State                            */
/* -------------------------------------------------------------------------- */

function PremiumLoadingState() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-purple-900/10 via-pink-900/10 to-blue-900/10 backdrop-blur-sm">
      {/* Animated gradient orb */}
      <motion.div
        animate={{
          scale: [1, 1.3, 1],
          opacity: [0.2, 0.4, 0.2],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="absolute w-48 h-48 bg-gradient-to-r from-purple-500 via-pink-500 to-blue-500 rounded-full blur-3xl"
      />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: "linear",
          }}
          className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full mb-4"
        />

        <div className="space-y-1.5 text-center">
          <motion.p
            animate={{ opacity: [0.6, 1, 0.6] }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className="text-sm font-bold text-white"
          >
            AI Artists Working
          </motion.p>
          <p className="text-xs text-white/70">Creating illustration...</p>
        </div>

        {/* Progress dots */}
        <div className="flex gap-2 mt-4">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              animate={{
                scale: [1, 1.5, 1],
                opacity: [0.3, 1, 0.3],
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                ease: "easeInOut",
                delay: i * 0.2,
              }}
              className="w-1.5 h-1.5 bg-white rounded-full"
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                            Empty Spread State                              */
/* -------------------------------------------------------------------------- */

function EmptySpreadState({ 
  onClick, disabled 
}: { 
  onClick: React.MouseEventHandler<HTMLButtonElement>;
  disabled?: boolean 
}) {
  return (
    <motion.button
      onClick={disabled ? undefined : onClick}
      whileTap={disabled ? {} : { scale: 0.95 }}
      className={`absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 group transition-all ${
        disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"
      }`}
    >
      <motion.div
        animate={disabled ? {} : {
          y: [0, -8, 0],
        }}
        transition={disabled ? {} : {
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="relative"
      >
        {/* Gradient glow */}
        <div className={`absolute inset-0 bg-gradient-to-r from-purple-500 via-pink-500 to-blue-500 rounded-full blur-2xl transition-opacity ${
          disabled ? "opacity-10" : "opacity-30 group-active:opacity-50"
        }`} />

        {/* Icon */}
        <div className={`relative w-16 h-16 bg-white/10 backdrop-blur rounded-2xl border border-white/20 flex items-center justify-center transition-all ${
          disabled ? "" : "group-active:bg-white/20"
        }`}>
          <ImagePlus className={`w-8 h-8 ${disabled ? "text-white/40" : "text-white/80"}`} />
        </div>
      </motion.div>

      <div className="mt-5 space-y-1">
        <p className={`text-sm font-bold flex items-center gap-2 justify-center ${
          disabled ? "text-white/50" : "text-white"
        }`}>
          <Sparkles className="w-4 h-4" />
          {disabled ? "Generation In Progress" : "Generate Illustration"}
        </p>
        <p className={`text-xs ${disabled ? "text-white/40" : "text-white/60"}`}>
          {disabled ? "Please wait..." : "Tap to create with AI"}
        </p>
      </div>
    </motion.button>
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
  const overviewScrollRef = useRef<HTMLDivElement>(null);

  /* --------------------------------- State -------------------------------- */

  const [pages, setPages] = useState<Page[]>(initialPages);
  const [isPolling, setIsPolling] = useState(
    mode === "live" || story.status === "generating"
  );
  const [regeneratingIds, setRegeneratingIds] = useState<Set<string>>(
    new Set()
  );
  const [isStartingGlobal, setIsStartingGlobal] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Navigation state
  const [index, setIndex] = useState(0);
  const [showUI, setShowUI] = useState(true);
  const [showOverview, setShowOverview] = useState(false);
  const [viewportWidth, setViewportWidth] = useState<number | null>(null);

  // Modal State
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);

  const x = useMotionValue(0);

  const spreads = useMemo(() => groupIntoSpreads(pages), [pages]);
  const spread = spreads[index];

  /* ------------------------------ Polling ---------------------------------- */

  useEffect(() => {
    if (!isPolling) return;

    let cancelled = false;

    const interval = setInterval(async () => {
      if (cancelled) return;

      try {
        const res = await fetch(`/api/stories/${story.id}/pages`, {
          cache: "no-store",
        });

        if (!res.ok) {
          console.warn("Polling failed:", res.status);
          return;
        }

        const updatedPages: Page[] = await res.json();

        setPages(updatedPages);

        setRegeneratingIds((prev) => {
          const next = new Set(prev);
          for (const page of updatedPages) {
            if (page.imageUrl) {
              next.delete(page.id);
            }
          }
          return next;
        });

        if (
          updatedPages.every((p) => p.imageUrl) &&
          regeneratingIds.size === 0
        ) {
          setIsPolling(false);
          setIsStartingGlobal(false);
        }
      } catch (err) {
        console.warn("Polling fetch failed (will retry):", err);
      }
    }, 3000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [isPolling, story.id, regeneratingIds.size]);

  /* ------------------------------ Measure width ---------------------------- */

  useEffect(() => {
    const measure = () => {
      const el = containerRef.current;
      const w = el?.getBoundingClientRect().width ?? window.innerWidth;
      setViewportWidth(w);
      animate(x, -index * w, { duration: 0 });
    };

    measure();

    const ro =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(measure)
        : null;

    if (ro && containerRef.current) ro.observe(containerRef.current);

    window.addEventListener("resize", measure);
    window.addEventListener("orientationchange", measure);

    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("orientationchange", measure);
      ro?.disconnect();
    };
  }, [index, x]);

  /* ------------------------------ Navigation -------------------------------- */

  function clamp(i: number) {
    return Math.max(0, Math.min(i, spreads.length - 1));
  }

  function snapTo(i: number) {
    if (viewportWidth == null) return;

    const next = clamp(i);
    setIndex(next);

    animate(x, -next * viewportWidth, {
      type: "spring",
      stiffness: 280,
      damping: 34,
    });
  }

  function onDragEnd(_: any, info: any) {
    if (viewportWidth == null) return;

    const offset = info.offset.x;
    const velocity = info.velocity.x;

    if (offset < -viewportWidth * 0.15 || velocity < -500) {
      snapTo(index + 1);
    } else if (offset > viewportWidth * 0.15 || velocity > 500) {
      snapTo(index - 1);
    } else {
      snapTo(index);
    }
  }

  /* ------------------------------ UI behaviour ----------------------------- */

  useEffect(() => {
    if (!showUI || showOverview) return;
    const t = setTimeout(() => setShowUI(false), 2200);
    return () => clearTimeout(t);
  }, [showUI, showOverview]);

  /* ------------------------------ Prefetching ------------------------------ */

  useEffect(() => {
    prefetchImage(spreads[index - 1]?.left?.imageUrl);
    prefetchImage(spreads[index + 1]?.left?.imageUrl);
  }, [index, spreads]);

  /* --------------------------- Overview scroll sync ------------------------ */

  useEffect(() => {
    if (!showOverview) return;

    const container = overviewScrollRef.current;
    if (!container) return;

    const active = container.querySelector<HTMLElement>(
      `[data-index="${index}"]`
    );

    if (!active) return;

    const containerRect = container.getBoundingClientRect();
    const activeRect = active.getBoundingClientRect();

    const offset =
      activeRect.top - containerRect.top - container.clientHeight / 3;

    container.scrollBy({
      top: offset,
      behavior: "smooth",
    });
  }, [showOverview, index]);

  /* -------------------------------- Actions -------------------------------- */

  const openRegenerateModal = (leftPageId: string) => {
    setSelectedPageId(leftPageId);
    setFeedbackModalOpen(true);
  };

  async function handleRegenerateSubmit(feedback: string) {
    if (!selectedPageId) return;

    setIsSubmittingFeedback(true);
    setRegeneratingIds((prev) => new Set(prev).add(selectedPageId));

    try {
      const res = await fetch(
        `/api/stories/${story.id}/pages/${selectedPageId}/regenerate`,
        {
          method: "POST",
          body: JSON.stringify({ feedback }),
          headers: { "Content-Type": "application/json" },
        }
      );

      if (!res.ok) throw new Error("API Failed");

      setIsPolling(true);
      setFeedbackModalOpen(false);
      setSelectedPageId(null);
    } catch {
      alert("Failed to regenerate spread");
      setRegeneratingIds((prev) => {
        const next = new Set(prev);
        next.delete(selectedPageId);
        return next;
      });
    } finally {
      setIsSubmittingFeedback(false);
    }
  }

  async function getSingleSpread(selectedPageId: string) {
    if (!selectedPageId) return;

    setIsSubmittingFeedback(true);
    setRegeneratingIds((prev) => new Set(prev).add(selectedPageId));

    try {
      const res = await fetch(
        `/api/stories/${story.id}/pages/${selectedPageId}/regenerate`,
        {
          method: "POST",
          body: JSON.stringify({}),
          headers: { "Content-Type": "application/json" },
        }
      );

      if (!res.ok) throw new Error("API Failed");

      setIsPolling(true);
      setSelectedPageId(null);
    } catch {
      alert("Failed to generate spread");
      setRegeneratingIds((prev) => {
        const next = new Set(prev);
        next.delete(selectedPageId);
        return next;
      });
    } finally {
      setIsSubmittingFeedback(false);
    }
  }

  async function handleGenerateAll() {
    if (!confirm("Generate all missing illustrations?")) return;
    setIsStartingGlobal(true);

    try {
      await fetch(`/api/stories/${story.id}/start-generation`, {
        method: "POST",
      });
      setIsPolling(true);
    } catch {
      alert("Failed to start generation");
      setIsStartingGlobal(false);
    }
  }

  async function handleExportPDF() {
    if (isExporting) return;
    setIsExporting(true);

    try {
      const res = await fetch(`/api/stories/${story.id}/export-pdf`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error();
      window.open(data.url, "_blank");
    } catch {
      alert("Failed to export PDF");
    } finally {
      setIsExporting(false);
    }
  }

  const completedCount = pages.filter((p) => p.imageUrl).length;
  const totalCount = pages.length;

  /* --------------------------------- Render -------------------------------- */

  if (viewportWidth == null) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-white/60" />
      </div>
    );
  }

  const isRegenerating = regeneratingIds.has(spread?.left?.id);
  const hasImage = !!spread?.left?.imageUrl;

  return (
    <div
      ref={containerRef}
      className={`fixed inset-0 bg-black text-white ${
        showOverview ? "overflow-y-auto" : "overflow-hidden"
      }`}
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
        paddingLeft: "env(safe-area-inset-left)",
        paddingRight: "env(safe-area-inset-right)",
      }}
    >
      {/* FEEDBACK MODAL */}
      <AnimatePresence>
        {feedbackModalOpen && (
          <FeedbackModal
            isOpen={feedbackModalOpen}
            onClose={() => setFeedbackModalOpen(false)}
            onSubmit={handleRegenerateSubmit}
            isSubmitting={isSubmittingFeedback}
          />
        )}
      </AnimatePresence>

      {/* ============================ SWIPE TRACK ============================ */}
      <motion.div
        className="flex h-full"
        style={{ x }}
        drag={showOverview ? false : "x"}
        dragConstraints={{
          left: -((spreads.length - 1) * viewportWidth),
          right: 0,
        }}
        dragElastic={0.08}
        onDragEnd={onDragEnd}
        onTap={() => setShowUI((v) => !v)}
      >
        {spreads.map((s) => {
          const isThisRegenerating = regeneratingIds.has(s.left.id);
          const hasThisImage = !!s.left.imageUrl;

          return (
            <div
              key={s.id}
              className="flex-none shrink-0 h-full flex items-center justify-center px-4 landscape:px-16"
              style={{ width: viewportWidth }}
            >
              <div className="bg-black rounded-2xl shadow-2xl overflow-hidden max-w-[1100px] w-full h-full landscape:h-[90%] flex items-center justify-center relative border border-white/10">
                {hasThisImage && !isThisRegenerating ? (
                  <>
                    <img
                      src={s.left.imageUrl!}
                      alt={`Pages ${s.left.pageNumber}${
                        s.right ? `–${s.right.pageNumber}` : ""
                      }`}
                      className="max-w-full max-h-full object-contain"
                      draggable={false}
                    />

                    {/* Page numbers */}
                    <div className="absolute bottom-4 left-4 bg-white/10 backdrop-blur-xl px-3 py-1.5 rounded-full text-xs font-bold text-white pointer-events-none border border-white/10">
                      Page {s.left.pageNumber}
                    </div>

                    {s.right && (
                      <div className="absolute bottom-4 right-4 bg-white/10 backdrop-blur-xl px-3 py-1.5 rounded-full text-xs font-bold text-white pointer-events-none border border-white/10">
                        Page {s.right.pageNumber}
                      </div>
                    )}
                  </>
                ) : isThisRegenerating ? (
                  <PremiumLoadingState />
                ) : (
                  <EmptySpreadState
                    onClick={(e) => {
                      e.stopPropagation();
                      getSingleSpread(s.left.id);
                    }}
                    disabled={isStartingGlobal || isPolling}
                  />
                )}
              </div>
            </div>
          );
        })}
      </motion.div>

      {/* ============================== TOP UI =============================== */}
      {showUI && !showOverview && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="absolute top-0 inset-x-0 px-4 pt-2 pb-6 flex items-center justify-between bg-gradient-to-b from-black/90 via-black/60 to-transparent"
        >
          <button
            onClick={() => router.push("/dashboard")}
            className="p-2.5 rounded-xl hover:bg-white/10 active:bg-white/20 backdrop-blur"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <div className="flex flex-col items-center gap-1">
            <div className="text-xs font-semibold text-white/90">
              {spread?.left?.pageNumber}
              {spread?.right && `–${spread.right.pageNumber}`} / {pages.length}
            </div>

            {isPolling && (
              <span className="flex items-center gap-1.5 text-[10px] font-medium text-purple-400 px-2 py-1 rounded-full bg-white/10 backdrop-blur">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "linear",
                  }}
                >
                  <Sparkles className="w-3 h-3" />
                </motion.div>
                {totalCount - completedCount} generating
              </span>
            )}
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowOverview(true);
            }}
            className="p-2.5 rounded-xl hover:bg-white/10 active:bg-white/20 backdrop-blur"
          >
            <LayoutGrid className="w-5 h-5" />
          </button>
        </motion.div>
      )}

      {/* ========================== BOTTOM ACTION BAR ======================== */}
      {showUI && !showOverview && hasImage && !isRegenerating && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className="absolute bottom-0 inset-x-0 px-4 pb-2 pt-6 flex items-center justify-center gap-3 bg-gradient-to-t from-black/90 via-black/60 to-transparent"
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              openRegenerateModal(spread.left.id);
            }}
            className="bg-white/15 backdrop-blur-xl text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-white/25 active:bg-white/30 flex items-center gap-2 transition-colors border border-white/10"
          >
            <RefreshCw className="w-4 h-4" />
            Redraw
          </button>
        </motion.div>
      )}

      {/* ============================== OVERVIEW ============================== */}
      {showOverview && (
        <div className="absolute inset-0 z-50 bg-gradient-to-br from-gray-900 via-black to-gray-900 flex flex-col">
          {/* Header */}
          <header className="flex-none px-4 py-3 flex items-center justify-between border-b border-white/10 bg-white/5 backdrop-blur-xl">
            <div>
              <h2 className="text-sm font-bold">All Spreads</h2>
              <p className="text-[10px] text-white/60 mt-0.5">
                {completedCount} of {totalCount} complete
              </p>
            </div>

            <div className="flex items-center gap-2">
              {pages.some((p) => !p.imageUrl) && !isPolling && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleGenerateAll();
                  }}
                  disabled={isStartingGlobal}
                  className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 hover:from-purple-700 hover:to-pink-700 active:from-purple-800 active:to-pink-800 transition-all shadow-lg shadow-purple-500/25 disabled:opacity-50"
                >
                  {isStartingGlobal ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Zap className="w-3.5 h-3.5 fill-current" />
                  )}
                  Generate All
                </button>
              )}

              <button
                onClick={() => setShowOverview(false)}
                className="p-2 rounded-xl hover:bg-white/10 active:bg-white/20"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </header>

          {/* Grid */}
          <div
            ref={overviewScrollRef}
            className="flex-1 p-4 grid grid-cols-2 gap-3 overflow-y-auto pb-24 overscroll-contain touch-pan-y"
          >
            {spreads.map((s, i) => {
              const isThisRegenerating = regeneratingIds.has(s.left.id);
              const hasThisImage = !!s.left.imageUrl;

              return (
                <button
                  key={s.id}
                  data-index={i}
                  onClick={(e) => {
                    e.stopPropagation();
                    snapTo(i);
                    setShowOverview(false);
                    setShowUI(false);
                  }}
                  className={`relative rounded-xl overflow-hidden ${
                    i === index
                      ? "ring-2 ring-purple-500 border-2 border-purple-500"
                      : "border border-white/10 hover:border-white/30 active:border-white/50"
                  }`}
                >
                  {hasThisImage && !isThisRegenerating ? (
                    <img
                      src={s.left.imageUrl!}
                      className="w-full aspect-[3/4] object-contain bg-black"
                      alt=""
                      draggable={false}
                    />
                  ) : isThisRegenerating ? (
                    <div className="w-full aspect-[3/4] flex flex-col items-center justify-center bg-gradient-to-br from-purple-900/20 via-pink-900/20 to-blue-900/20">
                      <Loader2 className="w-6 h-6 text-purple-400 animate-spin mb-2" />
                      <span className="text-[10px] text-white/60 font-medium">
                        Creating...
                      </span>
                    </div>
                  ) : (
                    <div className="w-full aspect-[3/4] flex flex-col items-center justify-center text-xs text-white/40 bg-gray-900 border border-white/5">
                      <ImagePlus className="w-6 h-6 mb-1" />
                      <span className="text-[10px]">Not Generated</span>
                    </div>
                  )}

                  <span className="absolute bottom-2 right-2 text-[10px] bg-black/70 backdrop-blur px-2 py-1 rounded-full font-bold border border-white/10">
                    {s.left.pageNumber}
                    {s.right && `–${s.right.pageNumber}`}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Bottom action bar */}
          <div className="flex-none px-4 py-3 border-t border-white/10 bg-white/5 backdrop-blur-xl flex justify-center gap-3">
            <button
              onClick={(e) => {
                e.stopPropagation();
                router.push(`/stories/${story.id}/cover`);
              }}
              className="bg-white/10 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-white/20 active:bg-white/30 border border-white/10"
            >
              Create Cover
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                handleExportPDF();
              }}
              disabled={isExporting}
              className="bg-white/10 text-white px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 hover:bg-white/20 active:bg-white/30 disabled:opacity-50 border border-white/10"
            >
              {isExporting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              {isExporting ? "Exporting…" : "Export"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}