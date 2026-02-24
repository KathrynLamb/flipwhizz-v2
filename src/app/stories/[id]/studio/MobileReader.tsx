// "use client";

// import { useEffect, useMemo, useRef, useState } from "react";
// import {
//   ChevronLeft,
//   LayoutGrid,
//   X,
//   Loader2,
//   RefreshCw,
//   ImagePlus,
//   Download,
//   Sparkles,
//   Wand2,
//   Zap,
//   Check,
// } from "lucide-react";
// import {
//   motion,
//   useMotionValue,
//   animate,
//   AnimatePresence,
// } from "framer-motion";
// import { useRouter } from "next/navigation";

// /* -------------------------------------------------------------------------- */
// /*                                    Types                                   */
// /* -------------------------------------------------------------------------- */

// type Page = {
//   id: string;
//   pageNumber: number;
//   text: string;
//   imageUrl: string | null;
// };

// type Spread = {
//   id: string;
//   left: Page;
//   right: Page | null;
// };

// /* -------------------------------------------------------------------------- */
// /*                                   Helpers                                  */
// /* -------------------------------------------------------------------------- */

// function groupIntoSpreads(pages: Page[]): Spread[] {
//   const spreads: Spread[] = [];
//   const sorted = [...pages].sort((a, b) => a.pageNumber - b.pageNumber);

//   for (let i = 0; i < sorted.length; i += 2) {
//     spreads.push({
//       id: `spread-${sorted[i].id}`,
//       left: sorted[i],
//       right: sorted[i + 1] || null,
//     });
//   }

//   return spreads;
// }

// /* -------------------------------------------------------------------------- */
// /*                               Cover Slide                                  */
// /* -------------------------------------------------------------------------- */

// function CoverSlide({ url }: { url: string }) {
//   return (
//     <div className="flex-none shrink-0 h-full flex items-center justify-center px-4 landscape:px-16">
//       <div className="bg-black rounded-2xl shadow-2xl overflow-hidden max-w-[1100px] w-full h-full landscape:h-[90%] flex items-center justify-center relative border border-white/10">
//         <img
//           src={url}
//           alt="Book cover spread"
//           className="max-w-full max-h-full object-contain"
//           draggable={false}
//         />

//         <div className="absolute bottom-4 left-4 bg-white/10 backdrop-blur-xl px-3 py-1.5 rounded-full text-xs font-bold text-white border border-white/10">
//           Cover · Back · Spine · Front
//         </div>
//       </div>
//     </div>
//   );
// }

// /* -------------------------------------------------------------------------- */
// /*                               Mobile Studio                                */
// /* -------------------------------------------------------------------------- */

// export default function MobileStudio({
//   story,
//   pages: initialPages,
//   mode,
// }: {
//   story: any;
//   pages: Page[];
//   mode: "live" | "edit";
// }) {
//   const router = useRouter();
//   const containerRef = useRef<HTMLDivElement>(null);

//   /* --------------------------------- State -------------------------------- */

//   const [pages, setPages] = useState<Page[]>(initialPages);
//   const [isPolling, setIsPolling] = useState(
//     mode === "live" || story.status === "generating"
//   );
//   const [isGenerating, setIsGenerating] = useState(false); // ✅ Add this
//   const [isExporting, setIsExporting] = useState(false);

//   const [index, setIndex] = useState(0);
//   const [viewportWidth, setViewportWidth] = useState<number | null>(null);

//   const x = useMotionValue(0);

//   const interiorSpreads = useMemo(
//     () => groupIntoSpreads(pages),
//     [pages]
//   );

//   /**
//    * FINAL SLIDES MODEL
//    * index 0 = cover (if exists)
//    * index 1+ = interior spreads
//    */
//   const slides = useMemo(() => {
//     if (!story.coverSpreadUrl) return interiorSpreads;
//     return ["__COVER__", ...interiorSpreads];
//   }, [interiorSpreads, story.coverSpreadUrl]);

//   const isCoverIndex = story.coverSpreadUrl && index === 0;
//   const spread =
//     !isCoverIndex && typeof slides[index] !== "string"
//       ? (slides[index] as Spread)
//       : null;

//   // ✅ Add completion tracking
//   const completedCount = pages.filter((p) => p.imageUrl).length;
//   const totalCount = pages.length;
//   const allGenerated = completedCount === totalCount;

//   /* ------------------------------ Measure width ---------------------------- */

//   useEffect(() => {
//     const measure = () => {
//       const w =
//         containerRef.current?.getBoundingClientRect().width ??
//         window.innerWidth;
//       setViewportWidth(w);
//       animate(x, -index * w, { duration: 0 });
//     };

