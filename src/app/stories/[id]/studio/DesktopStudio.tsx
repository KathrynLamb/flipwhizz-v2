"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Loader2,
  RefreshCw,
  ChevronLeft,
  Download,
  Play,
  ImagePlus,
  X,
  Sparkles,
  Wand2,
  Zap,
  Check,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";

/* ---------------------------------- Types --------------------------------- */

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

/* -------------------------- Helper: build spreads -------------------------- */

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-200/50"
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
            placeholder="e.g. Make the bear look friendlier, add more flowers, change the sky to sunset..."
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
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50">
      {/* Animated gradient orb */}
      <motion.div
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.3, 0.6, 0.3],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="absolute w-64 h-64 bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 rounded-full blur-3xl"
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
          className="w-16 h-16 border-4 border-purple-200 border-t-purple-600 rounded-full mb-6"
        />

        <div className="space-y-2 text-center">
          <motion.p
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className="text-sm font-bold text-gray-700"
          >
            AI Artists Working
          </motion.p>
          <p className="text-xs text-gray-500">Creating your illustration...</p>
        </div>

        {/* Progress dots */}
        <div className="flex gap-2 mt-6">
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
              className="w-2 h-2 bg-purple-600 rounded-full"
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

function EmptySpreadState({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <motion.button
      onClick={disabled ? undefined : onClick}
      whileHover={disabled ? {} : { scale: 1.02 }}
      whileTap={disabled ? {} : { scale: 0.98 }}
      className={`absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-gray-50 via-white to-gray-50 group transition-all ${
        disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"
      }`}
    >
      <motion.div
        animate={disabled ? {} : {
          y: [0, -10, 0],
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
          disabled ? "opacity-10" : "opacity-20 group-hover:opacity-40"
        }`} />

        {/* Icon */}
        <div className={`relative w-20 h-20 bg-white rounded-2xl shadow-lg border border-gray-200 flex items-center justify-center transition-all ${
          disabled ? "" : "group-hover:shadow-xl group-hover:border-purple-300"
        }`}>
          <ImagePlus className={`w-9 h-9 transition-colors ${
            disabled ? "text-gray-300" : "text-gray-400 group-hover:text-purple-600"
          }`} />
        </div>
      </motion.div>

      <div className="mt-6 space-y-1.5">
        <p className={`text-sm font-bold flex items-center gap-2 justify-center transition-colors ${
          disabled ? "text-gray-400" : "text-gray-900 group-hover:text-purple-600"
        }`}>
          <Sparkles className="w-4 h-4" />
          {disabled ? "Generation In Progress" : "Generate Illustration"}
        </p>
        <p className={`text-xs ${disabled ? "text-gray-400" : "text-gray-500"}`}>
          {disabled ? "Please wait..." : "Click to create with AI"}
        </p>
      </div>
    </motion.button>
  );
}

/* -------------------------------------------------------------------------- */
/*                               Desktop Studio                               */
/* -------------------------------------------------------------------------- */

export default function DesktopStudio({
  story,
  pages: initialPages,
  styleGuide,
  mode,
}: {
  story: any;
  pages: Page[];
  styleGuide: any;
  mode: "live" | "edit";
}) {
  const router = useRouter();

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

  // Modal State
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);

  const spreads = useMemo(() => groupIntoSpreads(pages), [pages]);

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

        const allDone =
          updatedPages.every((p) => p.imageUrl) && regeneratingIds.size === 0;
        if (allDone) {
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
  const progress = (completedCount / totalCount) * 100;

  /* --------------------------------- Render -------------------------------- */

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 pb-40">
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

      {/* ============================== HEADER ============================== */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-gray-200/50 px-8 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard"
            className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </Link>

          <div>
            <h1 className="font-bold text-xl text-gray-900 max-w-md truncate">
              {story.title}
            </h1>

            <div className="flex items-center gap-3 mt-1">
              {isPolling ? (
                <span className="flex items-center gap-2 text-xs font-medium text-purple-600">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: "linear",
                    }}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                  </motion.div>
                  Generating {totalCount - completedCount} spreads
                </span>
              ) : (
                <span className="flex items-center gap-2 text-xs font-medium text-green-600">
                  <Check className="w-3.5 h-3.5" />
                  {completedCount} of {totalCount} complete
                </span>
              )}

              {/* Progress bar */}
              {isPolling && (
                <div className="w-32 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
                    initial={{ width: "0%" }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {pages.some((p) => !p.imageUrl) && !isPolling && (
            <button
              onClick={handleGenerateAll}
              disabled={isStartingGlobal}
              className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 hover:from-purple-700 hover:to-pink-700 transition-all shadow-lg shadow-purple-500/25 disabled:opacity-50"
            >
              {isStartingGlobal ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Zap className="w-4 h-4 fill-current" />
              )}
              Generate All
            </button>
          )}

          <button
            onClick={() => router.push(`/stories/${story.id}/cover`)}
            className="bg-gray-900 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-black transition-all shadow-lg"
          >
            Create Cover
          </button>

          <button
            onClick={handleExportPDF}
            disabled={isExporting}
            className="bg-gray-900 text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-black transition-all shadow-lg disabled:opacity-50"
          >
            {isExporting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            {isExporting ? "Exporting…" : "Export PDF"}
          </button>
        </div>
      </header>

      {/* ============================== SPREADS ============================== */}
      <div className="max-w-[1400px] mx-auto p-8 space-y-8">
        {spreads.map((spread) => {
          const isRegenerating = regeneratingIds.has(spread.left.id);
          const hasImage = !!spread.left.imageUrl;

          return (
            <motion.div
              key={spread.id}
              layout
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="group relative bg-white rounded-2xl shadow-sm border border-gray-200/50 overflow-hidden hover:shadow-xl hover:border-gray-300/50 transition-all"
            >
              <div className="relative w-full aspect-[2/1] bg-gradient-to-br from-gray-100 via-white to-gray-100 overflow-hidden">
                {hasImage && !isRegenerating ? (
                  <>
                    <img
                      src={spread.left.imageUrl!}
                      alt={`Pages ${spread.left.pageNumber}–${spread.right?.pageNumber}`}
                      className="w-full h-full object-contain"
                    />

                    {/* ACTIONS OVERLAY */}
                    <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => openRegenerateModal(spread.left.id)}
                        className="bg-white/95 backdrop-blur-xl text-gray-900 px-4 py-2.5 rounded-xl text-sm font-semibold shadow-xl hover:bg-white flex items-center gap-2 transition-all border border-gray-200/50"
                      >
                        <RefreshCw className="w-4 h-4" />
                        Redraw
                      </button>
                    </div>
                  </>
                ) : isRegenerating ? (
                  <PremiumLoadingState />
                ) : (
                  <EmptySpreadState
                    onClick={() => getSingleSpread(spread.left.id)}
                    disabled={isStartingGlobal || isPolling}
                  />
                )}

                {/* Page numbers */}
                <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full text-xs font-bold text-white pointer-events-none">
                  Page {spread.left.pageNumber}
                </div>

                {spread.right && (
                  <div className="absolute bottom-4 right-4 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full text-xs font-bold text-white pointer-events-none">
                    Page {spread.right.pageNumber}
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}