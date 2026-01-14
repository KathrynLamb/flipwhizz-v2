// "use client";

// import { useEffect, useState } from "react";
// import { motion, AnimatePresence } from "framer-motion";
// import {
//   Wand2,
//   Upload,
//   Pencil,
//   ArrowRight,
//   Check,
//   Image as ImageIcon,
//   Loader2,
//   RefreshCw,
//   X,
//   ChevronLeft,
//   ChevronRight,
//   Sparkles,
// } from "lucide-react";

// import { buildCharacterReferences } from "@/lib/buildCharacterreferences";

// /* ======================================================
//    TYPES
// ====================================================== */

// export type Entity = {
//   id: string;
//   name: string;
//   referenceImageUrl?: string | null;
//   description?: string | null;
// };

// export type ClientStyleGuide = {
//   id: string;
//   storyId: string;
//   summary: string | null;
//   styleGuideImage: string | null;
//   negativePrompt: string | null;
//   sampleIllustrationUrl: string | null;
// };

// type SpreadUI = {
//   leftText: string;
//   rightText: string;
//   sceneSummary?: string | null;
//   characters: Entity[];
//   locations: Entity[];
// };

// type StoryStatus =
//   | "world_ready"
//   | "style_ready"
//   | "awaiting_payment"
//   | "awaiting_generation_choice"
//   | "generating";

// /* ======================================================
//    COMPONENT
// ====================================================== */

// export default function InitialStyleDesignEditor({
//   style,
//   spreads,
//   initialSpreadIndex,
//   storyStatus,
//   sampleImage,
// }: {
//   style: ClientStyleGuide;
//   spreads: SpreadUI[];
//   initialSpreadIndex: number;
//   storyStatus: StoryStatus;
//   sampleImage?: string | null;
// }) {
//   /* ---------------- STATE ---------------- */


//   // const spread = spreads[spreadIndex];

//   const [prompt, setPrompt] = useState(style.summary ?? "");
//   const [styleRefUrl, setStyleRefUrl] = useState(style.styleGuideImage);
//   const [mode, setMode] = useState<"view" | "edit" | "upload">("view");

//   const [isUploading, setIsUploading] = useState(false);
//   const [isGeneratingSample, setIsGeneratingSample] = useState(false);
//   const [sampleUrl, setSampleUrl] = useState(
//     style.sampleIllustrationUrl || sampleImage || null
//   );
//   const [generationProgress, setGenerationProgress] = useState("");

//   const safeInitialIndex =
//   typeof initialSpreadIndex === "number" ? initialSpreadIndex : 0;

// const [spreadIndex, setSpreadIndex] = useState(safeInitialIndex);

// // Clamp index if spreads change
// useEffect(() => {
//   console.log("spreads", spreads)
//   if (!Array.isArray(spreads) || spreads.length === 0) return;

//   if (spreadIndex < 0) setSpreadIndex(0);
//   if (spreadIndex > spreads.length - 1) {
//     setSpreadIndex(spreads.length - 1);
//   }
// }, [spreads, spreadIndex]);

// // HARD GUARD
// if (!Array.isArray(spreads) || spreads.length === 0) {
//   return (
//     <div className="min-h-screen flex items-center justify-center text-stone-500">
//       Preparing spreads…
//     </div>
//   );
// }

// const spread = spreads[spreadIndex];

// if (!spread) {
//   return (
//     <div className="min-h-screen flex items-center justify-center text-stone-500">
//       Loading spread…
//     </div>
//   );
// }


//   /* ======================================================
//      ACTIONS
//   ====================================================== */

//   async function savePrompt() {
//     await fetch("/api/style-guide/save", {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify({
//         storyId: style.storyId,
//         summary: prompt,
//       }),
//     });
//     setMode("view");
//   }

//   async function generateSample() {
//     setIsGeneratingSample(true);
//     setSampleUrl(null);
//     setGenerationProgress("Preparing spread…");

//     const references = [
//       ...(styleRefUrl
//         ? [{ url: styleRefUrl, type: "style", label: "Style" }]
//         : []),
//       ...buildCharacterReferences(spread.characters),
//     ];