//     measure();
//     window.addEventListener("resize", measure);
//     window.addEventListener("orientationchange", measure);

//     return () => {
//       window.removeEventListener("resize", measure);
//       window.removeEventListener("orientationchange", measure);
//     };
//   }, [index, x]);

//   /* ✅ Add polling effect */
//   useEffect(() => {
//     if (!isPolling) return;

//     const interval = setInterval(async () => {
//       const res = await fetch(`/api/stories/${story.id}/pages`, {
//         cache: "no-store",
//       });
//       if (!res.ok) return;

//       const updatedPages: Page[] = await res.json();
//       setPages(updatedPages);

//       if (updatedPages.every((p) => p.imageUrl)) {
//         setIsPolling(false);
//         setIsGenerating(false);
//       }
//     }, 3000);

//     return () => clearInterval(interval);
//   }, [isPolling, story.id]);

//   /* ------------------------------ Navigation -------------------------------- */

//   function clamp(i: number) {
//     return Math.max(0, Math.min(i, slides.length - 1));
//   }

//   function snapTo(i: number) {
//     if (viewportWidth == null) return;
//     const next = clamp(i);
//     setIndex(next);

//     animate(x, -next * viewportWidth, {
//       type: "spring",
//       stiffness: 280,
//       damping: 34,
//     });
//   }

//   function onDragEnd(_: any, info: any) {
//     if (viewportWidth == null) return;

//     const offset = info.offset.x;
//     const velocity = info.velocity.x;

//     if (offset < -viewportWidth * 0.15 || velocity < -500) {
//       snapTo(index + 1);
//     } else if (offset > viewportWidth * 0.15 || velocity > 500) {
//       snapTo(index - 1);
//     } else {
//       snapTo(index);
//     }
//   }

//   /* ✅ Add generate all function */
//   async function handleGenerateAll() {
//     if (isGenerating) return;
//     setIsGenerating(true);
//     setIsPolling(true);

//     try {
//       const res = await fetch(`/api/stories/${story.id}/generate-all`, {
//         method: "POST",
//       });
      
//       if (!res.ok) {
//         throw new Error("Failed to start generation");
//       }
//     } catch (err) {
//       alert("Failed to start generation");
//       setIsGenerating(false);
//       setIsPolling(false);
//     }
//   }

//   /* ------------------------------- Export ---------------------------------- */

//   async function handleExportPDF() {
//     if (isExporting) return;
//     setIsExporting(true);

//     try {
//       const res = await fetch(`/api/stories/${story.id}/export-complete`, {
//         method: "POST",
//       });
//       const data = await res.json();
//       if (!res.ok) throw new Error();
//       window.open(data.url, "_blank");
//     } catch {
//       alert("Failed to export PDF");
//     } finally {
//       setIsExporting(false);
//     }
//   }

//   /* --------------------------------- Render -------------------------------- */

//   if (viewportWidth == null) {
//     return (
//       <div className="fixed inset-0 bg-black flex items-center justify-center">
//         <Loader2 className="w-8 h-8 animate-spin text-white/60" />
//       </div>
//     );
//   }

//   return (
//     <div
//       ref={containerRef}
//       className="fixed inset-0 bg-black text-white overflow-hidden"
//       style={{
//         paddingTop: "env(safe-area-inset-top)",
//         paddingBottom: "env(safe-area-inset-bottom)",
//       }}
//     >
//       {/* ✅ TOP BAR */}
//       <div className="absolute top-0 inset-x-0 px-4 pt-3 pb-6 flex justify-between items-center bg-gradient-to-b from-black/90 via-black/60 to-transparent z-10">
//         <div className="text-xs text-white/60">
//           {completedCount} / {totalCount}
//         </div>
        
//         {!allGenerated && (
//           <button
//             onClick={handleGenerateAll}
//             disabled={isGenerating}
//             className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 disabled:opacity-50"
//           >
//             {isGenerating ? (
//               <>
//                 <Loader2 className="w-3 h-3 animate-spin" />
//                 Generating...
//               </>
//             ) : (
//               <>
//                 <Sparkles className="w-3 h-3" />
//                 Generate All
//               </>
//             )}
//           </button>
//         )}
//       </div>

//       {/* ============================ SWIPE TRACK ============================ */}
//       <motion.div
//         className="flex h-full"
//         style={{ x }}
//         drag="x"
//         dragConstraints={{
//           left: -((slides.length - 1) * viewportWidth),
//           right: 0,
//         }}
//         dragElastic={0.08}
//         onDragEnd={onDragEnd}
//       >
//         {slides.map((s, i) => {
//           if (s === "__COVER__") {
//             return (
//               <div key="cover" style={{ width: viewportWidth }}>
//                 <CoverSlide url={story.coverSpreadUrl} />
//               </div>
//             );
//           }

