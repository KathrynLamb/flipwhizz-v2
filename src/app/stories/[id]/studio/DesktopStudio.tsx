"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Loader2,
  ChevronLeft,
  Download,
  ImagePlus,
  X,
  Sparkles,
  Wand2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";

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
/*                               Cover Preview                                */
/* -------------------------------------------------------------------------- */

function CoverSpreadPreview({ url }: { url: string }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative bg-white rounded-2xl shadow-sm border border-gray-200/50 overflow-hidden"
    >
      <div className="relative w-full aspect-[2/1] bg-gradient-to-br from-gray-100 via-white to-gray-100">
        <img
          src={url}
          alt="Book cover spread"
          className="w-full h-full object-contain"
        />
        <div className="absolute top-4 left-4 bg-black/70 backdrop-blur-md px-4 py-1.5 rounded-full text-xs font-bold text-white">
          Cover (Back · Spine · Front)
        </div>
      </div>
    </motion.div>
  );
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
        <div className="p-5 border-b border-gray-100 flex justify-between items-center">
          <div>
            <h3 className="font-bold text-lg flex items-center gap-2">
              <Wand2 className="w-5 h-5 text-purple-600" />
              Redraw Spread
            </h3>
            <p className="text-xs text-gray-500">
              Tell the AI what to change
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-200 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          <textarea
            autoFocus
            className="w-full border rounded-xl p-4 h-36"
            placeholder="e.g. Make the bear friendlier, sunset sky…"
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            disabled={isSubmitting}
          />
        </div>

        <div className="px-6 pb-6 flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2 rounded-xl">
            Cancel
          </button>
          <button
            onClick={() => onSubmit(feedback)}
            disabled={isSubmitting || !feedback.trim()}
            className="flex-1 bg-purple-600 text-white px-4 py-2 rounded-xl font-bold flex items-center justify-center gap-2"
          >
            {isSubmitting ? <Loader2 className="animate-spin" /> : <Sparkles />}
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

