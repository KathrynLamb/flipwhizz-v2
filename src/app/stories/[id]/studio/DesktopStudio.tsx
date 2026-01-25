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
  MessageSquarePlus
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
  isSubmitting 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  onSubmit: (feedback: string) => void;
  isSubmitting: boolean;
}) {
  const [feedback, setFeedback] = useState("");

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden"
      >
        <div className="p-4 border-b border-stone-100 flex justify-between items-center bg-stone-50">
          <h3 className="font-serif text-lg font-bold text-stone-800">Redraw Spread</h3>
          <button onClick={onClose} className="p-1 hover:bg-stone-200 rounded-full text-stone-500">
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
        
        // 🔑 REMOVE pages that finished regenerating
        setRegeneratingIds((prev) => {
          const next = new Set(prev);
          for (const page of updatedPages) {
            if (page.imageUrl) {
              next.delete(page.id);
            }
          }
          return next;
        });
        
        // Stop polling only when nothing left regenerating
        if (updatedPages.every((p) => p.imageUrl) && regeneratingIds.size === 0) {
          setIsPolling(false);
          setIsStartingGlobal(false);
        }
        
  
        const allDone = updatedPages.every((p) => p.imageUrl);
        if (allDone && regeneratingIds.size === 0) {
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
    // Optimistically verify UI state
    setRegeneratingIds((prev) => new Set(prev).add(selectedPageId));

    try {
      // Call the API with the feedback
      const res = await fetch(
        `/api/stories/${story.id}/pages/${selectedPageId}/regenerate`,
        { 
            method: "POST",
            body: JSON.stringify({ feedback }),
            headers: { "Content-Type": "application/json" }
        }
      );

      if(!res.ok) throw new Error("API Failed");

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
    // Optimistically verify UI state
    setRegeneratingIds((prev) => new Set(prev).add(selectedPageId));

    try {
      // Call the API with the feedback
      const res = await fetch(
        `/api/stories/${story.id}/pages/${selectedPageId}/regenerate`,
        { 
            method: "POST",
            body: JSON.stringify({  }),
            headers: { "Content-Type": "application/json" }
        }
      );

      if(!res.ok) throw new Error("API Failed");

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

  return (
    <div className="pb-40">
      
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
      <header className="sticky top-0 z-40 bg-[#FAF9F6]/95 backdrop-blur-md border-b border-stone-200 px-8 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard"
            className="p-2 hover:bg-stone-200 rounded-full transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-stone-600" />
          </Link>

          <div>
            <h1 className="font-serif text-xl text-stone-900 font-bold max-w-md truncate">
              {story.title}
            </h1>

            <div className="text-xs text-stone-500 font-medium uppercase tracking-widest flex items-center gap-2">
              {isPolling ? (
                <span className="flex items-center gap-1 text-indigo-600 animate-pulse">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Artists Working…
                </span>
              ) : (
                <span className="flex items-center gap-1 text-green-600">
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                  Studio Ready
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {pages.some((p) => !p.imageUrl) && !isPolling && (
            <button
              onClick={handleGenerateAll}
              disabled={isStartingGlobal}
              className="bg-indigo-600 text-white px-5 py-2 rounded-full text-sm font-bold flex items-center gap-2 hover:bg-indigo-700 transition-all shadow-md"
            >
              {isStartingGlobal ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Play className="w-4 h-4 fill-current" />
              )}
              Generate All
            </button>
          )}

          <button
            onClick={() => router.push(`/stories/${story.id}/cover`)}
            className="bg-stone-900 text-white px-5 py-2 rounded-full text-sm font-bold hover:bg-black transition-all shadow-md"
          >
            Create Cover
          </button>

          <button
            onClick={handleExportPDF}
            disabled={isExporting}
            className="bg-stone-900 text-white px-5 py-2 rounded-full text-sm font-bold flex items-center gap-2 hover:bg-black transition-all shadow-md disabled:opacity-50"
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
      <div className="max-w-[1400px] mx-auto p-8 space-y-12">
        {spreads.map((spread) => {
              const isRegenerating = regeneratingIds.has(spread.left.id);
              const hasImage = !!spread.left.imageUrl;


          return (
            <motion.div
              key={spread.id}
              layout
              className="group relative bg-white rounded-xl shadow-lg border border-stone-200/50 overflow-hidden"
            >
              <div className="relative w-full aspect-video bg-stone-200/50 overflow-hidden">
                {hasImage && !isRegenerating ? (
                  <>
                    <img
                      src={spread.left.imageUrl!}
                      alt={`Pages ${spread.left.pageNumber}–${spread.right?.pageNumber}`}
                      className="w-full h-full object-contain"
                    />

                    {/* ACTIONS OVERLAY */}
                    <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                      <button
                        onClick={() => openRegenerateModal(spread.left.id)}
                        className="bg-white/90 backdrop-blur text-stone-700 px-4 py-2 rounded-full text-xs font-bold shadow-lg hover:text-indigo-600 flex items-center gap-2 transition-colors"
                      >
                        <RefreshCw className="w-3 h-3" />
                        Redraw Spread
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-stone-50">
                    {isRegenerating ? (
                      <div className="flex flex-col items-center animate-pulse">
                        <Loader2 className="w-10 h-10 text-indigo-400 animate-spin mb-4" />
                        <span className="text-sm font-bold uppercase tracking-widest text-stone-400">
                          {isRegenerating
                            ? "Drawing Spread…"
                            : "In Queue…"}
                        </span>
                      </div>
                    ) : (
                      <div
                        className="cursor-pointer group/gen"
                        // onClick={() => openRegenerateModal(spread.left.id)}
                        onClick={() => getSingleSpread(spread.left.id)}
                      >
                        <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-sm mb-4 mx-auto group-hover/gen:scale-110 transition-transform">
                          <ImagePlus className="w-8 h-8 text-stone-300 group-hover/gen:text-indigo-500 transition-colors" />
                        </div>
                        <span className="text-sm font-bold text-stone-400 group-hover/gen:text-indigo-600 transition-colors">
                          Generate Spread
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Page numbers */}
                <div className="absolute bottom-4 left-6 bg-black/40 backdrop-blur px-3 py-1 rounded-full text-[10px] font-bold text-white pointer-events-none">
                  Page {spread.left.pageNumber}
                </div>

                {spread.right && (
                  <div className="absolute bottom-4 right-6 bg-black/40 backdrop-blur px-3 py-1 rounded-full text-[10px] font-bold text-white pointer-events-none">
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