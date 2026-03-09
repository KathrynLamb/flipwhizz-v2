"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Loader2,
  Download,
  ImagePlus,
  Sparkles,
  Wand2,
  RotateCcw,
  Check,
  BookImage,
  ChevronRight,
  PartyPopper,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import RedrawModal from "@/app/stories/[id]/studio/components/redrawModal";
import StudioPaywall from "@/components/StudioPaywall";
import UnifiedStoryHeader from "@/app/stories/components/StoryHeader";


/* ---------------------------------- Types --------------------------------- */

type Page = {
  id: string;
  pageNumber: number;
  text: string;
  imageUrl: string | null;
};

type Spread = {
  id: string;
  spreadId: string | null;
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

function CoverSpreadPreview({
  url,
  onRedraw,
}: {
  url: string;
  onRedraw: () => void;
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="group relative bg-white rounded-2xl shadow-sm border border-gray-200/50 overflow-hidden"
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

        {/* Redraw button — hover reveal, same pattern as interior spreads */}
        <div className="absolute top-4 right-4 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onRedraw}
            className="flex items-center gap-1.5 bg-white/90 backdrop-blur-md text-gray-700 hover:text-purple-600 hover:bg-white px-3 py-1.5 rounded-full text-xs font-bold shadow-md border border-gray-200/50 transition-all"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Redraw Cover
          </button>
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

      {/* Text preview (only when no image) */}
      {!hasImage && (
        <div className="px-5 py-3 border-t border-gray-100">
          <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">
            {spread.left.text}
            {spread.right?.text ? ` ${spread.right.text}` : ""}
          </p>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                           Studio Action Card                               */
/* -------------------------------------------------------------------------- */

function StudioActionCard({
  storyId,
  coverSpreadUrl,
  pdfUrl,
  isExporting,
  isOrdering,
  onDesignCover,
  onExportPDF,
  onOrderBook,
}: {
  storyId: string;
  coverSpreadUrl: string | null;
  pdfUrl: string | null;
  isExporting: boolean;
  isOrdering: boolean;
  onDesignCover: () => void;
  onExportPDF: () => void;
  onOrderBook: () => void;
}) {
  const hasCover = !!coverSpreadUrl;
  const hasPdf = !!pdfUrl;

  // ── State 1: No cover yet — celebrate + prompt cover design ──
  if (!hasCover) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 200, damping: 24 }}
        className="rounded-2xl overflow-hidden"
        style={{
          background: "white",
          border: "1px solid rgba(180,150,210,0.12)",
          boxShadow: "0 2px 12px rgba(100,60,140,0.06), 0 8px 32px rgba(100,60,140,0.04)",
          fontFamily: "'Bricolage Grotesque', system-ui, sans-serif",
        }}
      >
        <div className="flex flex-col sm:flex-row items-center gap-6 p-6 sm:p-8">
          {/* Left: celebration icon */}
          <div className="flex-shrink-0">
            <motion.div
              initial={{ scale: 0, rotate: -20 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 300, delay: 0.15 }}
              className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{
                background: "linear-gradient(135deg, #43B89C, #2FA482)",
                boxShadow: "0 4px 16px rgba(67,184,156,0.25)",
              }}
            >
              <PartyPopper className="w-6 h-6 text-white" />
            </motion.div>
          </div>

          {/* Middle: copy */}
          <div className="flex-1 text-center sm:text-left">
            <h3
              className="text-lg font-extrabold mb-1"
              style={{ color: "#2D2235", letterSpacing: "-0.02em" }}
            >
              All illustrations complete!
            </h3>
            <p
              className="text-sm leading-relaxed max-w-md"
              style={{ color: "#7B6E90" }}
            >
              Your pages are looking great. Next up: design a cover to bring
              it all together — you'll chat through your vision and we'll
              generate it for you.
            </p>
          </div>

          {/* Right: CTA */}
          <div className="flex-shrink-0">
            <button
              onClick={onDesignCover}
              className="flex items-center gap-2.5 px-6 py-3.5 rounded-xl text-sm font-bold text-white transition-all hover:shadow-lg active:scale-[0.97]"
              style={{
                background: "linear-gradient(135deg, #B05CE6, #D45DA0)",
                boxShadow: "0 4px 16px rgba(176,92,230,0.25)",
                border: "none",
                fontFamily: "inherit",
                cursor: "pointer",
              }}
            >
              <BookImage className="w-4 h-4" />
              Design Your Cover
              <ChevronRight className="w-4 h-4 opacity-60" />
            </button>
          </div>
        </div>
      </motion.div>
    );
  }

  // ── State 2: Cover exists — show export/order options ──
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 200, damping: 24 }}
      className="rounded-2xl overflow-hidden"
      style={{
        background: "white",
        border: "1px solid rgba(180,150,210,0.12)",
        boxShadow: "0 2px 12px rgba(100,60,140,0.06), 0 8px 32px rgba(100,60,140,0.04)",
        fontFamily: "'Bricolage Grotesque', system-ui, sans-serif",
      }}
    >
      <div className="flex flex-col sm:flex-row items-center gap-6 p-6 sm:p-8">
        {/* Left: check icon */}
        <div className="flex-shrink-0">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center"
            style={{
              background: "linear-gradient(135deg, #43B89C, #2FA482)",
              boxShadow: "0 4px 16px rgba(67,184,156,0.25)",
            }}
          >
            <Check className="w-6 h-6 text-white" />
          </div>
        </div>

        {/* Middle: copy */}
        <div className="flex-1 text-center sm:text-left">
          <h3
            className="text-lg font-extrabold mb-1"
            style={{ color: "#2D2235", letterSpacing: "-0.02em" }}
          >
            Your book is ready!
          </h3>
          <p
            className="text-sm leading-relaxed max-w-md"
            style={{ color: "#7B6E90" }}
          >
            Illustrations and cover are complete. Export a print-ready PDF or
            tweak the cover if you'd like changes.
          </p>
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-3 flex-shrink-0">
          {/* Redesign cover — secondary */}
          <button
            onClick={onDesignCover}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all hover:shadow-md active:scale-[0.97]"
            style={{
              background: "rgba(180,150,210,0.08)",
              color: "#6B5C80",
              border: "1px solid rgba(180,150,210,0.15)",
              fontFamily: "inherit",
              cursor: "pointer",
            }}
          >
            <BookImage className="w-3.5 h-3.5" />
            Tweak Cover
          </button>

          {/* Export PDF — primary */}
          <button
            onClick={onExportPDF}
            disabled={isExporting}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white transition-all hover:shadow-lg active:scale-[0.97] disabled:opacity-50"
            style={{
              background: "linear-gradient(135deg, #B05CE6, #D45DA0)",
              boxShadow: "0 3px 12px rgba(176,92,230,0.2)",
              border: "none",
              fontFamily: "inherit",
              cursor: "pointer",
            }}
          >
            {isExporting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Exporting…
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5" />
                Export PDF
              </>
            )}
          </button>

          {/* Order — only when PDF exists */}
          {hasPdf && (
            <button
              onClick={onOrderBook}
              disabled={isOrdering}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white transition-all hover:shadow-lg active:scale-[0.97] disabled:opacity-50"
              style={{
                background: "linear-gradient(135deg, #43B89C, #2FA482)",
                boxShadow: "0 3px 12px rgba(67,184,156,0.2)",
                border: "none",
                fontFamily: "inherit",
                cursor: "pointer",
              }}
            >
              {isOrdering ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Ordering…
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  Order Print
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </motion.div>
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

  const completedCount = pages.filter((p) => p.imageUrl).length;
  const totalCount = pages.length;
  const allGenerated = completedCount === totalCount;
  const isPaid = story.paymentStatus === "paid";

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

  const redrawLabel = redrawTarget
    ? redrawTarget.right
      ? `Pages ${redrawTarget.left.pageNumber}–${redrawTarget.right.pageNumber}`
      : `Page ${redrawTarget.left.pageNumber}`
    : "";

  // ── Unpaid: show header + paywall ──
  if (!isPaid) {
    const previewSpread = pages.find((p) => p.imageUrl);

    return (
      <div className="min-h-screen bg-gray-50">
        <UnifiedStoryHeader
          storyId={story.id}
          title={story.title}
          currentStep="studio"
          completedSteps={story.completedSteps ?? []}
          paymentStatus={story.paymentStatus}
          hasPages={pages.length > 0}
          coverSpreadUrl={story.coverSpreadUrl}
        />

        <StudioPaywall
          storyId={story.id}
          storyTitle={story.title}
          previewSpreadUrl={previewSpread?.imageUrl}
        />
      </div>
    );
  }

  // ── Paid: full studio ──
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

      {/* UNIFIED HEADER */}
      <UnifiedStoryHeader
        storyId={story.id}
        title={story.title}
        currentStep="studio"
        completedSteps={story.completedSteps ?? []}
        paymentStatus={story.paymentStatus}
        hasPages={pages.length > 0}
        coverSpreadUrl={story.coverSpreadUrl}
        showProgress={isGenerating && totalCount > 0}
        progressCurrent={completedCount}
        progressTotal={totalCount}
        showGenerateAll={!allGenerated}
        onGenerateAll={handleGenerateAll}
        isGenerating={isGenerating}
      />

      {/* STUDIO ACTION CARD — contextual next step */}
      {allGenerated && (
        <div className="max-w-[1400px] mx-auto px-8 pt-6">
          <StudioActionCard
            storyId={story.id}
            coverSpreadUrl={story.coverSpreadUrl}
            pdfUrl={story.pdfUrl}
            isExporting={isExporting}
            isOrdering={isOrdering}
            onDesignCover={async () => {
              // Mark studio as complete, then navigate
              await fetch(`/api/stories/${story.id}/complete-step`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ step: "studio" }),
              }).catch(() => {});
              router.push(`/stories/${story.id}/cover`);
            }}
            onExportPDF={handleExportPDF}
            onOrderBook={handleOrderBook}
          />
        </div>
      )}

      {/* CONTENT */}
      <div className="max-w-[1400px] mx-auto p-8 space-y-8">
        {story.coverSpreadUrl && (
          <CoverSpreadPreview
            url={story.coverSpreadUrl}
            onRedraw={() => router.push(`/stories/${story.id}/cover`)}
          />
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