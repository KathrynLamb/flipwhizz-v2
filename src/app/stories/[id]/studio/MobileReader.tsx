"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  LayoutGrid,
  X,
  Loader2,
  RefreshCw,
  ImagePlus,
  Download,
  Sparkles,
  Wand2,
  Zap,
  Check,
} from "lucide-react";
import {
  motion,
  useMotionValue,
  animate,
  AnimatePresence,
} from "framer-motion";
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

/* -------------------------------------------------------------------------- */
/*                               Cover Slide                                  */
/* -------------------------------------------------------------------------- */

function CoverSlide({ url }: { url: string }) {
  return (
    <div className="flex-none shrink-0 h-full flex items-center justify-center px-4 landscape:px-16">
      <div className="bg-black rounded-2xl shadow-2xl overflow-hidden max-w-[1100px] w-full h-full landscape:h-[90%] flex items-center justify-center relative border border-white/10">
        <img
          src={url}
          alt="Book cover spread"
          className="max-w-full max-h-full object-contain"
          draggable={false}
        />

        <div className="absolute bottom-4 left-4 bg-white/10 backdrop-blur-xl px-3 py-1.5 rounded-full text-xs font-bold text-white border border-white/10">
          Cover · Back · Spine · Front
        </div>
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

  /* --------------------------------- State -------------------------------- */

  const [pages, setPages] = useState<Page[]>(initialPages);
  const [isPolling, setIsPolling] = useState(
    mode === "live" || story.status === "generating"
  );
  const [isExporting, setIsExporting] = useState(false);

  const [index, setIndex] = useState(0);
  const [viewportWidth, setViewportWidth] = useState<number | null>(null);

  const x = useMotionValue(0);

  const interiorSpreads = useMemo(
    () => groupIntoSpreads(pages),
    [pages]
  );

  /**
   * FINAL SLIDES MODEL
   * index 0 = cover (if exists)
   * index 1+ = interior spreads
   */
  const slides = useMemo(() => {
    if (!story.coverSpreadUrl) return interiorSpreads;
    return ["__COVER__", ...interiorSpreads];
  }, [interiorSpreads, story.coverSpreadUrl]);

  const isCoverIndex = story.coverSpreadUrl && index === 0;
  const spread =
    !isCoverIndex && typeof slides[index] !== "string"
      ? (slides[index] as Spread)
      : null;

  /* ------------------------------ Measure width ---------------------------- */

  useEffect(() => {
    const measure = () => {
      const w =
        containerRef.current?.getBoundingClientRect().width ??
        window.innerWidth;
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

  /* ------------------------------ Navigation -------------------------------- */

  function clamp(i: number) {
    return Math.max(0, Math.min(i, slides.length - 1));
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

  /* ------------------------------- Export ---------------------------------- */

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

  /* --------------------------------- Render -------------------------------- */

  if (viewportWidth == null) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-white/60" />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 bg-black text-white overflow-hidden"
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      {/* ============================ SWIPE TRACK ============================ */}
      <motion.div
        className="flex h-full"
        style={{ x }}
        drag="x"
        dragConstraints={{
          left: -((slides.length - 1) * viewportWidth),
          right: 0,
        }}
        dragElastic={0.08}
        onDragEnd={onDragEnd}
      >
        {slides.map((s, i) => {
          if (s === "__COVER__") {
            return (
              <div key="cover" style={{ width: viewportWidth }}>
                <CoverSlide url={story.coverSpreadUrl} />
              </div>
            );
          }

          const spread = s as Spread;

          return (
            <div
              key={spread.id}
              className="flex-none shrink-0 h-full flex items-center justify-center px-4 landscape:px-16"
              style={{ width: viewportWidth }}
            >
              <div className="bg-black rounded-2xl shadow-2xl overflow-hidden max-w-[1100px] w-full h-full landscape:h-[90%] flex items-center justify-center relative border border-white/10">
                {spread.left.imageUrl ? (
                  <>
                    <img
                      src={spread.left.imageUrl}
                      className="max-w-full max-h-full object-contain"
                      draggable={false}
                    />

                    <div className="absolute bottom-4 left-4 bg-white/10 backdrop-blur-xl px-3 py-1.5 rounded-full text-xs font-bold text-white border border-white/10">
                      Page {spread.left.pageNumber}
                      {spread.right &&
                        `–${spread.right.pageNumber}`}
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center text-white/40">
                    <ImagePlus className="w-8 h-8 mb-2" />
                    <span className="text-xs">Not generated</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </motion.div>

      {/* ============================== TOP BAR ============================== */}
      <div className="absolute top-0 inset-x-0 px-4 pt-2 pb-6 flex items-center justify-between bg-gradient-to-b from-black/90 via-black/60 to-transparent">
        <button
          onClick={() => router.push("/dashboard")}
          className="p-2.5 rounded-xl hover:bg-white/10"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <div className="text-xs font-semibold text-white/80">
          {isCoverIndex
            ? "Cover"
            : `Pages ${spread?.left.pageNumber}${
                spread?.right
                  ? `–${spread.right.pageNumber}`
                  : ""
              }`}
        </div>

        <button
          onClick={() => router.push(`/stories/${story.id}/cover`)}
          className="p-2.5 rounded-xl hover:bg-white/10"
        >
          <Wand2 className="w-5 h-5" />
        </button>
      </div>

      {/* ============================ BOTTOM BAR ============================== */}
      <div className="absolute bottom-0 inset-x-0 px-4 pb-3 pt-6 flex justify-center bg-gradient-to-t from-black/90 via-black/60 to-transparent">
        <button
          onClick={handleExportPDF}
          disabled={isExporting}
          className="bg-white/10 text-white px-5 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 border border-white/10 disabled:opacity-50"
        >
          {isExporting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Download className="w-4 h-4" />
          )}
          Export PDF
        </button>
      </div>
    </div>
  );
}
