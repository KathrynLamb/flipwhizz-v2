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
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, y: 100 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 100 }}
        className="bg-white rounded-t-2xl sm:rounded-xl shadow-2xl w-full sm:max-w-md overflow-hidden max-h-[85vh]"
      >
        <div className="p-4 border-b border-stone-100 flex justify-between items-center bg-stone-50">
          <h3 className="font-serif text-lg font-bold text-stone-800">
            Redraw Spread
          </h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-stone-200 rounded-full text-stone-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          <p className="text-sm text-stone-600 mb-3">
            What should be different in the new version?
          </p>
          <textarea
            autoFocus
            className="w-full border border-stone-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none resize-none h-32"
            placeholder="e.g. Make the bear look friendlier, remove the tree in the background..."
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            disabled={isSubmitting}
          />
        </div>

        <div className="p-4 bg-stone-50 border-t border-stone-100 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-stone-600 hover:text-stone-900"
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            onClick={() => onSubmit(feedback)}
            disabled={isSubmitting || !feedback.trim()}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Regenerate
          </button>
        </div>
      </motion.div>
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

        // Remove pages that finished regenerating
        setRegeneratingIds((prev) => {
          const next = new Set(prev);
          for (const page of updatedPages) {
            if (page.imageUrl) {
              next.delete(page.id);
            }
          }
          return next;
        });

        // Stop polling when everything is done
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
      // snap instantly to correct position
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
              <div className="bg-black rounded-xl shadow-2xl overflow-hidden max-w-[1100px] w-full h-full landscape:h-[90%] flex items-center justify-center relative">
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
                    <div className="absolute bottom-4 left-4 bg-black/40 backdrop-blur px-3 py-1 rounded-full text-[10px] font-bold text-white pointer-events-none">
                      Page {s.left.pageNumber}
                    </div>

                    {s.right && (
                      <div className="absolute bottom-4 right-4 bg-black/40 backdrop-blur px-3 py-1 rounded-full text-[10px] font-bold text-white pointer-events-none">
                        Page {s.right.pageNumber}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-stone-900">
                    {isThisRegenerating ? (
                      <div className="flex flex-col items-center animate-pulse">
                        <Loader2 className="w-10 h-10 text-indigo-400 animate-spin mb-4" />
                        <span className="text-sm font-bold uppercase tracking-widest text-stone-400">
                          Drawing Spread…
                        </span>
                      </div>
                    ) : (
                      <div
                        className="cursor-pointer group/gen"
                        onClick={(e) => {
                          e.stopPropagation();
                          getSingleSpread(s.left.id);
                        }}
                      >
                        <div className="w-20 h-20 bg-white/10 rounded-full flex items-center justify-center shadow-sm mb-4 mx-auto group-hover/gen:scale-110 transition-transform">
                          <ImagePlus className="w-8 h-8 text-white/60 group-hover/gen:text-indigo-500 transition-colors" />
                        </div>
                        <span className="text-sm font-bold text-white/60 group-hover/gen:text-indigo-400 transition-colors">
                          Generate Spread
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </motion.div>

      {/* ============================== TOP UI =============================== */}
      {showUI && !showOverview && (
        <div className="absolute top-0 inset-x-0 px-4 pt-2 pb-4 flex items-center justify-between bg-gradient-to-b from-black/90 via-black/70 to-transparent">
          <button
            onClick={() => router.push("/dashboard")}
            className="p-2 rounded-full hover:bg-white/10 active:bg-white/20"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <div className="flex flex-col items-center gap-1">
            <div className="text-xs font-medium text-white/70">
              Pages {spread?.left?.pageNumber}
              {spread?.right && `–${spread.right.pageNumber}`} / {pages.length}
            </div>

            {isPolling && (
              <span className="flex items-center gap-1 text-[10px] text-indigo-400 animate-pulse">
                <Loader2 className="w-3 h-3 animate-spin" />
                Working…
              </span>
            )}
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowOverview(true);
            }}
            className="p-2 rounded-full hover:bg-white/10 active:bg-white/20"
          >
            <LayoutGrid className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* ========================== BOTTOM ACTION BAR ======================== */}
      {showUI && !showOverview && hasImage && !isRegenerating && (
        <div className="absolute bottom-0 inset-x-0 px-4 pb-2 pt-4 flex items-center justify-center gap-3 bg-gradient-to-t from-black/90 via-black/70 to-transparent">
          <button
            onClick={(e) => {
              e.stopPropagation();
              openRegenerateModal(spread.left.id);
            }}
            className="bg-white/10 backdrop-blur text-white px-4 py-2 rounded-full text-xs font-bold hover:bg-white/20 active:bg-white/30 flex items-center gap-2 transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            Redraw
          </button>
        </div>
      )}

      {/* ============================== OVERVIEW ============================== */}
      {showOverview && (
        <div className="absolute inset-0 z-50 bg-black flex flex-col">
          {/* Header */}
          <header className="flex-none h-14 px-4 flex items-center justify-between border-b border-white/10">
            <h2 className="text-sm font-bold">All Spreads</h2>

            <div className="flex items-center gap-2">
              {pages.some((p) => !p.imageUrl) && !isPolling && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleGenerateAll();
                  }}
                  disabled={isStartingGlobal}
                  className="bg-indigo-600 text-white px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 hover:bg-indigo-700 active:bg-indigo-800 transition-all disabled:opacity-50"
                >
                  {isStartingGlobal ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Play className="w-3 h-3 fill-current" />
                  )}
                  Generate All
                </button>
              )}

              <button
                onClick={() => setShowOverview(false)}
                className="p-2 rounded-full hover:bg-white/10 active:bg-white/20"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </header>

          {/* Grid */}
          <div
            ref={overviewScrollRef}
            className="flex-1 p-4 grid grid-cols-2 gap-4 overflow-y-auto pb-24 overscroll-contain touch-pan-y"
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
                  className={`relative rounded-lg overflow-hidden border ${
                    i === index
                      ? "border-white ring-2 ring-white"
                      : "border-white/10 hover:border-white/30 active:border-white/50"
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
                    <div className="w-full aspect-[3/4] flex flex-col items-center justify-center bg-stone-900">
                      <Loader2 className="w-6 h-6 text-indigo-400 animate-spin mb-2" />
                      <span className="text-[10px] text-white/40">
                        Drawing...
                      </span>
                    </div>
                  ) : (
                    <div className="w-full aspect-[3/4] flex items-center justify-center text-xs text-white/40 bg-stone-900">
                      Not Generated
                    </div>
                  )}

                  <span className="absolute bottom-2 right-2 text-[10px] bg-black/70 px-2 py-1 rounded-full font-bold">
                    {s.left.pageNumber}
                    {s.right && `–${s.right.pageNumber}`}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Bottom action bar */}
          <div className="flex-none px-4 py-3 border-t border-white/10 bg-black/50 backdrop-blur flex justify-center gap-3">
            <button
              onClick={(e) => {
                e.stopPropagation();
                router.push(`/stories/${story.id}/cover`);
              }}
              className="bg-white/10 text-white px-4 py-2 rounded-full text-xs font-bold hover:bg-white/20 active:bg-white/30"
            >
              Create Cover
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                handleExportPDF();
              }}
              disabled={isExporting}
              className="bg-white/10 text-white px-4 py-2 rounded-full text-xs font-bold flex items-center gap-2 hover:bg-white/20 active:bg-white/30 disabled:opacity-50"
            >
              {isExporting ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Download className="w-3 h-3" />
              )}
              {isExporting ? "Exporting…" : "Export PDF"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}