//     const res = await fetch("/api/style/generate", {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify({
//         storyId: style.storyId,
//         description: prompt,
//         leftText: spread.leftText,
//         rightText: spread.rightText,
//         references,
//         force: true,
//       }),
//     });

//     const { generationId } = await res.json();

//     let ticks = 0;
//     const poll = setInterval(async () => {
//       ticks++;

//       if (ticks === 3) setGenerationProgress("Illustrating scene…");
//       if (ticks === 6) setGenerationProgress("Refining details…");

//       const res = await fetch(
//         `/api/stories/${style.storyId}/style-poll`
//       );
//       if (!res.ok) return;

//       const data = await res.json();
//       if (data.sampleUrl && data.generationId === generationId) {
//         clearInterval(poll);
//         setSampleUrl(data.sampleUrl);
//         setIsGeneratingSample(false);
//         setGenerationProgress("");
//       }

//       if (ticks > 60) {
//         clearInterval(poll);
//         setIsGeneratingSample(false);
//         setGenerationProgress("");
//         alert("Sample timed out");
//       }
//     }, 2000);
//   }

//   /* ======================================================
//      UI
//   ====================================================== */

//   return (
//     <div className="min-h-screen bg-gradient-to-br from-violet-50 to-fuchsia-50 px-6 py-20">
//       <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-10">

//         {/* LEFT */}
//         <div className="space-y-6">

//           {/* SPREAD SELECTOR */}
//           <div className="flex items-center justify-between bg-white rounded-2xl p-4 shadow">
//             <button
//               disabled={spreadIndex === 0}
//               onClick={() => setSpreadIndex(i => i - 1)}
//               className="p-2 disabled:opacity-30"
//             >
//               <ChevronLeft />
//             </button>

//             <div className="text-center">
//               <p className="font-black">
//                 Spread {spreadIndex + 1} of {spreads.length}
//               </p>
//               {spread.sceneSummary && (
//                 <p className="text-sm italic text-stone-500 mt-1">
//                   “{spread.sceneSummary}”
//                 </p>
//               )}
//             </div>

//             <button
//               disabled={spreadIndex === spreads.length - 1}
//               onClick={() => setSpreadIndex(i => i + 1)}
//               className="p-2 disabled:opacity-30"
//             >
//               <ChevronRight />
//             </button>
//           </div>

//           {/* TEXT PREVIEW */}
//           <div className="bg-white rounded-3xl p-6 shadow space-y-3">
//             <p className="italic text-stone-600">Left page</p>
//             <p>{spread.leftText}</p>
//             <p className="italic text-stone-600 mt-4">Right page</p>
//             <p>{spread.rightText}</p>
//           </div>

//           {/* STYLE PROMPT */}
//           <div className="bg-white rounded-3xl p-6 shadow">

//             <div className="flex justify-between mb-3">
//               <h3 className="font-bold">Art style</h3>
//               {mode === "view" && (
//                 <button onClick={() => setMode("edit")}>
//                   <Pencil className="w-4 h-4" />
//                 </button>
//               )}
//             </div>

//             {mode === "view" ? (
//               <p className="italic">{prompt}</p>
//             ) : (
//               <>
//                 <textarea
//                   value={prompt}
//                   onChange={(e) => setPrompt(e.target.value)}
//                   className="w-full h-32 border rounded-xl p-3"
//                 />
//                 <button
//                   onClick={savePrompt}
//                   className="mt-3 px-4 py-2 rounded-full bg-violet-600 text-white font-bold"
//                 >
//                   Save
//                 </button>
//               </>
//             )}
//           </div>
//           <ReferencesPanel
//           styleRefUrl={styleRefUrl}
//           characters={spread.characters}
//           locations={spread.locations}
//         />
//         </div>

//         {/* RIGHT */}
//         <div className="bg-white rounded-3xl p-6 shadow space-y-6">
//           <h3 className="font-bold text-xl">Sample Preview</h3>

