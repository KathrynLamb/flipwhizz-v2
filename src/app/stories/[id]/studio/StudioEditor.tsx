// "use client";

// import { useState, useEffect, useMemo } from "react";

// import { 
//   Loader2, 
//   RefreshCw, 
//   ChevronLeft, 
//   Download,
//   Play,
//   ImagePlus
// } from "lucide-react";
// import { motion } from "framer-motion";
// import Link from "next/link";
// import { useRouter } from "next/navigation";

// type Page = {
//   id: string;
//   pageNumber: number;
//   text: string;
//   imageUrl: string | null;
// };

// // --- HELPER: Group Pages into Spreads ---
// function groupIntoSpreads(pages: Page[]) {
//   const spreads = [];
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

// export default function StudioEditor({ 
//   story, 
//   initialPages, 
//   initialMode 
// }: { 
//   story: any, 
//   initialPages: Page[], 
//   styleGuide: any,
//   initialMode: 'live' | 'edit'
// }) {
//   const [pages, setPages] = useState<Page[]>(initialPages);
//   const router = useRouter();

//   // Polling State
//   const [isPolling, setIsPolling] = useState(
//     initialMode === 'live' || story.status === 'generating'
//   );
  
//   const [regeneratingIds, setRegeneratingIds] = useState<Set<string>>(new Set());
//   const [isStartingGlobal, setIsStartingGlobal] = useState(false);

//   const spreads = useMemo(() => groupIntoSpreads(pages), [pages]);
//   const [isExporting, setIsExporting] = useState(false);



// async function handleExportPDF() {
//   if (isExporting) return;
//   setIsExporting(true);

//   try {
//     const res = await fetch(`/api/stories/${story.id}/export-pdf`, {
//       method: "POST",
//     });

//     const data = await res.json();
//     if (!res.ok) throw new Error(data.error || "Export failed");

//     // open/download the PDF
//     window.open(data.url, "_blank");
//   } catch (err: any) {
//     alert(err.message || "Failed to export PDF");
//   } finally {
//     setIsExporting(false);
//   }
// }

// // --- 1. POLLING LOGIC ---
//   useEffect(() => {
//     if (!isPolling) return;

//     const interval = setInterval(async () => {
//       const res = await fetch(`/api/stories/${story.id}/pages`);
//       if (res.ok) {
//         const updatedPages = await res.json();
//         setPages(updatedPages);

//         const allDone = updatedPages.every((p: Page) => p.imageUrl);
//         if (allDone && regeneratingIds.size === 0) {
//           setIsPolling(false);
//           setIsStartingGlobal(false);
//         }
//       }
//     }, 3000);

//     return () => clearInterval(interval);
//   }, [isPolling, story.id, regeneratingIds.size]);

//   // --- 2. ACTIONS ---

//   async function handleRegenerateSpread(leftPageId: string) {
//     setRegeneratingIds(prev => new Set(prev).add(leftPageId));
//     try {
//       await fetch(`/api/stories/${story.id}/pages/${leftPageId}/regenerate`, { method: "POST" });
//       setIsPolling(true); 
//     } catch (e) {
//       alert("Failed to start generation");
//       setRegeneratingIds(prev => {
//         const next = new Set(prev);
//         next.delete(leftPageId);
//         return next;
//       });
//     }
//   }

//   async function handleGenerateAll() {
//     if (!confirm("Generate all missing illustrations?")) return;
//     setIsStartingGlobal(true);
//     try {
//         await fetch(`/api/stories/${story.id}/start-generation`, { method: "POST" });
//         setIsPolling(true);
//     } catch (e) {
//         alert("Failed to start factory");
//         setIsStartingGlobal(false);
//     }
//   }

//   return (
//     <div className="pb-40">
//       {/* --- HEADER --- */}
//       <header className="sticky top-0 z-40 bg-[#FAF9F6]/95 backdrop-blur-md border-b border-stone-200 px-8 py-4 flex items-center justify-between shadow-sm">
//         <div className="flex items-center gap-4">
//           <Link href="/dashboard" className="p-2 hover:bg-stone-200 rounded-full transition-colors">
//             <ChevronLeft className="w-5 h-5 text-stone-600" />
//           </Link>
//           <div>
//             <h1 className="font-serif text-xl text-stone-900 font-bold max-w-md truncate">{story.title}</h1>
//             <div className="text-xs text-stone-500 font-medium uppercase tracking-widest flex items-center gap-2">
//               {isPolling ? (
//                 <span className="flex items-center gap-1 text-indigo-600 animate-pulse">
//                   <Loader2 className="w-3 h-3 animate-spin" /> Artists Working...
//                 </span>
//               ) : (
//                 <span className="flex items-center gap-1 text-green-600">
//                   <span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> Studio Ready
//                 </span>
//               )}
//             </div>
//           </div>
//         </div>
        
