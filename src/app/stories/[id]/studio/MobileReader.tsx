"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  LayoutGrid,
  X,
  Loader2,
} from "lucide-react";
import { motion, useMotionValue, animate } from "framer-motion";
import { useRouter } from "next/navigation";

/* -------------------------------------------------------------------------- */
/*                                    Types                                   */
/* -------------------------------------------------------------------------- */

type Page = {
  id: string;
  pageNumber: number;
  imageUrl: string | null;
};

type Spread = {
  id: string;
  imageUrl: string | null;
  leftPage: Page;
  rightPage: Page | null;
};

/* -------------------------------------------------------------------------- */
/*                                   Helpers                                  */
/* -------------------------------------------------------------------------- */

function buildSpreads(pages: Page[]): Spread[] {
  const spreads: Spread[] = [];

  for (let i = 0; i < pages.length; i += 2) {
    const left = pages[i];
    const right = pages[i + 1] ?? null;

    spreads.push({
      id: `spread-${left.id}`,
      imageUrl: left.imageUrl || right?.imageUrl || null,
      leftPage: left,
      rightPage: right,
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
/*                                Mobile Reader                               */
/* -------------------------------------------------------------------------- */

export default function MobileReader({
  story,
  pages,
}: {
  story: any;
  pages: Page[];
}) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);

  const spreads = useMemo(() => buildSpreads(pages), [pages]);

  const [index, setIndex] = useState(0);
  const [showUI, setShowUI] = useState(true);
  const [showOverview, setShowOverview] = useState(false);
  const [viewportWidth, setViewportWidth] = useState<number | null>(null);

  const x = useMotionValue(0);

  /* ------------------------------ Measure width ---------------------------- */

  useEffect(() => {
    function measure() {
      const w = containerRef.current?.offsetWidth || window.innerWidth;
      setViewportWidth(w);
      animate(x, -index * w, { duration: 0 });
    }

    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
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
    prefetchImage(spreads[index - 1]?.imageUrl);
    prefetchImage(spreads[index + 1]?.imageUrl);
  }, [index, spreads]);

  if (viewportWidth == null) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-white/60" />
      </div>
    );
  }

  const spread = spreads[index];

  /* -------------------------------------------------------------------------- */
  /*                                   Render                                   */
  /* -------------------------------------------------------------------------- */

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 bg-black text-white overflow-hidden"
    >
      {/* ============================ SWIPE TRACK ============================ */}
      <motion.div
        className="flex h-full"
        style={{ x }}
        drag="x"
        dragConstraints={{
          left: -((spreads.length - 1) * viewportWidth),
          right: 0,
        }}
        dragElastic={0.08}
        onDragEnd={onDragEnd}
        onTap={() => setShowUI(v => !v)}
      >
        {spreads.map((s) => (
          <div
            key={s.id}
            className="w-screen h-full flex items-center justify-center px-4 landscape:px-16"
          >
            <div className="bg-black rounded-xl shadow-2xl overflow-hidden max-w-[1100px] w-full h-full landscape:h-[90%] flex items-center justify-center">
              {s.imageUrl ? (
                <img
                  src={s.imageUrl}
                  alt={`Pages ${s.leftPage.pageNumber}${
                    s.rightPage ? `–${s.rightPage.pageNumber}` : ""
                  }`}
                  className="max-w-full max-h-full object-contain"
                />
              ) : (
                <Loader2 className="w-10 h-10 animate-spin text-white/60" />
              )}
            </div>
          </div>
        ))}
      </motion.div>

      {/* ============================== TOP UI =============================== */}
      {showUI && !showOverview && (
        <div className="absolute top-0 inset-x-0 h-16 px-4 flex items-center justify-between bg-gradient-to-b from-black/70 to-transparent">
          <button
            onClick={() => router.push("/dashboard")}
            className="p-2 rounded-full hover:bg-white/10"
          >
            <ChevronLeft />
          </button>

          <div className="text-xs font-medium text-white/70">
            Pages {spread.leftPage.pageNumber}
            {spread.rightPage && `–${spread.rightPage.pageNumber}`} /{" "}
            {pages.length}
          </div>

          <button
            onClick={() => setShowOverview(true)}
            className="p-2 rounded-full hover:bg-white/10"
          >
            <LayoutGrid />
          </button>
        </div>
      )}

      {/* ============================== OVERVIEW ============================== */}
      {showOverview && (
        <div className="absolute inset-0 z-50 bg-black">
          <header className="h-16 px-4 flex items-center justify-between border-b border-white/10">
            <h2 className="text-sm font-bold">All Spreads</h2>
            <button
              onClick={() => setShowOverview(false)}
              className="p-2 rounded-full hover:bg-white/10"
            >
              <X />
            </button>
          </header>

          <div className="p-4 grid grid-cols-2 gap-4 overflow-y-auto pb-24">
            {spreads.map((s, i) => (
              <button
                key={s.id}
                onClick={() => {
                  snapTo(i);
                  setShowOverview(false);
                  setShowUI(false);
                }}
                className={`relative rounded-lg overflow-hidden border ${
                  i === index
                    ? "border-white ring-2 ring-white"
                    : "border-white/10 hover:border-white/30"
                }`}
              >
                {s.imageUrl ? (
                  <img
                    src={s.imageUrl}
                    className="w-full aspect-[3/4] object-contain bg-black"
                  />
                ) : (
                  <div className="w-full aspect-[3/4] flex items-center justify-center text-xs text-white/40 bg-black">
                    Pending
                  </div>
                )}

                <span className="absolute bottom-2 right-2 text-[10px] bg-black/70 px-2 py-1 rounded-full font-bold">
                  {s.leftPage.pageNumber}
                  {s.rightPage && `–${s.rightPage.pageNumber}`}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