//           const spread = s as Spread;

//           return (
//             <div
//               key={spread.id}
//               className="flex-none shrink-0 h-full flex items-center justify-center px-4 landscape:px-16"
//               style={{ width: viewportWidth }}
//             >
//               <div className="bg-black rounded-2xl shadow-2xl overflow-hidden max-w-[1100px] w-full h-full landscape:h-[90%] flex items-center justify-center relative border border-white/10">
//                 {spread.left.imageUrl ? (
//                   <>
//                     <img
//                       src={spread.left.imageUrl}
//                       className="max-w-full max-h-full object-contain"
//                       draggable={false}
//                     />

//                     <div className="absolute bottom-4 left-4 bg-white/10 backdrop-blur-xl px-3 py-1.5 rounded-full text-xs font-bold text-white border border-white/10">
//                       Page {spread.left.pageNumber}
//                       {spread.right &&
//                         `–${spread.right.pageNumber}`}
//                     </div>
//                   </>
//                 ) : (
//                   <div className="flex flex-col items-center justify-center text-white/40">
//                     {isGenerating ? (
//                       <>
//                         <Loader2 className="w-8 h-8 mb-2 animate-spin" />
//                         <span className="text-xs">Generating...</span>
//                       </>
//                     ) : (
//                       <>
//                         <ImagePlus className="w-8 h-8 mb-2" />
//                         <span className="text-xs">Not generated</span>
//                       </>
//                     )}
//                   </div>
//                 )}
//               </div>
//             </div>
//           );
//         })}
//       </motion.div>


//       {/* ============================ BOTTOM BAR ============================== */}
//       <div className="absolute bottom-0 inset-x-0 px-4 pb-3 pt-6 flex justify-center bg-gradient-to-t from-black/90 via-black/60 to-transparent">
//         <button
//           onClick={handleExportPDF}
//           disabled={isExporting || !allGenerated}
//           className="bg-white/10 text-white px-5 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 border border-white/10 disabled:opacity-50"
//         >
//           {isExporting ? (
//             <Loader2 className="w-4 h-4 animate-spin" />
//           ) : (
//             <Download className="w-4 h-4" />
//           )}
//           Export PDF
//         </button>
//       </div>
//     </div>
//   );
// }


// src/app/stories/[id]/studio/MobileStudio.tsx (rename from MobileReader.tsx)
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  Loader2,
  ImagePlus,
  Download,
  Sparkles,
  Wand2,
  MessageSquare,
  X,
  Send,
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
/*                            Feedback Modal                                  */
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
    <div className="fixed inset-0 z-50 flex items-end bg-black/60 backdrop-blur-md">
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        className="bg-white rounded-t-3xl w-full max-h-[80vh] overflow-hidden"
      >
        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
          <div>
            <h3 className="font-bold text-lg flex items-center gap-2">
              <Wand2 className="w-5 h-5 text-purple-600" />
              Request Changes
            </h3>
            <p className="text-xs text-gray-500">
              Tell us what to improve
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          <textarea
            autoFocus
            className="w-full border-2 border-gray-200 rounded-xl p-4 h-40 resize-none focus:border-purple-400 focus:outline-none"
            placeholder="e.g., Make the characters more expressive, add more details to the background..."
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            disabled={isSubmitting}
          />
        </div>

        <div className="px-6 pb-6 flex gap-3">
          <button 
            onClick={onClose}
            className="flex-1 px-6 py-3 rounded-xl bg-gray-100 text-gray-700 font-semibold"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              if (feedback.trim()) {
                onSubmit(feedback);
                setFeedback("");
              }
            }}
            disabled={isSubmitting || !feedback.trim()}
            className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
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
/*                               Cover Slide                                  */
/* -------------------------------------------------------------------------- */

