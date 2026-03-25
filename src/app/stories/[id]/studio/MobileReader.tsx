"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Loader2,
  ImagePlus,
  Sparkles,
  Wand2,
  X,
  ChevronLeft,
  ChevronRight,
  Check,
} from "lucide-react";
import { motion, useMotionValue, animate, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import OrderBookButton from "@/components/OrderBookButton";
import Link from "next/link";
import Image from "next/image";
import StudioPaywall from "@/components/StudioPaywall";
import UnifiedStoryHeader from "@/app/stories/components/StoryHeader";
import RedrawModal from "@/app/stories/[id]/studio/components/redrawModal";

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
  spreadId: string | null;
  left: Page;
  right: Page | null;
};

/* -------------------------------------------------------------------------- */
/*                                   Helpers                                  */
/* -------------------------------------------------------------------------- */

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
/*                              Spread Card (clean, no overlays)              */
/* -------------------------------------------------------------------------- */

function SpreadCard({
  spread,
  isGenerating,
}: {
  spread: Spread;
  isGenerating: boolean;
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
          <img
            src={spread.left.imageUrl!}
            alt={`Pages ${spread.left.pageNumber}–${spread.right?.pageNumber ?? ""}`}
            className="w-full h-full object-cover"
            draggable={false}
          />
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
/*                    Spread Info Bar (below image, not overlaid)              */
/* -------------------------------------------------------------------------- */

function SpreadInfoBar({
  spread,
  onRedraw,
}: {
  spread: Spread;
  onRedraw: () => void;
}) {
  const hasImage = !!spread.left.imageUrl;
  const pageLabel = spread.right
    ? `Pages ${spread.left.pageNumber}–${spread.right.pageNumber}`
    : `Page ${spread.left.pageNumber}`;

  return (
    <div className="flex items-center justify-between px-5 pt-3 pb-1">
      <span
        className="text-xs font-bold"
        style={{ color: "#9B59D0" }}
      >
        {pageLabel}
      </span>

      {hasImage && (
        <button
          onClick={onRedraw}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold transition-transform active:scale-95"
          style={{
            background: "rgba(176,92,230,0.1)",
            color: "#9B59D0",
            border: "none",
          }}
        >
          <Wand2 className="w-3.5 h-3.5" />
          Redraw
        </button>
      )}
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
  dbSpreads,
}: {
  story: any;
  pages: Page[];
  mode: "live" | "edit";
  dbSpreads?: { id: string; leftPageId: string | null; rightPageId: string | null }[];
}) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);

  const [pages, setPages] = useState<Page[]>(initialPages);
  const [isPolling, setIsPolling] = useState(
    mode === "live" || story.status === "generating"
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  /* ── Redraw state (full modal) ── */
  const [redrawTarget, setRedrawTarget] = useState<Spread | null>(null);
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
  const [regeneratingSpreads, setRegeneratingSpreads] = useState<Set<string>>(new Set());

  const [index, setIndex] = useState(0);
  const [viewportWidth, setViewportWidth] = useState<number | null>(null);
  const x = useMotionValue(0);

  const interiorSpreads = useMemo(() => groupIntoSpreads(pages, dbSpreads), [pages, dbSpreads]);
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

  const redrawLabel = redrawTarget
    ? redrawTarget.right
      ? `Pages ${redrawTarget.left.pageNumber}–${redrawTarget.right.pageNumber}`
      : `Page ${redrawTarget.left.pageNumber}`
    : "";

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

      // Check if regenerating spreads are done
      if (regeneratingSpreads.size > 0) {
        const updatedSpreads = groupIntoSpreads(updated, dbSpreads);
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

      if (updated.every((p) => p.imageUrl) && regeneratingSpreads.size === 0) {
        setIsPolling(false);
        setIsGenerating(false);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [isPolling, story.id, regeneratingSpreads, dbSpreads]);

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
    if (story.paymentStatus !== "paid") return;
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

  async function handleRedrawSpread(payload: {
    feedback: string;
    includedCharacterIds: string[];
    outfitOverrides: Record<string, string>;
    primaryLocationId: string | null;
    includedLocationIds: string[];
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
            primaryLocationId: payload.primaryLocationId,
            includedLocationIds: payload.includedLocationIds,
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

  const isPaid = story.paymentStatus === "paid";

  if (!isPaid) {
    const previewSpread = pages.find((p) => p.imageUrl);

    return (
      <div
        className="w-full min-h-screen"
        style={{
          background: "#FDFBFF",
          fontFamily: "'Bricolage Grotesque', system-ui, sans-serif",
        }}
      >
        <div
          className="sticky top-0 z-50 px-4 py-3 flex items-center gap-3"
          style={{
            background: "rgba(253,251,255,0.85)",
            backdropFilter: "blur(12px)",
            borderBottom: "1px solid rgba(180,150,210,0.1)",
          }}
        >
          <Link href="/" className="flex items-center gap-2">
            <Image src="/Flipwhizz_logo.png" alt="" width={36} height={36} priority />
            <span className="text-base font-extrabold tracking-tight bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 bg-clip-text text-transparent">
              FlipWhizz
            </span>
          </Link>
        </div>

        <StudioPaywall
          storyId={story.id}
          storyTitle={story.title}
          previewSpreadUrl={previewSpread?.imageUrl}
        />
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
      {/* ── Redraw Modal (full, with characters/locations/outfits) ── */}
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

      {/* ── Story Header with step navigation ── */}
      <UnifiedStoryHeader
        storyId={story.id}
        title={story.title}
        currentStep="studio"
        completedSteps={story.completedSteps ?? []}
        paymentStatus={story.paymentStatus}
        hasPages={pages.length > 0}
        coverSpreadUrl={story.coverSpreadUrl}
        storyConfirmed={true}
      />

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
                    </div>
                  </div>
                ) : (
                  <SpreadCard
                    spread={s as Spread}
                    isGenerating={isGenerating || regeneratingSpreads.has((s as Spread).id)}
                  />
                )}
              </div>
            );
          })}
        </motion.div>
      </div>

      {/* ── Info bar below the spread (page label + redraw) ── */}
      {isCover ? (
        <div className="flex items-center justify-center px-5 pt-3 pb-1">
          <span className="text-xs font-bold" style={{ color: "#9B59D0" }}>
            Cover
          </span>
        </div>
      ) : currentSpread ? (
        <SpreadInfoBar
          spread={currentSpread}
          onRedraw={() => setRedrawTarget(currentSpread)}
        />
      ) : null}

      {/* ── Navigation row: prev · dots · next ── */}
      <div className="flex items-center justify-between px-6 py-3">
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

        <DotProgress
          total={slides.length}
          current={index}
          onDotClick={snapTo}
        />

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

        {allGenerated && story.coverSpreadUrl && (
          <OrderBookButton storyId={story.id} />
        )}
      </div>
    </div>
  );
}