//           {isGeneratingSample && (
//             <div className="aspect-[4/3] flex flex-col items-center justify-center">
//               <Loader2 className="animate-spin w-10 h-10 mb-4" />
//               <p>{generationProgress}</p>
//             </div>
//           )}

//           {!isGeneratingSample && !sampleUrl && (
//             <div className="aspect-[4/3] flex flex-col items-center justify-center border-2 border-dashed rounded-2xl">
//               <ImageIcon className="w-10 h-10 mb-3" />
//               <p>No sample yet</p>
//             </div>
//           )}

//           {!isGeneratingSample && sampleUrl && (
//             <img
//               src={sampleUrl}
//               className="rounded-2xl shadow cursor-zoom-in"
//             />
//           )}

//           <button
//             onClick={generateSample}
//             disabled={isGeneratingSample || mode !== "view"}
//             className="w-full py-4 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white font-black"
//           >
//             <Wand2 className="inline w-5 h-5 mr-2" />
//             Generate sample from this spread
//           </button>
//         </div>
//       </div>
//     </div>
//   );
// }

// function ReferencesPanel({
//   styleRefUrl,
//   characters,
//   locations,
// }: {
//   styleRefUrl: string | null;
//   characters: Entity[];
//   locations: Entity[];
// }) {
//   const hasAnything =
//     Boolean(styleRefUrl) ||
//     characters.length > 0 ||
//     locations.length > 0;

//   if (!hasAnything) return null;

//   console.log('chaarc', characters, 'locations', locations)

//   return (
//     <div className="bg-white rounded-3xl p-6 shadow space-y-5">
//       <h3 className="font-bold text-lg flex items-center gap-2">
//         <Sparkles className="w-5 h-5 text-violet-600" />
//         References for this spread
//       </h3>

//       {/* STYLE */}
//       {styleRefUrl && (
//         <div>
//           <p className="text-sm font-semibold text-stone-600 mb-2">
//             Art style
//           </p>
//           <img
//             src={styleRefUrl}
//             alt="Style reference"
//             className="w-full max-w-xs rounded-xl shadow"
//           />
//         </div>
//       )}

//       {/* CHARACTERS */}
//       {characters.length > 0 && (
//         <div>
//           <p className="text-sm font-semibold text-stone-600 mb-2">
//             Characters
//           </p>
//           <div className="flex flex-wrap gap-3">
//             {characters.map((c) => (
//               <div
//                 key={c.id}
//                 className="flex items-center gap-2 bg-stone-50 rounded-xl p-2 pr-3"
//               >
//                 {c.referenceImageUrl ? (
//                   <img
//                     src={c.referenceImageUrl}
//                     className="w-10 h-10 rounded-lg object-cover"
//                   />
//                 ) : (
//                   <div className="w-10 h-10 rounded-lg bg-violet-200 flex items-center justify-center font-bold text-violet-700">
//                     {c.name[0]}
//                   </div>
//                 )}
//                 <span className="text-sm font-medium">{c.name}</span>
//               </div>
//             ))}
//           </div>
//         </div>
//       )}

//       {/* LOCATIONS */}
//       {locations.length > 0 && (
//         <div>
//           <p className="text-sm font-semibold text-stone-600 mb-2">
//             Locations
//           </p>
//           <div className="flex flex-wrap gap-3">
//             {locations.map((l) => (
//               <div
//                 key={l.id}
//                 className="flex items-center gap-2 bg-stone-50 rounded-xl p-2 pr-3"
//               >
//                 {l.referenceImageUrl ? (
//                   <img
//                     src={l.referenceImageUrl}
//                     className="w-10 h-10 rounded-lg object-cover"
//                   />
//                 ) : (
//                   <div className="w-10 h-10 rounded-lg bg-amber-200 flex items-center justify-center font-bold text-amber-700">
//                     {l.name[0]}
//                   </div>
//                 )}
//                 <span className="text-sm font-medium">{l.name}</span>
//               </div>
//             ))}
//           </div>
//         </div>
//       )}
//     </div>
//   );
// }
"use client";