function CoverSlide({ url }: { url: string }) {
  return (
    <div className="flex-none shrink-0 h-full flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-xl overflow-hidden w-full max-w-[500px] aspect-[2/1] flex items-center justify-center relative">
        <img
          src={url}
          alt="Book cover"
          className="w-full h-full object-contain"
          draggable={false}
        />
        <div className="absolute top-3 left-3 bg-black/70 backdrop-blur-md px-3 py-1.5 rounded-full text-xs font-bold text-white">
          Cover
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

  const [pages, setPages] = useState<Page[]>(initialPages);
  const [isPolling, setIsPolling] = useState(
    mode === "live" || story.status === "generating"
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
  const [currentSpreadId, setCurrentSpreadId] = useState<string | null>(null);

  const [index, setIndex] = useState(0);
  const [viewportWidth, setViewportWidth] = useState<number | null>(null);

  const x = useMotionValue(0);

  const interiorSpreads = useMemo(
    () => groupIntoSpreads(pages),
    [pages]
  );

  const slides = useMemo(() => {
    if (!story.coverSpreadUrl) return interiorSpreads;
    return ["__COVER__", ...interiorSpreads];
  }, [interiorSpreads, story.coverSpreadUrl]);

  const isCoverIndex = story.coverSpreadUrl && index === 0;
  const spread =
    !isCoverIndex && typeof slides[index] !== "string"
      ? (slides[index] as Spread)
      : null;

  const completedCount = pages.filter((p) => p.imageUrl).length;
  const totalCount = pages.length;
  const allGenerated = completedCount === totalCount;

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
        setIsGenerating(false);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [isPolling, story.id]);

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

  /* ------------------------------- Actions ---------------------------------- */

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

  async function handleFeedback(feedback: string) {
    if (!spread) return;
    
    setIsSubmittingFeedback(true);

    try {
      // Here you'd call an API to regenerate with feedback
      // For now, just close the modal
      setFeedbackModalOpen(false);
      setIsPolling(true);
      setIsGenerating(true);
    } catch (err) {
      alert("Failed to submit feedback");
    } finally {
      setIsSubmittingFeedback(false);
    }
  }

  function handleRequestChanges() {
    if (spread) {
      setCurrentSpreadId(spread.id);
      setFeedbackModalOpen(true);
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
      <AnimatePresence>
        {feedbackModalOpen && (
          <FeedbackModal
            isOpen
            onClose={() => setFeedbackModalOpen(false)}
            onSubmit={handleFeedback}
            isSubmitting={isSubmittingFeedback}
          />
        )}
      </AnimatePresence>

      {/* TOP BAR */}
      <div className="absolute top-0 inset-x-0 px-4 pt-3 pb-6 flex justify-between items-center bg-gradient-to-b from-black/90 via-black/60 to-transparent z-10">
        <div className="text-xs text-white/60">
          {completedCount} / {totalCount}
        </div>
        
        {!allGenerated && (
          <button
            onClick={handleGenerateAll}
            disabled={isGenerating}
            className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 disabled:opacity-50"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="w-3 h-3" />
                Generate All
              </>
            )}
          </button>
        )}
      </div>

      {/* SWIPE TRACK */}
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
              className="flex-none shrink-0 h-full flex items-center justify-center px-4"
              style={{ width: viewportWidth }}
            >
              <div className="bg-white rounded-2xl shadow-xl overflow-hidden w-full max-w-[500px] aspect-[2/1] flex items-center justify-center relative">
                {spread.left.imageUrl ? (
                  <>
                    <img
                      src={spread.left.imageUrl}
                      className="w-full h-full object-contain"
                      draggable={false}
                      alt={`Pages ${spread.left.pageNumber}-${spread.right?.pageNumber}`}
                    />

                    <div className="absolute top-3 left-3 bg-black/70 backdrop-blur-md px-3 py-1.5 rounded-full text-xs font-bold text-white">
                      Pages {spread.left.pageNumber}–{spread.right?.pageNumber}
                    </div>

                    {/* Feedback button */}
                    <button
                      onClick={handleRequestChanges}
                      className="absolute top-3 right-3 bg-purple-600 hover:bg-purple-700 text-white p-2 rounded-full shadow-lg transition-colors"
                    >
                      <MessageSquare className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center text-gray-400">
                    {isGenerating ? (
                      <>
                        <Loader2 className="w-8 h-8 mb-2 animate-spin" />
                        <span className="text-xs">Generating...</span>
                      </>
                    ) : (
                      <>
                        <ImagePlus className="w-8 h-8 mb-2" />
                        <span className="text-xs">Not generated</span>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </motion.div>

      {/* BOTTOM BAR */}
      <div className="absolute bottom-0 inset-x-0 px-4 pb-3 pt-6 flex justify-center gap-3 bg-gradient-to-t from-black/90 via-black/60 to-transparent">
        <button
          onClick={() => router.push(`/stories/${story.id}/cover`)}
          disabled={!allGenerated}
          className="bg-white/10 text-white px-5 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 border border-white/10 disabled:opacity-50"
        >
          <Wand2 className="w-4 h-4" />
          Design Cover
        </button>
      </div>
    </div>
  );
}