//         <div className="flex items-center gap-3">
//   {pages.some(p => !p.imageUrl) && !isPolling && (
//     <button 
//       onClick={handleGenerateAll}
//       disabled={isStartingGlobal}
//       className="bg-indigo-600 text-white px-5 py-2 rounded-full text-sm font-bold flex items-center gap-2 hover:bg-indigo-700 transition-all shadow-md shadow-indigo-200"
//     >
//       {isStartingGlobal ? (
//         <Loader2 className="w-4 h-4 animate-spin"/>
//       ) : (
//         <Play className="w-4 h-4 fill-current" />
//       )}
//       Generate All
//     </button>
//   )}


// <button
//     onClick={() => router.push(`/stories/${story.id}/cover`)}
//     disabled={isExporting}
//     className="bg-stone-900 text-white px-5 py-2 rounded-full text-sm font-bold flex items-center gap-2 hover:bg-black transition-all shadow-md disabled:opacity-50"
//   >
//    create cover
//   </button>

//   <button
//     onClick={handleExportPDF}
//     disabled={isExporting}
//     className="bg-stone-900 text-white px-5 py-2 rounded-full text-sm font-bold flex items-center gap-2 hover:bg-black transition-all shadow-md disabled:opacity-50"
//   >
//     {isExporting ? (
//       <Loader2 className="w-4 h-4 animate-spin" />
//     ) : (
//       <Download className="w-4 h-4" />
//     )}
//     {isExporting ? "Exporting..." : "Export PDF"}
//   </button>
// </div>

//       </header>

//       {/* --- SPREADS CANVAS --- */}
//       <div className="max-w-[1400px] mx-auto p-8 space-y-12">
//         {spreads.map((spread) => {
//             const isRegenerating = regeneratingIds.has(spread.left.id);
//             const hasImage = spread.left.imageUrl; 
//             const isWaiting = isPolling && !hasImage && !isRegenerating;

//             return (
//                 <motion.div 
//                     layout
//                     key={spread.id} 
//                     className="group relative bg-white rounded-xl shadow-lg border border-stone-200/50 overflow-hidden"
//                 >
//                     {/* SPREAD CONTAINER */}
//                     {/* Aspect Video is 16:9, safer for spreads. bg-stone-200 acts as a neutral backing if image is narrower */}
//                     <div className="relative w-full aspect-video bg-stone-200/50 overflow-hidden">
                        
//                         {/* STATE 1: IMAGE EXISTS */}
//                         {hasImage && !isRegenerating ? (
//                             <>
//                                 <img 
//                                     src={spread.left.imageUrl!} 
//                                     alt={`Pages ${spread.left.pageNumber}-${spread.right?.pageNumber}`} 
//                                     // ✅ FIXED: object-contain prevents cropping
//                                     className="w-full h-full object-contain"
//                                 />
                                
//                                 {/* Overlay Controls */}
//                                 <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
//                                     <button 
//                                         onClick={() => handleRegenerateSpread(spread.left.id)}
//                                         className="bg-white/90 backdrop-blur text-stone-700 px-4 py-2 rounded-full text-xs font-bold shadow-lg hover:text-indigo-600 flex items-center gap-2"
//                                     >
//                                         <RefreshCw className="w-3 h-3" /> Redraw Spread
//                                     </button>
//                                 </div>
//                             </>
//                         ) : (
//                             /* STATE 2: NO IMAGE / LOADING */
//                             <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-stone-50">
//                                 {isRegenerating || isWaiting ? (
//                                     <div className="flex flex-col items-center animate-pulse">
//                                         <Loader2 className="w-10 h-10 text-indigo-400 animate-spin mb-4" />
//                                         <span className="text-sm font-bold uppercase tracking-widest text-stone-400">
//                                             {isRegenerating ? "Redrawing Spread..." : "In Queue..."}
//                                         </span>
//                                     </div>
//                                 ) : (
//                                     <div 
//                                         className="cursor-pointer group/empty" 
//                                         onClick={() => handleRegenerateSpread(spread.left.id)}
//                                     >
//                                         <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-sm mb-4 mx-auto group-hover/empty:scale-110 transition-transform group-hover/empty:shadow-md">
//                                             <ImagePlus className="w-8 h-8 text-stone-300 group-hover/empty:text-indigo-500 transition-colors" />
//                                         </div>
//                                         <span className="text-sm font-bold text-stone-400 group-hover/empty:text-indigo-600 transition-colors">
//                                             Generate Spread
//                                         </span>
//                                     </div>
//                                 )}
//                             </div>
//                         )}

//                         {/* PAGE NUMBERS (Floating Bottom Corners - with better contrast) */}
//                         {/* Only show page numbers if NO image, or if image exists we assume user can see page number in art (optional) */}
//                         {/* Let's keep them small and unobtrusive */}
//                         <div className="absolute bottom-4 left-6 bg-black/40 backdrop-blur px-3 py-1 rounded-full text-[10px] font-bold text-white shadow-sm pointer-events-none">
//                             Page {spread.left.pageNumber}
//                         </div>
//                         {spread.right && (
//                             <div className="absolute bottom-4 right-6 bg-black/40 backdrop-blur px-3 py-1 rounded-full text-[10px] font-bold text-white shadow-sm pointer-events-none">
//                                 Page {spread.right.pageNumber}
//                             </div>
//                         )}
//                     </div>
//                 </motion.div>
//             );
//         })}
//       </div>
//     </div>
//   );
// }



