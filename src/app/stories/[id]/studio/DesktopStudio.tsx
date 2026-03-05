"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Loader2,
  ChevronLeft,
  Download,
  ImagePlus,
  Sparkles,
  Wand2,
  RotateCcw,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import RedrawModal from "@/app/stories/[id]/studio/components/redrawModal";


/* ---------------------------------- Types --------------------------------- */

type Page = {
  id: string;
  pageNumber: number;
  text: string;
  imageUrl: string | null;
};

type Spread = {
  id: string;
  spreadId: string | null; // DB spread ID for reference lookup
  left: Page;
  right: Page | null;
};

/* -------------------------- Helper: build spreads -------------------------- */

function groupIntoSpreads(
  pages: Page[],
  dbSpreads?: { id: string; leftPageId: string | null; rightPageId: string | null }[]
): Spread[] {
  const spreads: Spread[] = [];
  const sorted = [...pages].sort((a, b) => a.pageNumber - b.pageNumber);

  for (let i = 0; i < sorted.length; i += 2) {
    // Try to find the DB spread that matches these pages
    const dbSpread = dbSpreads?.find(
      (s) =>
        s.leftPageId === sorted[i].id ||
        (sorted[i + 1] && s.rightPageId === sorted[i + 1]?.id)
    );

    spreads.push({
      id: `spread-${sorted[i].id}`,
      spreadId: dbSpread?.id ?? null,
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
/*                              Spread Card                                   */
/* -------------------------------------------------------------------------- */

function SpreadCard({
  spread,
  isGeneratingAll,
  isRegenerating,
  onRedraw,
}: {
  spread: Spread;
  isGeneratingAll: boolean;
  isRegenerating: boolean;
  onRedraw: () => void;
}) {
  const pageLabel = spread.right
    ? `Pages ${spread.left.pageNumber}–${spread.right.pageNumber}`
    : `Page ${spread.left.pageNumber}`;

  const hasImage = !!spread.left.imageUrl;

  return (
    <div className="group bg-white rounded-2xl border overflow-hidden relative">
      {/* Spread number label */}
      <div className="absolute top-3 left-3 z-10 bg-black/70 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold text-white">
        {pageLabel}
      </div>

      {/* Redraw button */}
      {hasImage && !isRegenerating && (
        <div className="absolute top-3 right-3 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onRedraw}
            className="flex items-center gap-1.5 bg-white/90 backdrop-blur-md text-gray-700 hover:text-purple-600 hover:bg-white px-3 py-1.5 rounded-full text-xs font-bold shadow-md border border-gray-200/50 transition-all"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Redraw
          </button>
        </div>
      )}

      {/* Image area */}
      <div className="aspect-[2/1] bg-gray-100 relative">
        {isRegenerating ? (
          <div className="flex h-full items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="relative">
                <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
                <Sparkles className="w-4 h-4 text-pink-500 absolute -top-1 -right-1 animate-pulse" />
              </div>
              <p className="text-sm text-purple-600 font-medium">
                Redrawing spread…
              </p>
            </div>
          </div>
        ) : hasImage ? (
          <img
            src={spread.left.imageUrl!}
            className="w-full h-full object-contain"
            alt={pageLabel}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-gray-400">
            {isGeneratingAll ? (
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

      {/* Text preview */}
      <div className="px-5 py-3 border-t border-gray-100">
        <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">
          {spread.left.text}
          {spread.right?.text ? ` ${spread.right.text}` : ""}
        </p>
      </div>
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
  dbSpreads,
}: {
  story: any;
  pages: Page[];
  styleGuide: any;
  mode: "live" | "edit";
  dbSpreads?: { id: string; leftPageId: string | null; rightPageId: string | null }[];
}) {
  const router = useRouter();

  const [pages, setPages] = useState<Page[]>(initialPages);
  const [isPolling, setIsPolling] = useState(
    mode === "live" || story.status === "generating"
  );
  const [isExporting, setIsExporting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isOrdering, setIsOrdering] = useState(false);

  // Spread redesign state
  const [redrawTarget, setRedrawTarget] = useState<Spread | null>(null);
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
  const [regeneratingSpreads, setRegeneratingSpreads] = useState<Set<string>>(
    new Set()
  );

  const spreads = useMemo(
    () => groupIntoSpreads(pages, dbSpreads),
    [pages, dbSpreads]
  );

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

      // Check if any regenerating spreads are now done
      if (regeneratingSpreads.size > 0) {
        const updatedSpreads = groupIntoSpreads(updatedPages, dbSpreads);
        const stillRegenerating = new Set<string>();

        regeneratingSpreads.forEach((spreadId) => {
          const spread = updatedSpreads.find((s) => s.id === spreadId);
          if (spread && !spread.left.imageUrl) {
            stillRegenerating.add(spreadId);
          }
        });

        if (stillRegenerating.size !== regeneratingSpreads.size) {
          setRegeneratingSpreads(stillRegenerating);
        }
      }

      if (
        updatedPages.every((p) => p.imageUrl) &&
        regeneratingSpreads.size === 0
      ) {
        setIsPolling(false);
        setIsGenerating(false);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [isPolling, story.id, regeneratingSpreads, dbSpreads]);

  /* ------------------------------- Actions -------------------------------- */

  async function handleGenerateAll() {
    if (isGenerating) return;
    setIsGenerating(true);
    setIsPolling(true);

    try {
      const res = await fetch(`/api/stories/${story.id}/generate-all`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to start generation");
    } catch (err) {
      alert("Failed to start generation");
      setIsGenerating(false);
      setIsPolling(false);
    }
  }

  async function handleRedrawSpread(payload: {
    feedback: string;
    includedCharacterIds: string[];
    outfitOverrides: Record<string, string>;
    locationId: string | null;
    freshStart?: boolean;
  }) {
    if (!redrawTarget || isSubmittingFeedback) return;
    setIsSubmittingFeedback(true);

    const pageIds = [redrawTarget.left.id];
    if (redrawTarget.right) pageIds.push(redrawTarget.right.id);

    try {
      const res = await fetch(
        `/api/stories/${story.id}/spreads/regenerate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pageIds,
            spreadId: redrawTarget.spreadId,
            feedback: payload.freshStart ? "" : payload.feedback,
            includedCharacterIds: payload.includedCharacterIds,
            outfitOverrides: payload.outfitOverrides,
            locationId: payload.locationId,
            freshStart: payload.freshStart ?? false,
          }),
        }
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to start regeneration");
      }

      setRegeneratingSpreads((prev) => new Set(prev).add(redrawTarget.id));

      setPages((prev) =>
        prev.map((p) =>
          pageIds.includes(p.id) ? { ...p, imageUrl: null } : p
        )
      );

      setIsPolling(true);
      setRedrawTarget(null);
    } catch (err: any) {
      alert(err.message || "Failed to redraw spread");
    } finally {
      setIsSubmittingFeedback(false);
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

  const redrawLabel = redrawTarget
    ? redrawTarget.right
      ? `Pages ${redrawTarget.left.pageNumber}–${redrawTarget.right.pageNumber}`
      : `Page ${redrawTarget.left.pageNumber}`
    : "";

  return (
    <div className="min-h-screen bg-gray-50 pb-40">
      {/* Redraw Modal */}
      <AnimatePresence>
        {redrawTarget && (
          <RedrawModal
            isOpen
            onClose={() => setRedrawTarget(null)}
            onSubmit={handleRedrawSpread}
            isSubmitting={isSubmittingFeedback}
            storyId={story.id}
            spreadId={redrawTarget.spreadId ?? ""}
            spreadLabel={redrawLabel}
          />
        )}
      </AnimatePresence>

      {/* HEADER */}
      <div className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-200">
        <div className="max-w-[1400px] mx-auto px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
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

          {isGenerating && (
            <div className="mt-3">
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-purple-600 to-pink-600"
                  initial={{ width: 0 }}
                  animate={{
                    width: `${(completedCount / totalCount) * 100}%`,
                  }}
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
          <SpreadCard
            key={spread.id}
            spread={spread}
            isGeneratingAll={isGenerating}
            isRegenerating={regeneratingSpreads.has(spread.id)}
            onRedraw={() => setRedrawTarget(spread)}
          />
        ))}
      </div>
    </div>
  );
}