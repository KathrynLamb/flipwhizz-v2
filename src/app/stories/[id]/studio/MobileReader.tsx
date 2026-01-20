"use client";

import { useState, useEffect } from "react";
import {
  ChevronLeft,
  LayoutGrid,
  Download,
  Loader2,
  X,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";

function prefetchImage(src: string) {
    if (!src) return;
    const img = new Image();
    img.src = src;
  }
  

type Page = {
  id: string;
  pageNumber: number;
  imageUrl: string | null;
};

export default function MobileReader({
  story,
  pages,
}: {
  story: any;
  pages: Page[];
}) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [displayIndex, setDisplayIndex] = useState(0);
  const [direction, setDirection] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  
  const [showUI, setShowUI] = useState(true);
  const [showOverview, setShowOverview] = useState(false);




// CARD SWIPPING CONSTANTS
  const swipeConfidenceThreshold = 80;

    const variants = {
    enter: (direction: number) => ({
        x: direction > 0 ? "100%" : "-100%",
        opacity: 0,
        scale: 0.96,
    }),
    center: {
        x: 0,
        opacity: 1,
        scale: 1,
    },
    exit: (direction: number) => ({
        x: direction < 0 ? "100%" : "-100%",
        opacity: 0,
        scale: 0.96,
    }),
    };
    useEffect(() => {
        const prev = pages[index - 1]?.imageUrl;
        const next = pages[index + 1]?.imageUrl;
      
        if (prev) prefetchImage(prev);
        if (next) prefetchImage(next);
      }, [index, pages]);
      

  useEffect(() => {
    if (showOverview) setShowUI(false);
  }, [showOverview]);
  

  useEffect(() => {
    if (!showUI) return;
    const t = setTimeout(() => setShowUI(false), 2000);
    return () => clearTimeout(t);
  }, [showUI]);

  const page = pages[displayIndex];


  function paginate(newDirection: number) {
    const nextIndex = index + newDirection;
    if (nextIndex < 0 || nextIndex >= pages.length) return;

    if (isAnimating) return;
        setIsAnimating(true);       
  
    setDirection(newDirection);
    setDisplayIndex(index);     // freeze outgoing card
    setIndex(nextIndex);        // advance logical index
  }
  
  return (
    <div className="fixed inset-0 bg-black text-white">
      {/* Page */}
      <div className="absolute inset-0 flex items-center justify-center bg-black">
  <AnimatePresence initial={false} custom={direction}>
  <motion.div
  key={displayIndex}
  custom={direction}
  variants={variants}
  initial="enter"
  animate="center"
  exit="exit"
  onAnimationComplete={() => {
    setDisplayIndex(index);
    setIsAnimating(false);
  }}
  transition={{
    x: { type: "spring", stiffness: 320, damping: 32 },
    opacity: { duration: 0.2 },
    scale: { duration: 0.2 },
  }}
  drag="x"
  dragConstraints={{ left: 0, right: 0 }}
  dragElastic={0.15}
  onDragEnd={(_, info) => {
    if (info.offset.x < -80) paginate(1);
    else if (info.offset.x > 80) paginate(-1);
  }}
>

      {/* CARD */}
      <div
        className="
          bg-black
          rounded-xl
          shadow-2xl
          overflow-hidden
          max-w-[1000px]
          w-full
          h-full
          landscape:h-[90%]
          flex
          items-center
          justify-center
        "
      >
        {page.imageUrl ? (
          <img
            src={page.imageUrl}
            alt={`Page ${page.pageNumber}`}
            className="max-w-full max-h-full object-contain"
          />
        ) : (
          <Loader2 className="w-10 h-10 animate-spin text-white/60" />
        )}
      </div>
    </motion.div>
  </AnimatePresence>
</div>


      {/* UI */}
      <AnimatePresence>
        {showUI && (
          <motion.header
            initial={{ y: -80 }}
            animate={{ y: 0 }}
            exit={{ y: -80 }}
            className="absolute top-0 inset-x-0 h-16 px-4 flex items-center justify-between bg-black/70"
          >
            <button onClick={() => router.push("/dashboard")}>
              <ChevronLeft />
            </button>

            <div className="text-sm">
              Page {page.pageNumber} / {pages.length}
            </div>

            <button
                    onClick={() => setShowOverview(true)}
                    className="p-2 rounded-full hover:bg-white/10"
                    >
                    <LayoutGrid />
                    </button>

          </motion.header>
        )}
      </AnimatePresence>

      <AnimatePresence>
  {showOverview && (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-50 bg-black"
    >
      {/* HEADER */}
      <header className="h-16 px-4 flex items-center justify-between border-b border-white/10">
        <h2 className="text-sm font-bold tracking-wide">All Pages</h2>
        <button
          onClick={() => setShowOverview(false)}
          className="p-2 rounded-full hover:bg-white/10"
        >
          <X />
        </button>
      </header>

      {/* GRID */}
      <div className="p-4 grid grid-cols-2 gap-4 overflow-y-auto pb-24">
        {pages.map((p, i) => {
          const isActive = i === index;

          return (
            <button
              key={p.id}
              onClick={() => {
                setIndex(i);
                setShowOverview(false);
                setShowUI(false);
              }}
              className={`relative rounded-lg overflow-hidden border transition-all
                ${
                  isActive
                    ? "border-white ring-2 ring-white"
                    : "border-white/10 hover:border-white/30"
                }`}
            >
              {/* THUMB */}
              {p.imageUrl ? (
                <img
                  src={p.imageUrl}
                  className="w-full aspect-[3/4] object-contain bg-black"
                  alt={`Page ${p.pageNumber}`}
                />
              ) : (
                <div className="w-full aspect-[3/4] flex items-center justify-center text-xs text-white/40 bg-black">
                  Pending
                </div>
              )}

              {/* PAGE NUMBER */}
              <span className="absolute bottom-2 right-2 text-[10px] bg-black/70 px-2 py-1 rounded-full font-bold">
                {p.pageNumber}
              </span>

              {/* ACTIVE LABEL */}
              {isActive && (
                <span className="absolute top-2 left-2 text-[10px] bg-white text-black px-2 py-1 rounded-full font-bold">
                  Current
                </span>
              )}
            </button>
          );
        })}
      </div>
    </motion.div>
  )}
</AnimatePresence>

    </div>
  );
}
