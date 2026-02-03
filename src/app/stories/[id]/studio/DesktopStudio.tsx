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
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [isPolling, story.id]);

  /* ------------------------------- Actions -------------------------------- */

  async function handleExportPDF() {
    if (isExporting) return;
    setIsExporting(true);

    try {
      const res = await fetch(`/api/stories/${story.id}/export-complete`, {
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

  /* -------------------------------- Render -------------------------------- */

  const completedCount = pages.filter((p) => p.imageUrl).length;
  const totalCount = pages.length;

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

 {/* FLOATING EXPORT BUTTON */}
 <button
        onClick={handleExportPDF}
        disabled={isExporting}
        className="fixed bottom-8 right-8 z-40 bg-gray-900 text-white px-5 py-3 rounded-2xl flex items-center gap-2 shadow-lg hover:shadow-xl transition-shadow"
      >
        {isExporting ? <Loader2 className="animate-spin w-4 h-4" /> : <Download className="w-4 h-4" />}
        Export PDF
      </button>

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
            <div className="aspect-[2/1] bg-gray-100">
              {spread.left.imageUrl ? (
                <img
                  src={spread.left.imageUrl}
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-gray-400">
                  <ImagePlus />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