// Update the DesktopStudio component to add the generation buttons

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

  const [pages, setPages] = useState<Page[]>(initialPages);
  const [isPolling, setIsPolling] = useState(
    mode === "live" || story.status === "generating"
  );
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false); // ✅ Add this

  const [isOrdering, setIsOrdering] = useState(false);

  const spreads = useMemo(() => groupIntoSpreads(pages), [pages]);

  /* ------------------------------ Polling ---------------------------------- */

  useEffect(() => {
    if (!isPolling) return;

    const interval = setInterval(async () => {
      const res = await fetch(`/api/stories/${story.id}/pages`, {
        cache: "no-store",
      });
      if (!res.ok) return;

      const updatedPages: Page[] = await res.json();
      setPages(updatedPages);

      if (updatedPages.every((p) => p.imageUrl)) {
        setIsPolling(false);
        setIsGenerating(false); // ✅ Add this
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [isPolling, story.id]);

  /* ------------------------------- Actions -------------------------------- */

  // ✅ Add this function
  async function handleGenerateAll() {
    if (isGenerating) return;
    setIsGenerating(true);
    setIsPolling(true);

    try {
      const res = await fetch(`/api/stories/${story.id}/generate-all`, {
        method: "POST",
      });
      
      if (!res.ok) {
        throw new Error("Failed to start generation");
      }
    } catch (err) {
      alert("Failed to start generation");
      setIsGenerating(false);
      setIsPolling(false);
    }
  }

  async function handleExportPDF() {
    if (isExporting) return;
    setIsExporting(true);

    try {
      const res = await fetch(`/api/stories/${story.id}/export-complete`, {
        method: "POST",
      });
      const data = await res.json();
      console.log("DATA", data)
      if (!res.ok) throw new Error();
      window.open(data.url, "_blank");
    } catch {
      alert("Failed to export PDF");
    } finally {
      setIsExporting(false);
    }
  }

  async function handleOrderBook() {
    if (isOrdering) return;
    setIsOrdering(true);
  
    try {
      const res = await fetch(`/api/stories/${story.id}/order-test`, {
        method: "POST",
      });
      const data = await res.json();
      console.log("ORDER RESULT", data);
      if (!res.ok) throw new Error(data.error || "Failed to place order");
      alert(`Order placed! Gelato order ID: ${data.gelatoOrderId}`);
    } catch (err: any) {
      alert(err.message || "Failed to place order");
    } finally {
      setIsOrdering(false);
    }
  }

  /* -------------------------------- Render -------------------------------- */

  const completedCount = pages.filter((p) => p.imageUrl).length;
  const totalCount = pages.length;
  const allGenerated = completedCount === totalCount;

  return (
    <div className="min-h-screen bg-gray-50 pb-40">
      <AnimatePresence>
        {feedbackModalOpen && (
          <FeedbackModal
            isOpen
            onClose={() => setFeedbackModalOpen(false)}
            onSubmit={() => {}}
            isSubmitting={isSubmittingFeedback}
          />
        )}
      </AnimatePresence>

      {/* ✅ HEADER WITH GENERATION CONTROLS */}
      <div className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-200">
        <div className="max-w-[1400px] mx-auto px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">

            {/* Brand */}
            <Link
              href="/"
              className="flex items-center gap-0.5 md:gap-2 group"
              aria-label="FlipWhizz home"
            >
              <Image
                src="/Flipwhizz_logo.png"
                alt=""
                width={48}
                height={48}
                priority
                className="transition-transform group-hover:scale-105"
              />

              <span className="text-lg font-extrabold tracking-tight bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 bg-clip-text text-transparent">
                FlipWhizz
              </span>
            </Link>
              <Link
                href={`/stories/${story.id}/design`}
                className="flex items-center gap-2 text-gray-700 hover:text-purple-600 transition-colors font-medium"
              >
                <ChevronLeft className="w-5 h-5" />
                <span>Back to Design</span>
              </Link>
              
              <div className="h-6 w-px bg-gray-300" />
              
              <div className="text-sm">
                <span className="font-bold text-gray-900">{story.title}</span>
                <span className="text-gray-500 ml-2">
                  {completedCount} / {totalCount} illustrations
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Generation Status/Button */}
              {!allGenerated && (
                <button
                  onClick={handleGenerateAll}
                  disabled={isGenerating}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-bold hover:shadow-lg transition-all disabled:opacity-50"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Generating {completedCount}/{totalCount}...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Generate All Illustrations
                    </>
                  )}
                </button>
              )}

    {story.coverSpreadUrl ? (
      <button
        onClick={handleExportPDF}
        disabled={isExporting || !allGenerated}
        className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-xl font-bold hover:shadow-lg transition-all disabled:opacity-50"
      >
        {isExporting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Exporting...
          </>
        ) : (
          <>
            <Download className="w-4 h-4" />
            Export PDF
          </>
        )}
      </button>
    ) : (
      <button
        onClick={() => router.push(`/stories/${story.id}/cover`)}
        disabled={!allGenerated}
        className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-xl font-bold hover:shadow-lg transition-all disabled:opacity-50"
      >
        <Wand2 className="w-4 h-4" />
        Design Cover
      </button>
    )}

{story.pdfUrl && (
  <button
    onClick={handleOrderBook}
    disabled={isOrdering}
    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl font-bold hover:shadow-lg transition-all disabled:opacity-50"
  >
    {isOrdering ? (
      <>
        <Loader2 className="w-4 h-4 animate-spin" />
        Ordering...
      </>
    ) : (
      <>
        <Sparkles className="w-4 h-4" />
        Order Book
      </>
    )}
  </button>
)}
            </div>
          </div>

          {/* Progress Bar */}
          {isGenerating && (
            <div className="mt-3">
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-purple-600 to-pink-600"
                  initial={{ width: 0 }}
                  animate={{ width: `${(completedCount / totalCount) * 100}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* CONTENT */}
      <div className="max-w-[1400px] mx-auto p-8 space-y-8">
        {story.coverSpreadUrl && (
          <CoverSpreadPreview url={story.coverSpreadUrl} />
        )}

        {spreads.map((spread) => (
          <div
            key={spread.id}
            className="bg-white rounded-2xl border overflow-hidden"
          >
            <div className="aspect-[2/1] bg-gray-100 relative">
              {spread.left.imageUrl ? (
                <img
                  src={spread.left.imageUrl}
                  className="w-full h-full object-contain"
                  alt={`Pages ${spread.left.pageNumber}${spread.right ? `-${spread.right.pageNumber}` : ''}`}
                />
              ) : (
                <div className="flex h-full items-center justify-center text-gray-400">
                  {isGenerating ? (
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="w-8 h-8 animate-spin" />
                      <p className="text-sm">Generating...</p>
                    </div>
                  ) : (
                    <ImagePlus className="w-12 h-12" />
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