import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Wand2,
  Pencil,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Image as ImageIcon,
  Loader2,
  Save,
  Quote,
  MapPin,
  User,
  Palette,
} from "lucide-react";

import { buildCharacterReferences } from "@/lib/buildCharacterreferences";

/* ======================================================
   TYPES
====================================================== */

export type Entity = {
  id: string;
  name: string;
  referenceImageUrl?: string | null;
  description?: string | null;
};

export type ClientStyleGuide = {
  id: string;
  storyId: string;
  summary: string | null;
  styleGuideImage: string | null;
  negativePrompt: string | null;
  sampleIllustrationUrl: string | null;
};

type SpreadUI = {
  leftText: string;
  rightText: string;
  sceneSummary?: string | null;
  characters: Entity[];
  locations: Entity[];
};

type StoryStatus =
  | "world_ready"
  | "style_ready"
  | "awaiting_payment"
  | "awaiting_generation_choice"
  | "generating";

/* ======================================================
   COMPONENT
====================================================== */

export default function InitialStyleDesignEditor({
  style,
  spreads,
  initialSpreadIndex,
  storyStatus,
  sampleImage,
}: {
  style: ClientStyleGuide;
  spreads: SpreadUI[];
  initialSpreadIndex: number;
  storyStatus: StoryStatus;
  sampleImage?: string | null;
}) {
  /* ---------------- STATE ---------------- */
  const [prompt, setPrompt] = useState(style.summary ?? "");
  const [styleRefUrl, setStyleRefUrl] = useState(style.styleGuideImage);
  const [mode, setMode] = useState<"view" | "edit">("view");

  const [isGeneratingSample, setIsGeneratingSample] = useState(false);
  const [sampleUrl, setSampleUrl] = useState(
    style.sampleIllustrationUrl || sampleImage || null
  );
  const [generationProgress, setGenerationProgress] = useState("");

  const safeInitialIndex =
    typeof initialSpreadIndex === "number" ? initialSpreadIndex : 0;

  const [spreadIndex, setSpreadIndex] = useState(safeInitialIndex);

  // Clamp index if spreads change
  useEffect(() => {
    if (!Array.isArray(spreads) || spreads.length === 0) return;
    if (spreadIndex < 0) setSpreadIndex(0);
    if (spreadIndex > spreads.length - 1) {
      setSpreadIndex(spreads.length - 1);
    }
  }, [spreads, spreadIndex]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (mode === "edit") return; // Don't navigate while typing
      if (e.key === "ArrowLeft") setSpreadIndex((i) => Math.max(0, i - 1));
      if (e.key === "ArrowRight")
        setSpreadIndex((i) => Math.min(spreads.length - 1, i + 1));
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [spreads.length, mode]);

  // HARD GUARD
  if (!Array.isArray(spreads) || spreads.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-slate-400 bg-slate-50 gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-violet-600" />
        <p className="font-medium">Preparing story board...</p>
      </div>
    );
  }

  const spread = spreads[spreadIndex];

  if (!spread) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500 bg-slate-50">
        Loading spread data...
      </div>
    );
  }

  /* ======================================================
     ACTIONS
  ====================================================== */

  async function savePrompt() {
    await fetch("/api/style-guide/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        storyId: style.storyId,
        summary: prompt,
      }),
    });
    setMode("view");
  }


    async function generateSample() {
      setIsGeneratingSample(true);
      setSampleUrl(null);
      setGenerationProgress("Preparing spread…");
  
      // 1. Build Location References
      // We reuse the same structure as characters since the Entity type is the same
      const locationRefs = spread.locations
        .filter((l) => l.referenceImageUrl)
        .map((l) => ({
          type: "location", // 👈 Distinct type
          label: l.name,
          mode: "image",
          url: l.referenceImageUrl!,
        }));
  
      // 2. Build Character References (existing logic)
      const characterRefs = buildCharacterReferences(spread.characters);
  
      // 3. Combine All References
      const references = [
        ...(styleRefUrl
          ? [{ url: styleRefUrl, type: "style", label: "Art Style" }]
          : []),
        ...locationRefs, // 👈 ADDED THIS
        ...characterRefs,
      ];
  
      const res = await fetch("/api/style/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storyId: style.storyId,
          description: prompt,
          leftText: spread.leftText,
          rightText: spread.rightText,
          references,
          force: true,
        }),
      });

    const { generationId } = await res.json();

    let ticks = 0;
    const poll = setInterval(async () => {
      ticks++;

      if (ticks === 3) setGenerationProgress("Sketching layout…");
      if (ticks === 6) setGenerationProgress("Painting details…");
      if (ticks === 12) setGenerationProgress("Adding magic…");

      const res = await fetch(`/api/stories/${style.storyId}/style-poll`);
      if (!res.ok) return;

      const data = await res.json();
      if (data.sampleUrl && data.generationId === generationId) {
        clearInterval(poll);
        setSampleUrl(data.sampleUrl);
        setIsGeneratingSample(false);
        setGenerationProgress("");
      }

      if (ticks > 60) {
        clearInterval(poll);
        setIsGeneratingSample(false);
        setGenerationProgress("");
        alert("Sample timed out. Please try again.");
      }
    }, 2000);
  }

  /* ======================================================
     UI
  ====================================================== */

  return (
    <div className="min-h-screen bg-[#FDFCFE] text-slate-800 font-sans selection:bg-violet-100 selection:text-violet-900">
      {/* HEADER / NAV */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-100 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 bg-violet-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-violet-200">
              <Palette className="w-6 h-6" />
            </div>
            <div>
              <h1 className="font-bold text-lg text-slate-900 leading-tight">
                Style Designer
              </h1>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Spread {spreadIndex + 1} of {spreads.length}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg">
            <button
              disabled={spreadIndex === 0}
              onClick={() => setSpreadIndex((i) => i - 1)}
              className="p-2 hover:bg-white hover:shadow-sm rounded-md disabled:opacity-30 disabled:hover:bg-transparent transition-all"
            >
              <ChevronLeft className="w-5 h-5 text-slate-600" />
            </button>
            <span className="text-sm font-semibold text-slate-600 px-2 min-w-[3rem] text-center">
              {spreadIndex + 1} / {spreads.length}
            </span>
            <button
              disabled={spreadIndex === spreads.length - 1}
              onClick={() => setSpreadIndex((i) => i + 1)}
              className="p-2 hover:bg-white hover:shadow-sm rounded-md disabled:opacity-30 disabled:hover:bg-transparent transition-all"
            >
              <ChevronRight className="w-5 h-5 text-slate-600" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 lg:p-10 grid lg:grid-cols-12 gap-8 lg:gap-12 items-start">
        {/* LEFT COLUMN: CONTEXT & CONTROLS */}
        <div className="lg:col-span-7 space-y-8">
          {/* SPREAD CONTEXT (BOOK VISUAL) */}
          <section className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-violet-100 to-fuchsia-100 rounded-[2rem] blur opacity-40 group-hover:opacity-75 transition duration-500" />
            <div className="relative bg-white rounded-[1.5rem] shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
              {/* Fake Book Spine Gradient */}
              <div className="absolute left-1/2 top-0 bottom-0 w-px bg-slate-200 z-10" />
              <div className="absolute left-1/2 -ml-8 top-0 bottom-0 w-16 bg-gradient-to-r from-transparent via-slate-100/50 to-transparent pointer-events-none z-0" />

              <div className="grid grid-cols-2 min-h-[280px]">
                {/* LEFT PAGE */}
                <div className="p-8 lg:p-10 flex flex-col justify-center border-r border-slate-50 relative">
                  <span className="absolute top-6 left-8 text-[10px] font-bold text-slate-300 uppercase tracking-widest">
                    Page {spreadIndex * 2 + 1}
                  </span>
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={spreadIndex + "left"}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                      transition={{ duration: 0.2 }}
                    >
                      <p className="font-serif text-lg leading-relaxed text-slate-700">
                        {spread.leftText || (
                          <span className="text-slate-300 italic">
                            (No text on this page)
                          </span>
                        )}
                      </p>
                    </motion.div>
                  </AnimatePresence>
                </div>

                {/* RIGHT PAGE */}
                <div className="p-8 lg:p-10 flex flex-col justify-center relative">
                  <span className="absolute top-6 right-8 text-[10px] font-bold text-slate-300 uppercase tracking-widest">
                    Page {spreadIndex * 2 + 2}
                  </span>
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={spreadIndex + "right"}
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      transition={{ duration: 0.2 }}
                    >
                      <p className="font-serif text-lg leading-relaxed text-slate-700">
                        {spread.rightText || (
                          <span className="text-slate-300 italic">
                            (No text on this page)
                          </span>
                        )}
                      </p>
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>

              {spread.sceneSummary && (
                <div className="bg-slate-50 px-6 py-3 border-t border-slate-100 flex items-start gap-3">
                  <Quote className="w-4 h-4 text-violet-400 mt-1 shrink-0" />
                  <p className="text-sm text-slate-500 italic">
                    {spread.sceneSummary}
                  </p>
                </div>
              )}
            </div>
          </section>

          {/* CONTROLS CONTAINER */}
          <div className="grid gap-6">
            {/* PROMPT EDITOR */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  <Wand2 className="w-4 h-4 text-violet-600" />
                  Art Style Prompt
                </h3>
                {mode === "view" && (
                  <button
                    onClick={() => setMode("edit")}
                    className="text-xs font-semibold text-violet-600 hover:text-violet-700 hover:bg-violet-50 px-3 py-1.5 rounded-full transition-colors flex items-center gap-1.5"
                  >
                    <Pencil className="w-3 h-3" />
                    Edit
                  </button>
                )}
              </div>

              <div className="p-5">
                {mode === "view" ? (
                  <p className="text-slate-600 leading-relaxed">
                    {prompt || (
                      <span className="italic text-slate-400">
                        No style prompt defined yet...
                      </span>
                    )}
                  </p>
                ) : (
                  <div className="space-y-3">
                    <textarea
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      className="w-full h-32 border border-slate-300 rounded-xl p-4 text-slate-700 focus:ring-2 focus:ring-violet-200 focus:border-violet-500 outline-none transition-all resize-none shadow-inner bg-slate-50"
                      placeholder="Describe the art style clearly..."
                      autoFocus
                    />
                    <div className="flex justify-end">
                      <button
                        onClick={savePrompt}
                        className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-lg font-semibold text-sm transition-all shadow-md shadow-violet-200"
                      >
                        <Save className="w-4 h-4" />
                        Save Changes
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* REFERENCES PANEL */}
            <ReferencesPanel
              styleRefUrl={styleRefUrl}
              characters={spread.characters}
              locations={spread.locations}
            />
          </div>
        </div>

        {/* RIGHT COLUMN: PREVIEW (STICKY) */}
        <div className="lg:col-span-5 relative">
          <div className="sticky top-28 space-y-6">
            <div className="bg-white rounded-[2rem] p-3 shadow-2xl shadow-slate-200/50 border border-slate-100">
              <div className="relative aspect-[4/3] w-full bg-slate-100 rounded-[1.5rem] overflow-hidden group">
                {/* LOADING STATE */}
                <AnimatePresence>
                  {isGeneratingSample && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 z-20 bg-white/90 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center"
                    >
                      <div className="relative">
                        <div className="absolute inset-0 bg-violet-500 blur-xl opacity-20 animate-pulse rounded-full" />
                        <Loader2 className="relative w-12 h-12 text-violet-600 animate-spin mb-4" />
                      </div>
                      <p className="text-violet-900 font-bold text-lg animate-pulse">
                        {generationProgress}
                      </p>
                      <p className="text-slate-500 text-sm mt-2">
                        Crafting your masterpiece...
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* EMPTY STATE */}
                {!isGeneratingSample && !sampleUrl && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 rounded-[1.5rem] m-2">
                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                      <ImageIcon className="w-8 h-8 text-slate-300" />
                    </div>
                    <p className="font-medium">No sample generated yet</p>
                  </div>
                )}

                {/* IMAGE DISPLAY */}
                {sampleUrl && (
                  <>
                    <img
                      src={sampleUrl}
                      alt="Sample spread"
                      className={`w-full h-full object-cover transition-all duration-700 ${
                        isGeneratingSample ? "scale-105 blur-sm" : "scale-100"
                      }`}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-center pb-6">
                      <a
                        href={sampleUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="bg-white/20 backdrop-blur-md border border-white/30 text-white px-4 py-2 rounded-full text-sm font-medium hover:bg-white hover:text-slate-900 transition-colors"
                      >
                        View Full Size
                      </a>
                    </div>
                  </>
                )}
              </div>

              {/* ACTION BUTTON */}
              <div className="mt-4 px-2 pb-2">
                <button
                  onClick={generateSample}
                  disabled={isGeneratingSample || mode !== "view"}
                  className="w-full relative group overflow-hidden py-4 rounded-xl bg-slate-900 text-white font-bold shadow-xl shadow-slate-200 disabled:opacity-70 disabled:cursor-not-allowed transform active:scale-[0.98] transition-all"
                >
                  <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-violet-600 via-fuchsia-600 to-violet-600 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-[length:200%_auto] animate-gradient" />
                  <span className="relative flex items-center justify-center gap-2">
                    <Sparkles className="w-5 h-5" />
                    {sampleUrl ? "Regenerate Sample" : "Generate Concept"}
                  </span>
                </button>
                <p className="text-center text-xs text-slate-400 mt-3 px-4">
                  Generates a visual proof of concept for this specific spread
                  layout.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

/* ======================================================
   SUB-COMPONENTS
====================================================== */

function ReferencesPanel({
  styleRefUrl,
  characters,
  locations,
}: {
  styleRefUrl: string | null;
  characters: Entity[];
  locations: Entity[];
}) {
  const hasAnything =
    Boolean(styleRefUrl) || characters.length > 0 || locations.length > 0;

  if (!hasAnything) return null;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
      <div className="flex items-center gap-2 pb-4 border-b border-slate-100">
        <Sparkles className="w-4 h-4 text-amber-500" />
        <h3 className="font-bold text-slate-800">Active References</h3>
      </div>

      <div className="space-y-6">
        {/* STYLE */}
        {styleRefUrl && (
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
              Art Direction
            </p>
            <div className="relative group w-32 aspect-square rounded-xl overflow-hidden shadow-md border border-slate-200">
              <img
                src={styleRefUrl}
                alt="Style reference"
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <span className="text-white text-xs font-bold">Style Ref</span>
              </div>
            </div>
          </div>
        )}

        {/* CHARACTERS */}
        {characters.length > 0 && (
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
              Characters in Scene
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {characters.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center gap-3 bg-slate-50 hover:bg-slate-100 border border-slate-100 rounded-xl p-2 transition-colors"
                >
                  <div className="w-12 h-12 shrink-0 rounded-lg overflow-hidden border border-slate-200 shadow-sm bg-white">
                    {c.referenceImageUrl ? (
                      <img
                        src={c.referenceImageUrl}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-violet-100 text-violet-600">
                        <User className="w-6 h-6" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-700 truncate">
                      {c.name}
                    </p>
                    <p className="text-xs text-slate-400 truncate">Character</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* LOCATIONS */}
        {locations.length > 0 && (
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
              Location
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {locations.map((l) => (
                <div
                  key={l.id}
                  className="flex items-center gap-3 bg-slate-50 hover:bg-slate-100 border border-slate-100 rounded-xl p-2 transition-colors"
                >
                  <div className="w-12 h-12 shrink-0 rounded-lg overflow-hidden border border-slate-200 shadow-sm bg-white">
                    {l.referenceImageUrl ? (
                      <img
                        src={l.referenceImageUrl}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-amber-100 text-amber-600">
                        <MapPin className="w-6 h-6" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-700 truncate">
                      {l.name}
                    </p>
                    <p className="text-xs text-slate-400 truncate">Setting</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}