"use client";

import { useState, useEffect, useMemo } from "react";
import {
  ChevronLeft,
  ChevronRight,
  X,
  Download,
  LayoutGrid,
  Loader2
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Page = {
  id: string;
  pageNumber: number;
  text: string;
  imageUrl: string | null;
};

export default function StudioEditor({
  story,
  initialPages,
  initialMode,
}: {
  story: any;
  initialPages: Page[];
  initialMode: "live" | "edit";
}) {
  const router = useRouter();
  const [pages, setPages] = useState<Page[]>(initialPages);
  const [index, setIndex] = useState(0);
  const [showUI, setShowUI] = useState(true);
  const [showOverview, setShowOverview] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const page = pages[index];

  // Auto-hide UI on mobile
  useEffect(() => {
    if (!showUI) return;
    const t = setTimeout(() => setShowUI(false), 2200);
    return () => clearTimeout(t);
  }, [showUI]);

  async function handleExportPDF() {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const res = await fetch(`/api/stories/${story.id}/export-pdf`, {
        method: "POST",
      });
      const data = await res.json();
      window.open(data.url, "_blank");
    } finally {
      setIsExporting(false);
    }
  }

  function next() {
    setIndex((i) => Math.min(i + 1, pages.length - 1));
  }

  function prev() {
    setIndex((i) => Math.max(i - 1, 0));
  }

  return (
    <div className="fixed inset-0 bg-black text-white touch-pan-y">

      {/* READER */}
      <motion.div
        key={page.id}
        className="absolute inset-0 flex items-center justify-center"
        onClick={() => setShowUI((v) => !v)}
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        onDragEnd={(_, info) => {
          if (info.offset.x < -80) next();
          if (info.offset.x > 80) prev();
        }}
      >
        {page.imageUrl ? (
          <img
            src={page.imageUrl}
            className="max-h-full max-w-full object-contain"
            alt={`Page ${page.pageNumber}`}
          />
        ) : (
          <div className="flex flex-col items-center justify-center text-center px-8">
            <Loader2 className="w-10 h-10 animate-spin mb-4 text-white/60" />
            <p className="text-sm uppercase tracking-widest text-white/60">
              Preparing illustration…
            </p>
          </div>
        )}
      </motion.div>

      {/* UI CHROME */}
      <AnimatePresence>
        {showUI && (
          <>
            {/* TOP BAR */}
            <motion.header
              initial={{ y: -80 }}
              animate={{ y: 0 }}
              exit={{ y: -80 }}
              className="absolute top-0 inset-x-0 h-16 px-4 flex items-center justify-between bg-gradient-to-b from-black/70 to-transparent"
            >
              <div className="flex items-center gap-3">
                <button
                  onClick={() => router.push("/dashboard")}
                  className="p-2 rounded-full hover:bg-white/10"
                >
                  <ChevronLeft />
                </button>
                <div>
                  <h1 className="text-sm font-bold truncate max-w-[180px]">
                    {story.title}
                  </h1>
                  <p className="text-xs text-white/60">
                    Page {page.pageNumber} / {pages.length}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowOverview(true)}
                  className="p-2 rounded-full hover:bg-white/10"
                >
                  <LayoutGrid />
                </button>
                <button
                  onClick={handleExportPDF}
                  className="p-2 rounded-full hover:bg-white/10"
                >
                  {isExporting ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <Download />
                  )}
                </button>
              </div>
            </motion.header>

            {/* EDGE NAV */}
            <button
              onClick={prev}
              className="absolute left-0 top-1/2 -translate-y-1/2 w-16 h-32"
            />
            <button
              onClick={next}
              className="absolute right-0 top-1/2 -translate-y-1/2 w-16 h-32"
            />
          </>
        )}
      </AnimatePresence>

      {/* OVERVIEW MODE */}
      <AnimatePresence>
        {showOverview && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black z-50"
          >
            <header className="h-16 px-4 flex items-center justify-between border-b border-white/10">
              <h2 className="font-bold">All Pages</h2>
              <button
                onClick={() => setShowOverview(false)}
                className="p-2 rounded-full hover:bg-white/10"
              >
                <X />
              </button>
            </header>

            <div className="p-4 grid grid-cols-2 gap-4 overflow-y-auto">
              {pages.map((p, i) => (
                <button
                  key={p.id}
                  onClick={() => {
                    setIndex(i);
                    setShowOverview(false);
                  }}
                  className="relative bg-white/5 rounded-lg overflow-hidden"
                >
                  {p.imageUrl ? (
                    <img
                      src={p.imageUrl}
                      className="w-full aspect-[3/4] object-contain"
                    />
                  ) : (
                    <div className="aspect-[3/4] flex items-center justify-center text-xs text-white/40">
                      Pending
                    </div>
                  )}
                  <span className="absolute bottom-2 right-2 text-xs bg-black/60 px-2 py-1 rounded-full">
                    {p.pageNumber}
                  </span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
