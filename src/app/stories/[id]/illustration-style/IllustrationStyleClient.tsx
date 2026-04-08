// "use client";

// import { useEffect, useMemo, useRef, useState } from "react";
// import { useRouter } from "next/navigation";
// import { motion, AnimatePresence } from "framer-motion";
// import {
//   CheckCircle,
//   Lock,
//   Unlock,
//   Sparkles,
//   Save,
//   Loader2,
//   Wand2,
//   X,
//   Eye,
//   Palette,
//   Tag,
//   ChevronDown,
//   Info,
// } from "lucide-react";
// import type { StepKey } from "@/lib/storySteps";
// import UnifiedStoryHeader from "@/app/stories/components/StoryHeader";

// /* ------------------------------------------------------------------ */
// /* TYPES                                                               */
// /* ------------------------------------------------------------------ */

// type ColorPalette = {
//   primary: string;
//   secondary: string;
//   accent: string;
//   mood: string;
//   hex: string[];
// };

// // What the DB / server gives us — user-facing fields only
// export type StyleGuide = {
//   id: string;
//   storyId: string;
//   summary: string | null;
//   artStyle: string | null;
//   visualThemes: string | null;
//   colorPalette: ColorPalette | null;
//   sampleIllustrationUrl: string | null;
//   approved: boolean | null;
//   updatedAt: string | Date | null;
//   // 🔒 promptBase / negativePrompt intentionally NOT in this type
//   //    They live in DB as userNotes/negativePrompt but are never passed to the client
// };

// type Props = {
//   storyId: string;
//   storyTitle?: string;
//   storyConfirmed: boolean;
//   styleGuide: StyleGuide | null;
//   currentStep?: StepKey;
//   completedSteps?: StepKey[];
// };

// // What the analyze endpoint returns (includes internal fields we immediately forward to save)
// type AnalysisResult = {
//   summary: string;
//   artStyle: string;
//   visualThemes: string;
//   colorPalette: ColorPalette;
//   promptBase: string;      // 🔒 internal — forwarded to save, never stored in state
//   negativePrompt: string;  // 🔒 internal — forwarded to save, never stored in state
// };

// /* ------------------------------------------------------------------ */
// /* QUICK-TUNE PRESETS                                                  */
// /* ------------------------------------------------------------------ */

// const QUICK_TUNES = [
//   { label: "Dreamlike & Soft",  icon: "🌙", prompt: "Soft, dreamlike quality with gentle, diffused lighting and a slightly ethereal atmosphere. Colours feel like a half-remembered dream." },
//   { label: "Bold & Graphic",    icon: "⚡", prompt: "Bold graphic outlines with flat, punchy colours. High contrast. Clean and striking like a vintage poster." },
//   { label: "Cosy & Warm",       icon: "🍂", prompt: "Warm golden tones, cosy textures, intimate scenes. Feels like a story told by firelight." },
//   { label: "Magical Forest",    icon: "🌿", prompt: "Lush greens and dappled light. Organic, nature-inspired details. Every leaf and twig feels alive with magic." },
//   { label: "Bright & Playful",  icon: "🎨", prompt: "Rainbow-bright palette, energetic composition, full of joy and movement. Makes you want to jump inside the page." },
//   { label: "Gentle Pastels",    icon: "🌸", prompt: "Soft pastel palette with delicate, light-filled scenes. Tender and gentle, like a lullaby in colour." },
// ];

// /* ------------------------------------------------------------------ */
// /* FIELD CONFIG — user-facing only, no internal prompt fields         */
// /* ------------------------------------------------------------------ */

// type FieldKey = "summary" | "artStyle" | "visualThemes";

// type FieldConfig = {
//   key: FieldKey;
//   label: string;
//   icon: React.ReactNode;
//   placeholder: string;
//   hint: string;
//   minH: string;
// };

// const FIELDS: FieldConfig[] = [
//   {
//     key: "summary",
//     label: "Style Vision",
//     icon: <Eye className="w-4 h-4" />,
//     placeholder: "Describe the overall look and feel you're dreaming of… e.g. 'Warm watercolour with a whimsical, storybook glow — every page glowing like a summer afternoon'",
//     hint: "This is your creative brief — the heart of how your illustrations will feel. Be vivid and personal.",
//     minH: "min-h-[140px]",
//   },
//   {
//     key: "artStyle",
//     label: "Art Style",
//     icon: <Palette className="w-4 h-4" />,
//     placeholder: "e.g. Watercolour & soft ink, Bold graphic illustration, Gentle pencil wash",
//     hint: "A short, beautiful label for the technique. Auto-filled when you upload a reference image.",
//     minH: "min-h-[64px]",
//   },
//   {
//     key: "visualThemes",
//     label: "Mood & Themes",
//     icon: <Tag className="w-4 h-4" />,
//     placeholder: "e.g. Nature, wonder, golden hour, cosy adventure, friendship",
//     hint: "The emotional themes that will run through every illustration. Helps the AI stay true to the feeling you want.",
//     minH: "min-h-[64px]",
//   },
// ];

// /* ------------------------------------------------------------------ */
// /* COMPONENT                                                           */
// /* ------------------------------------------------------------------ */

// export default function IllustrationStyleClient({
//   storyId,
//   storyTitle = "Illustration Style",
//   storyConfirmed,
//   styleGuide,
//   currentStep = "studio",
//   completedSteps = [],
// }: Props) {
//   const router = useRouter();

//   /* ── User-facing state (displayed in UI) ── */
//   const [summary, setSummary]             = useState(styleGuide?.summary ?? "");
//   const [artStyle, setArtStyle]           = useState(styleGuide?.artStyle ?? "");
//   const [visualThemes, setVisualThemes]   = useState(styleGuide?.visualThemes ?? "");
//   const [colorPalette, setColorPalette]   = useState<ColorPalette | null>(styleGuide?.colorPalette ?? null);
//   const [sampleIllustrationUrl, setSampleIllustrationUrl] = useState<string | null>(
//     styleGuide?.sampleIllustrationUrl ?? null
//   );
//   const [locked, setLocked] = useState(styleGuide?.approved ?? false);

//   /* ── UI state ── */
//   const [saving, setSaving]               = useState(false);
//   const [analyzing, setAnalyzing]         = useState(false);
//   const [uploading, setUploading]         = useState(false);
//   const [saveSuccess, setSaveSuccess]     = useState(false);
//   const [activeHint, setActiveHint]       = useState<string | null>(null);
//   const [showQuickTunes, setShowQuickTunes] = useState(false);
//   const [dragOver, setDragOver]           = useState(false);

//   const fileInputRef = useRef<HTMLInputElement | null>(null);

//   /* ── Setters map for FIELDS loop ── */
//   const setters: Record<FieldKey, (v: string) => void> = {
//     summary: setSummary,
//     artStyle: setArtStyle,
//     visualThemes: setVisualThemes,
//   };
//   const values: Record<FieldKey, string> = { summary, artStyle, visualThemes };

//   /* ── Sync when styleGuide prop changes ── */
//   useEffect(() => {
//     setSummary(styleGuide?.summary ?? "");
//     setArtStyle(styleGuide?.artStyle ?? "");
//     setVisualThemes(styleGuide?.visualThemes ?? "");
//     setColorPalette(styleGuide?.colorPalette ?? null);
//     setSampleIllustrationUrl(styleGuide?.sampleIllustrationUrl ?? null);
//     setLocked(styleGuide?.approved ?? false);
//   // Include colorPalette in deps: old rows without hex will re-sync cleanly
//   // Include sampleIllustrationUrl: image appears after upload without hard refresh
//   }, [styleGuide?.id, styleGuide?.sampleIllustrationUrl, styleGuide?.colorPalette]);

//   /* ── Dirty check (user-facing fields only) ── */
//   const dirty = useMemo(() => {
//     return (
//       (styleGuide?.summary ?? "")              !== summary       ||
//       (styleGuide?.artStyle ?? "")             !== artStyle      ||
//       (styleGuide?.visualThemes ?? "")         !== visualThemes  ||
//       (styleGuide?.sampleIllustrationUrl ?? null) !== sampleIllustrationUrl ||
//       (styleGuide?.approved ?? false)          !== locked
//     );
//   }, [styleGuide, summary, artStyle, visualThemes, sampleIllustrationUrl, locked]);

//   /* ---------------------------------------------------------------- */
//   /* SAVE                                                              */
//   /* Accepts an optional partial to merge in internal fields           */
//   /* (promptBase / negativePrompt) without storing them in state       */
//   /* ---------------------------------------------------------------- */
//   async function saveGuide(partial?: Record<string, unknown>) {
//     setSaving(true);
//     try {
//       const res = await fetch(`/api/stories/${storyId}/style-guide`, {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({
//           // User-facing fields from state
//           summary,
//           artStyle,
//           visualThemes,
//           colorPalette,
//           sampleIllustrationUrl,
//           approved: locked,
//           // Internal fields (promptBase / negativePrompt) only present when
//           // passed via `partial` — never stored in component state
//           ...(partial ?? {}),
//         }),
//       });
//       if (!res.ok) throw new Error(await res.text());
//       setSaveSuccess(true);
//       setTimeout(() => setSaveSuccess(false), 2500);
//       router.refresh();
//     } catch (err: any) {
//       alert(err?.message ?? "Failed to save");
//     } finally {
//       setSaving(false);
//     }
//   }

//   /* ---------------------------------------------------------------- */
//   /* LOCK                                                              */
//   /* ---------------------------------------------------------------- */
//   async function toggleLock(next: boolean) {
//     setLocked(next);
//     await saveGuide({ approved: next });

//     if (next) {
//       // Mark "design" as completed in the DB
//       try {
//         await fetch(`/api/stories/${storyId}/complete-step`, {
//           method: "POST",
//           headers: { "Content-Type": "application/json" },
//           body: JSON.stringify({ step: "design" }),
//         });
//       } catch (e) {
//         console.error("Failed to mark step complete", e);
//       }
//       // Navigate to next step
//       router.push(`/stories/${storyId}/characters`);
//     }
//   }

//   /* ---------------------------------------------------------------- */
//   /* FILE UPLOAD + VISION                                              */
//   /* ---------------------------------------------------------------- */
//   async function onPickFile(file: File) {
//     if (!file) return;
//     setUploading(true);

//     try {
//       /* 1. Upload to Cloudinary */
//       const form = new FormData();
//       form.append("file", file);
//       const up = await fetch(`/api/stories/${storyId}/style-guide/upload`, {
//         method: "POST",
//         body: form,
//       });
//       if (!up.ok) throw new Error(await up.text());
//       const { url } = await up.json();
//       setSampleIllustrationUrl(url);

//       /* 2. Analyse with Claude vision */
//       setAnalyzing(true);
//       const vision = await fetch(`/api/stories/${storyId}/style-guide/analyze`, {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({ imageUrl: url }),
//       });
//       if (!vision.ok) throw new Error(await vision.text());

//       const v: AnalysisResult = await vision.json();

//       /* 3. Update user-facing state */
//       if (v.summary)       setSummary(v.summary);
//       if (v.artStyle)      setArtStyle(v.artStyle);
//       if (v.visualThemes)  setVisualThemes(v.visualThemes);
//       if (v.colorPalette)  setColorPalette(v.colorPalette);

//       /* 4. Save everything including internal fields
//             promptBase → stored server-side as `userNotes` (column name obscures purpose)
//             negativePrompt → stored as `negativePrompt`
//             Neither ever touches React state — forwarded directly here */
//       await saveGuide({
//         sampleIllustrationUrl: url,
//         summary: v.summary,
//         artStyle: v.artStyle,
//         visualThemes: v.visualThemes,
//         colorPalette: v.colorPalette,
//         promptBase: v.promptBase,           // 🔒 internal — goes straight to server
//         negativePrompt: v.negativePrompt,   // 🔒 internal — goes straight to server
//       });
//     } catch (err: any) {
//       alert(err?.message ?? "Failed");
//     } finally {
//       setUploading(false);
//       setAnalyzing(false);
//     }
//   }

//   const isLoading = uploading || analyzing;
//   const loadingLabel = uploading ? "Uploading your image…" : "Reading the magic…";

//   /* ---------------------------------------------------------------- */
//   /* RENDER                                                            */
//   /* ---------------------------------------------------------------- */
//   return (
//     <>
//       <UnifiedStoryHeader
//         storyId={storyId}
//         title={storyTitle}
//         currentStep={currentStep}
//         completedSteps={completedSteps}
//         showProgress={!storyConfirmed}
//         progressCurrent={locked ? 1 : 0}
//         progressTotal={1}
//         hasPages
//         storyConfirmed

//       />

//       <main className="max-w-[1160px] mx-auto px-4 sm:px-6 py-10">

//         {/* PAGE HEADER */}
//         <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
//           <div>
//             <div className="flex items-center gap-2 mb-1">
//               <span className="text-2xl">🎨</span>
//               <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
//                 Craft Your Illustration Style
//               </h1>
//             </div>
//             <p className="text-gray-500 text-base max-w-lg leading-relaxed">
//               This is where your book finds its visual voice. Upload an image you love, or describe the world you're imagining — our AI will weave it into every single page.
//             </p>
//           </div>

//           <AnimatePresence>
//             {locked && (
//               <motion.div
//                 initial={{ scale: 0.9, opacity: 0 }}
//                 animate={{ scale: 1, opacity: 1 }}
//                 exit={{ scale: 0.9, opacity: 0 }}
//                 className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-2 rounded-full text-sm font-semibold"
//               >
//                 <Lock className="w-4 h-4" />
//                 Style Locked — Ready to Illustrate
//               </motion.div>
//             )}
//           </AnimatePresence>
//         </div>

//         <div className="grid lg:grid-cols-5 gap-6 items-start">

//           {/* ════════════════════════════════ */}
//           {/* LEFT PANEL                       */}
//           {/* ════════════════════════════════ */}
//           <div className="lg:col-span-2 space-y-4">

//             {/* ── Upload zone ── */}
//             <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
//               <div
//                 className={`relative group transition-all duration-200 ${dragOver ? "ring-2 ring-violet-400 ring-offset-2" : ""}`}
//                 onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
//                 onDragLeave={() => setDragOver(false)}
//                 onDrop={(e) => {
//                   e.preventDefault();
//                   setDragOver(false);
//                   const f = e.dataTransfer.files[0];
//                   if (f) onPickFile(f);
//                 }}
//               >
//                 {sampleIllustrationUrl ? (
//                   <div className="relative">
//                     <img
//                       src={sampleIllustrationUrl}
//                       className="w-full h-[230px] object-cover"
//                       alt="Style reference"
//                     />
//                     {!locked && (
//                       <button
//                         onClick={() => setSampleIllustrationUrl(null)}
//                         className="absolute top-3 right-3 w-8 h-8 bg-white/90 backdrop-blur rounded-full flex items-center justify-center shadow-md hover:bg-white transition-colors"
//                         title="Remove image"
//                       >
//                         <X className="w-4 h-4 text-gray-600" />
//                       </button>
//                     )}
//                     <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-black/40 to-transparent" />
//                     <div className="absolute bottom-3 left-4 text-white text-xs font-medium opacity-90">
//                       Style Reference
//                     </div>
//                   </div>
//                 ) : (
//                   <div
//                     className={`h-[230px] flex flex-col items-center justify-center cursor-pointer transition-all duration-200 ${
//                       dragOver
//                         ? "bg-violet-50"
//                         : "bg-gradient-to-br from-violet-50 via-pink-50 to-amber-50 hover:from-violet-100 hover:via-pink-100 hover:to-amber-100"
//                     }`}
//                     onClick={() => !locked && fileInputRef.current?.click()}
//                   >
//                     <div className="w-16 h-16 rounded-2xl bg-white shadow-sm flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
//                       <span className="text-3xl">{dragOver ? "✨" : "🖼️"}</span>
//                     </div>
//                     <p className="text-gray-700 font-semibold text-sm">Drop an image you love</p>
//                     <p className="text-gray-400 text-xs mt-1">or click to browse</p>
//                   </div>
//                 )}
//               </div>

//               <input
//                 ref={fileInputRef}
//                 type="file"
//                 hidden
//                 accept="image/*"
//                 onChange={(e) => e.target.files && onPickFile(e.target.files[0])}
//               />

//               <div className="p-4 space-y-3">
//                 <button
//                   onClick={() => !locked && fileInputRef.current?.click()}
//                   disabled={locked || isLoading}
//                   className="w-full relative overflow-hidden py-3 rounded-xl font-semibold text-sm text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
//                   style={{
//                     background: locked
//                       ? "#9ca3af"
//                       : "linear-gradient(135deg, #7c3aed 0%, #db2777 100%)",
//                   }}
//                 >
//                   <AnimatePresence mode="wait">
//                     {isLoading ? (
//                       <motion.span
//                         key="loading"
//                         initial={{ opacity: 0 }}
//                         animate={{ opacity: 1 }}
//                         exit={{ opacity: 0 }}
//                         className="flex items-center justify-center gap-2"
//                       >
//                         <Loader2 className="w-4 h-4 animate-spin" />
//                         {loadingLabel}
//                       </motion.span>
//                     ) : (
//                       <motion.span
//                         key="idle"
//                         initial={{ opacity: 0 }}
//                         animate={{ opacity: 1 }}
//                         exit={{ opacity: 0 }}
//                         className="flex items-center justify-center gap-2"
//                       >
//                         <Wand2 className="w-4 h-4" />
//                         {sampleIllustrationUrl ? "Analyse a New Image" : "Upload & Auto-Fill Style"}
//                       </motion.span>
//                     )}
//                   </AnimatePresence>
//                 </button>

//                 <p className="text-center text-xs text-gray-400 leading-relaxed">
//                   Our AI reads your image and fills in your style guide automatically.
//                 </p>
//               </div>
//             </div>

//             {/* ── Colour Palette card (shown after analysis) ── */}
//             <AnimatePresence>
//               {colorPalette && (colorPalette.hex?.length ?? 0) > 0 && (
//                 <motion.div
//                   initial={{ opacity: 0, y: 8 }}
//                   animate={{ opacity: 1, y: 0 }}
//                   exit={{ opacity: 0, y: 8 }}
//                   className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5"
//                 >
//                   <div className="flex items-center gap-2 mb-3">
//                     <span className="text-violet-500"><Palette className="w-4 h-4" /></span>
//                     <span className="font-semibold text-gray-800 text-sm">Colour Palette</span>
//                   </div>

//                   {/* Editable swatches */}
//                   <div className="flex gap-2 mb-2">
//                     {(colorPalette.hex ?? []).slice(0, 3).map((hex, i) => (
//                       <div key={i} className="flex-1 relative">
//                         <div
//                           className="h-10 rounded-lg shadow-sm border border-black/5 cursor-pointer hover:ring-2 hover:ring-violet-300 transition-all"
//                           style={{ backgroundColor: hex }}
//                           title={`Click to change: ${hex}`}
//                         />
//                         <input
//                           type="color"
//                           value={hex}
//                           disabled={locked}
//                           onChange={(e) => {
//                             const newHex = [...(colorPalette.hex ?? [])];
//                             newHex[i] = e.target.value;
//                             setColorPalette({ ...colorPalette, hex: newHex });
//                           }}
//                           className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
//                         />
//                       </div>
//                     ))}
//                   </div>

//                   {/* Editable labels */}
//                   <div className="flex gap-2 text-xs mb-3">
//                     <input
//                       type="text"
//                       value={colorPalette.primary}
//                       disabled={locked}
//                       onChange={(e) => setColorPalette({ ...colorPalette, primary: e.target.value })}
//                       className="flex-1 bg-transparent text-gray-500 placeholder-gray-300 focus:outline-none focus:text-gray-700 truncate disabled:cursor-not-allowed"
//                       placeholder="Primary"
//                     />
//                     <input
//                       type="text"
//                       value={colorPalette.secondary}
//                       disabled={locked}
//                       onChange={(e) => setColorPalette({ ...colorPalette, secondary: e.target.value })}
//                       className="flex-1 bg-transparent text-gray-500 placeholder-gray-300 focus:outline-none focus:text-gray-700 truncate disabled:cursor-not-allowed"
//                       placeholder="Secondary"
//                     />
//                     <input
//                       type="text"
//                       value={colorPalette.accent}
//                       disabled={locked}
//                       onChange={(e) => setColorPalette({ ...colorPalette, accent: e.target.value })}
//                       className="flex-1 bg-transparent text-gray-500 placeholder-gray-300 focus:outline-none focus:text-gray-700 truncate disabled:cursor-not-allowed"
//                       placeholder="Accent"
//                     />
//                   </div>

//                   {/* Editable mood */}
//                   <div className="inline-flex items-center gap-1.5 bg-violet-50 text-violet-600 text-xs font-medium px-3 py-1.5 rounded-full">
//                     <Sparkles className="w-3 h-3" />
//                     Feels{" "}
//                     <input
//                       type="text"
//                       value={colorPalette.mood}
//                       disabled={locked}
//                       onChange={(e) => setColorPalette({ ...colorPalette, mood: e.target.value })}
//                       className="bg-transparent text-violet-600 focus:outline-none w-24 disabled:cursor-not-allowed"
//                       placeholder="mood"
//                     />
//                   </div>
//                 </motion.div>
//               )}
//             </AnimatePresence>

//             {/* ── Quick Mood Tunes ── */}
//             <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
//               <button
//                 onClick={() => setShowQuickTunes((v) => !v)}
//                 className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
//               >
//                 <div className="flex items-center gap-2">
//                   <span className="text-lg">⚡</span>
//                   <span className="font-semibold text-gray-800 text-sm">Quick Mood Tunes</span>
//                 </div>
//                 <ChevronDown
//                   className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${
//                     showQuickTunes ? "rotate-180" : ""
//                   }`}
//                 />
//               </button>

//               <AnimatePresence>
//                 {showQuickTunes && (
//                   <motion.div
//                     initial={{ height: 0, opacity: 0 }}
//                     animate={{ height: "auto", opacity: 1 }}
//                     exit={{ height: 0, opacity: 0 }}
//                     transition={{ duration: 0.2 }}
//                     className="overflow-hidden"
//                   >
//                     <div className="px-4 pb-4 grid grid-cols-2 gap-2">
//                       {QUICK_TUNES.map((t) => (
//                         <button
//                           key={t.label}
//                           disabled={locked}
//                           onClick={() =>
//                             setSummary((prev) =>
//                               prev ? `${prev}\n\n${t.prompt}` : t.prompt
//                             )
//                           }
//                           className="text-left p-3 rounded-xl border border-gray-100 hover:border-violet-300 hover:bg-violet-50 transition-all disabled:opacity-40 disabled:cursor-not-allowed group"
//                         >
//                           <span className="text-lg block mb-1">{t.icon}</span>
//                           <span className="text-xs font-semibold text-gray-700 group-hover:text-violet-700">
//                             {t.label}
//                           </span>
//                         </button>
//                       ))}
//                     </div>
//                   </motion.div>
//                 )}
//               </AnimatePresence>
//             </div>

//             {/* ── Lock / Save ── */}
//             <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-3">
//               <button
//                 onClick={() => toggleLock(!locked)}
//                 disabled={false}
//                 className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
//                   locked
//                     ? "bg-amber-50 text-amber-700 border-2 border-amber-200 hover:bg-amber-100"
//                     : "text-white"
//                 }`}
//                 style={
//                   !locked
//                     ? { background: "linear-gradient(135deg, #10b981 0%, #059669 100%)" }
//                     : {}
//                 }
//               >
//                 {locked ? (
//                   <><Unlock className="w-4 h-4" /> Unlock & Edit Style</>
//                 ) : (
//                   <><Lock className="w-4 h-4" /> Lock Style — I'm Happy!</>
//                 )}
//               </button>

//               {!locked && (
//                 <button
//                   onClick={() => saveGuide()}
//                   disabled={!dirty || saving}
//                   className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm border-2 border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
//                 >
//                   <AnimatePresence mode="wait">
//                     {saveSuccess ? (
//                       <motion.span
//                         key="ok"
//                         initial={{ scale: 0.8 }}
//                         animate={{ scale: 1 }}
//                         className="flex items-center gap-2 text-emerald-600"
//                       >
//                         <CheckCircle className="w-4 h-4" /> Saved!
//                       </motion.span>
//                     ) : saving ? (
//                       <motion.span key="saving" className="flex items-center gap-2">
//                         <Loader2 className="w-4 h-4 animate-spin" /> Saving…
//                       </motion.span>
//                     ) : (
//                       <motion.span key="idle" className="flex items-center gap-2">
//                         <Save className="w-4 h-4" /> Save Progress
//                       </motion.span>
//                     )}
//                   </AnimatePresence>
//                 </button>
//               )}

//               <p className={`text-center text-xs leading-relaxed font-medium ${
//                 locked ? "text-emerald-600" : "text-gray-400"
//               }`}>
//                 {locked
//                   ? "✅ Your style is locked and ready. Every illustration will follow this guide."
//                   : "Lock your style when you're happy — this keeps every illustration consistent throughout your book."}
//               </p>
//             </div>
//           </div>

//           {/* ════════════════════════════════ */}
//           {/* RIGHT PANEL                      */}
//           {/* ════════════════════════════════ */}
//           <div className="lg:col-span-3 space-y-4">

//             {/* Tip banner */}
//             <div className="flex items-start gap-3 bg-violet-50 border border-violet-100 rounded-xl px-4 py-3">
//               <Sparkles className="w-4 h-4 text-violet-500 flex-shrink-0 mt-0.5" />
//               <p className="text-violet-700 text-sm leading-relaxed">
//                 <strong>Pro tip:</strong> The more vivid and specific your Style Vision, the more magical and consistent your illustrations will be. Think of this as your art director's brief — paint us a picture with your words.
//               </p>
//             </div>

//             {/* Fields — user-facing only */}
//             {FIELDS.map((field, i) => (
//               <motion.div
//                 key={field.key}
//                 initial={{ opacity: 0, y: 12 }}
//                 animate={{ opacity: 1, y: 0 }}
//                 transition={{ delay: i * 0.05 }}
//                 className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
//               >
//                 <div className="flex items-center justify-between px-5 pt-4 pb-2">
//                   <div className="flex items-center gap-2">
//                     <span className="text-violet-500">{field.icon}</span>
//                     <label className="font-semibold text-gray-800 text-sm">
//                       {field.label}
//                     </label>
//                   </div>
//                   <button
//                     onClick={() =>
//                       setActiveHint(activeHint === field.key ? null : field.key)
//                     }
//                     className="text-gray-300 hover:text-gray-500 transition-colors"
//                   >
//                     <Info className="w-4 h-4" />
//                   </button>
//                 </div>

//                 <AnimatePresence>
//                   {activeHint === field.key && (
//                     <motion.div
//                       initial={{ height: 0, opacity: 0 }}
//                       animate={{ height: "auto", opacity: 1 }}
//                       exit={{ height: 0, opacity: 0 }}
//                       className="overflow-hidden"
//                     >
//                       <p className="mx-5 mb-2 text-xs text-violet-600 bg-violet-50 rounded-lg px-3 py-2 leading-relaxed">
//                         {field.hint}
//                       </p>
//                     </motion.div>
//                   )}
//                 </AnimatePresence>

//                 <textarea
//                   value={values[field.key]}
//                   onChange={(e) => setters[field.key](e.target.value)}
//                   disabled={locked}
//                   placeholder={field.placeholder}
//                   className={`w-full px-5 pb-4 text-sm text-gray-700 placeholder-gray-300 bg-transparent resize-none focus:outline-none leading-relaxed ${field.minH} disabled:opacity-60 disabled:cursor-not-allowed`}
//                 />
//               </motion.div>
//             ))}
//           </div>
//         </div>
//       </main>
//     </>
//   );
// }


// src/app/stories/[id]/illustration-style/IllustrationStyleClient.tsx
//
// Redesigned: the AI has already generated a style guide from the story.
// The user lands on a clean page that says "here's what we suggest" with
// a single big "Looks great" button. Only if they want to customise do
// they expand into the detail fields or upload a reference image.

"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check,
  ChevronDown,
  ImageIcon,
  Loader2,
  Paintbrush,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import UnifiedStoryHeader from "@/app/stories/components/StoryHeader";
import { getNextStepHref, type StepKey } from "@/lib/storySteps";

/* ─────────────── Types ─────────────── */

type StyleGuide = {
  id?: string;
  userNotes: string | null;
  artStyle: string | null;
  colorPalette: {
    primary?: string;
    secondary?: string;
    accent?: string;
    mood?: string;
  } | null;
  negativePrompt: string | null;
  typography: string | null;
  sampleIllustrationUrl: string | null;
};

/* ─────────────── Font ─────────────── */

function FontLoader() {
  return (
    <link
      href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,300;12..96,400;12..96,600;12..96,700;12..96,800&display=swap"
      rel="stylesheet"
    />
  );
}

/* ─────────────── Main ─────────────── */

export default function IllustrationStyleClient({
  storyId,
  title,
  currentStep = "design",
  completedSteps = [],
  initialStyleGuide,
}: {
  storyId: string;
  title: string;
  currentStep?: StepKey;
  completedSteps?: StepKey[];
  initialStyleGuide: StyleGuide | null;
}) {
  const router = useRouter();

  const [style, setStyle] = useState<StyleGuide | null>(initialStyleGuide);
  const [isLoading, setIsLoading] = useState(!initialStyleGuide);
  const [isSaving, setIsSaving] = useState(false);
  const [showCustomise, setShowCustomise] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Editable fields (only used if user opens customise)
  const [editVision, setEditVision] = useState("");
  const [editArtStyle, setEditArtStyle] = useState("");
  const [editNegative, setEditNegative] = useState("");
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load style guide if not passed as prop
  useEffect(() => {
    if (initialStyleGuide) return;
    let cancelled = false;

    const poll = async () => {
      for (let i = 0; i < 20; i++) {
        try {
          const res = await fetch(`/api/stories/${storyId}/style-guide`, {
            cache: "no-store",
          });
          if (res.ok) {
            const data = await res.json();
            if (data && (data.userNotes || data.artStyle)) {
              if (!cancelled) {
                setStyle(data);
                setIsLoading(false);
              }
              return;
            }
          }
        } catch {}
        await new Promise((r) => setTimeout(r, 2000));
      }
      if (!cancelled) setIsLoading(false);
    };

    poll();
    return () => { cancelled = true; };
  }, [storyId, initialStyleGuide]);

  // Sync edit fields when style loads
  useEffect(() => {
    if (!style) return;
    setEditVision(style.userNotes ?? "");
    setEditArtStyle(style.artStyle ?? "");
    setEditNegative(style.negativePrompt ?? "");
    setPreviewImageUrl(style.sampleIllustrationUrl ?? null);
  }, [style]);

  // Build the summary sentence the user sees
  const styleSummary = style
    ? [style.userNotes, style.artStyle].filter(Boolean).join(" — ")
    : "";

  const paletteColors = style?.colorPalette
    ? [style.colorPalette.primary, style.colorPalette.secondary, style.colorPalette.accent].filter(Boolean)
    : [];

  /* ── Actions ── */

  const handleAcceptAndContinue = async () => {
    setIsSaving(true);
    try {
      // If user customised, save their edits first
      if (showCustomise) {
        await fetch(`/api/stories/${storyId}/style-guide`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userNotes: editVision,
            artStyle: editArtStyle,
            negativePrompt: editNegative,
            sampleIllustrationUrl: previewImageUrl,
          }),
        });
      }

      // Mark step complete
      await fetch(`/api/stories/${storyId}/complete-step`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: "design" }),
      }).catch(() => {});

      // Navigate to next step
      const storyRes = await fetch(`/api/stories/${storyId}`, { cache: "no-store" });
      if (storyRes.ok) {
        const storyData = await storyRes.json();
        const story = storyData.story ?? storyData;
        router.push(getNextStepHref(storyId, story));
      } else {
        router.push(`/stories/${storyId}/characters`);
      }
    } catch {
      alert("Failed to save style. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleImageUpload = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) return;
    setUploadingImage(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`/api/stories/${storyId}/style-guide/upload-reference`, {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        setPreviewImageUrl(data.url ?? data.imageUrl ?? null);

        // If the API returns auto-filled style fields, use them
        if (data.userNotes) setEditVision(data.userNotes);
        if (data.artStyle) setEditArtStyle(data.artStyle);
      }
    } catch {
      console.error("Upload failed");
    } finally {
      setUploadingImage(false);
    }
  }, [storyId]);

  /* ── Render ── */

  return (
    <>
      <FontLoader />

      <div
        className="min-h-screen relative"
        style={{ fontFamily: "'Bricolage Grotesque', system-ui, sans-serif" }}
      >
        {/* Background */}
        <div
          className="fixed inset-0 -z-10"
          style={{
            background: `
              radial-gradient(ellipse 80% 60% at 20% 10%, rgba(232,190,255,0.3) 0%, transparent 60%),
              radial-gradient(ellipse 70% 50% at 85% 80%, rgba(255,182,210,0.25) 0%, transparent 55%),
              #F9F5FF
            `,
          }}
        >
          <div
            className="absolute inset-0 opacity-50"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23c4b5d4' fill-opacity='0.04'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            }}
          />
        </div>

        {/* Header */}
        <UnifiedStoryHeader
          storyId={storyId}
          title={title}
          currentStep={currentStep}
          completedSteps={completedSteps}
        />

        {/* Content */}
        <div className="max-w-xl mx-auto px-4 sm:px-6 py-10 pb-32">
          {isLoading ? (
            /* ── Loading state ── */
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-20 text-center"
            >
              <div
                className="w-16 h-16 rounded-[22px] flex items-center justify-center mb-5"
                style={{ background: "linear-gradient(135deg, #E8D5FF, #FFD5E5)" }}
              >
                <Loader2
                  className="w-7 h-7 animate-spin"
                  style={{ color: "#B05CE6" }}
                />
              </div>
              <h2
                className="text-xl font-extrabold"
                style={{ color: "#2D2235" }}
              >
                Creating your style guide…
              </h2>
              <p className="text-sm mt-2" style={{ color: "#7B6E90" }}>
                Reading the story and choosing an illustration style to match.
              </p>
            </motion.div>
          ) : !style ? (
            /* ── No style found ── */
            <div className="text-center py-20">
              <p className="text-sm" style={{ color: "#7B6E90" }}>
                No style guide found. Please go back and try again.
              </p>
            </div>
          ) : (
            /* ── Main content ── */
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="space-y-6"
            >
              {/* Hero card */}
              <div
                className="rounded-[22px] border overflow-hidden"
                style={{
                  background: "white",
                  borderColor: "rgba(180,150,210,0.12)",
                  boxShadow:
                    "0 2px 8px rgba(100,60,140,0.05), 0 12px 40px rgba(100,60,140,0.07)",
                }}
              >
                {/* Header */}
                <div
                  className="px-6 py-5 flex items-start gap-4"
                  style={{ borderBottom: "1px solid rgba(180,150,210,0.08)" }}
                >
                  <div
                    className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0"
                    style={{
                      background: "linear-gradient(135deg, #E8D5FF, #FFD5E5)",
                    }}
                  >
                    <Paintbrush className="w-5 h-5" style={{ color: "#B05CE6" }} />
                  </div>
                  <div>
                    <h2
                      className="text-lg font-extrabold"
                      style={{ color: "#2D2235" }}
                    >
                      Your illustration style
                    </h2>
                    <p className="text-sm mt-1 leading-relaxed" style={{ color: "#7B6E90" }}>
                      We picked this based on your story. If it feels right, just continue.
                    </p>
                  </div>
                </div>

                {/* Style summary */}
                <div className="px-6 py-5">
                  {/* Reference image if exists */}
                  {previewImageUrl && (
                    <div className="mb-4 rounded-xl overflow-hidden bg-gray-50 border border-gray-100">
                      <img
                        src={previewImageUrl}
                        alt="Style reference"
                        className="w-full h-44 object-cover"
                      />
                    </div>
                  )}

                  {/* Vision text */}
                  <p
                    className="text-[15px] leading-[1.7]"
                    style={{ color: "#3A2E48" }}
                  >
                    {styleSummary || "A warm, whimsical children's book illustration style."}
                  </p>

                  {/* Colour palette chips */}
                  {paletteColors.length > 0 && (
                    <div className="flex items-center gap-2 mt-4">
                      <span
                        className="text-[11px] font-bold uppercase tracking-wide"
                        style={{ color: "#A897BD" }}
                      >
                        Palette
                      </span>
                      <div className="flex gap-1.5">
                        {paletteColors.map((color, i) => (
                          <div
                            key={i}
                            className="w-6 h-6 rounded-lg border"
                            style={{
                              background: color,
                              borderColor: "rgba(0,0,0,0.08)",
                            }}
                            title={color ?? undefined}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Mood tag */}
                  {style.colorPalette?.mood && (
                    <div className="mt-3">
                      <span
                        className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full"
                        style={{
                          background: "rgba(176,92,230,0.08)",
                          color: "#8B5CB8",
                        }}
                      >
                        <Sparkles className="w-3 h-3" />
                        {style.colorPalette.mood}
                      </span>
                    </div>
                  )}
                </div>

                {/* Primary action */}
                <div className="px-6 pb-6 space-y-3">
                  <button
                    onClick={handleAcceptAndContinue}
                    disabled={isSaving}
                    className="w-full py-4 rounded-[14px] text-sm font-bold text-white flex items-center justify-center gap-2 transition-all hover:-translate-y-px active:scale-[0.98] disabled:opacity-60 relative overflow-hidden"
                    style={{
                      background: "linear-gradient(135deg, #B05CE6, #D45DA0)",
                      boxShadow: "0 4px 16px rgba(176,92,230,0.25)",
                      border: "none",
                    }}
                  >
                    <div
                      className="absolute inset-0 rounded-[inherit]"
                      style={{
                        background:
                          "linear-gradient(135deg, rgba(255,255,255,0.15), transparent)",
                      }}
                    />
                    {isSaving ? (
                      <Loader2 className="w-4 h-4 animate-spin relative z-10" />
                    ) : (
                      <Check className="w-4 h-4 relative z-10" />
                    )}
                    <span className="relative z-10">
                      {isSaving ? "Saving…" : "Looks great — continue"}
                    </span>
                  </button>

                  <button
                    onClick={() => setShowCustomise((v) => !v)}
                    className="w-full py-3 rounded-[14px] text-sm font-semibold flex items-center justify-center gap-2 transition-all"
                    style={{
                      background: "transparent",
                      color: "#7B6E90",
                      border: "1px solid rgba(180,150,210,0.2)",
                    }}
                  >
                    <ChevronDown
                      className="w-4 h-4 transition-transform"
                      style={{
                        transform: showCustomise ? "rotate(180deg)" : "none",
                      }}
                    />
                    {showCustomise ? "Hide options" : "I want to customise"}
                  </button>
                </div>
              </div>

              {/* Customise panel — only shown if user asks for it */}
              <AnimatePresence>
                {showCustomise && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3 }}
                    className="overflow-hidden"
                  >
                    <div
                      className="rounded-[22px] border overflow-hidden"
                      style={{
                        background: "white",
                        borderColor: "rgba(180,150,210,0.12)",
                        boxShadow: "0 2px 8px rgba(100,60,140,0.05)",
                      }}
                    >
                      <div
                        className="px-6 py-4 border-b"
                        style={{ borderColor: "rgba(180,150,210,0.08)" }}
                      >
                        <h3
                          className="text-sm font-bold"
                          style={{ color: "#2D2235" }}
                        >
                          Make it yours
                        </h3>
                        <p
                          className="text-xs mt-0.5"
                          style={{ color: "#A897BD" }}
                        >
                          Edit the style description or upload a reference image.
                        </p>
                      </div>

                      <div className="px-6 py-5 space-y-5">
                        {/* Style Vision */}
                        <div>
                          <label
                            className="text-[11px] font-bold uppercase tracking-wide block mb-2"
                            style={{ color: "#6B5C80" }}
                          >
                            Style vision
                          </label>
                          <textarea
                            value={editVision}
                            onChange={(e) => setEditVision(e.target.value)}
                            rows={3}
                            className="w-full rounded-xl border px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 transition-all"
                            style={{
                              borderColor: "rgba(180,150,210,0.18)",
                              background: "#FDFBFF",
                              color: "#2D2235",
                              fontFamily: "inherit",
                              // @ts-ignore
                              "--tw-ring-color": "rgba(199,125,255,0.2)",
                            }}
                            placeholder="Describe the look and feel you're imagining…"
                          />
                        </div>

                        {/* Art Style */}
                        <div>
                          <label
                            className="text-[11px] font-bold uppercase tracking-wide block mb-2"
                            style={{ color: "#6B5C80" }}
                          >
                            Art style
                          </label>
                          <textarea
                            value={editArtStyle}
                            onChange={(e) => setEditArtStyle(e.target.value)}
                            rows={2}
                            className="w-full rounded-xl border px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 transition-all"
                            style={{
                              borderColor: "rgba(180,150,210,0.18)",
                              background: "#FDFBFF",
                              color: "#2D2235",
                              fontFamily: "inherit",
                              // @ts-ignore
                              "--tw-ring-color": "rgba(199,125,255,0.2)",
                            }}
                            placeholder="e.g. Watercolour, digital cartoon, pencil sketch…"
                          />
                        </div>

                        {/* Reference image upload */}
                        <div>
                          <label
                            className="text-[11px] font-bold uppercase tracking-wide block mb-2"
                            style={{ color: "#6B5C80" }}
                          >
                            Reference image (optional)
                          </label>

                          {previewImageUrl ? (
                            <div className="relative rounded-xl overflow-hidden bg-gray-50 border border-gray-100">
                              <img
                                src={previewImageUrl}
                                alt="Style reference"
                                className="w-full h-36 object-cover"
                              />
                              <button
                                onClick={() => setPreviewImageUrl(null)}
                                className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => fileInputRef.current?.click()}
                              disabled={uploadingImage}
                              className="w-full py-8 rounded-xl border-2 border-dashed flex flex-col items-center gap-2 transition-all hover:border-purple-300 hover:bg-purple-50/30"
                              style={{
                                borderColor: "rgba(180,150,210,0.25)",
                                background: "rgba(200,180,220,0.04)",
                                color: "#8B7BA0",
                              }}
                            >
                              {uploadingImage ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                              ) : (
                                <Upload className="w-5 h-5" />
                              )}
                              <span className="text-xs font-semibold">
                                {uploadingImage
                                  ? "Uploading…"
                                  : "Drop an image or tap to browse"}
                              </span>
                            </button>
                          )}

                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleImageUpload(file);
                              e.target.value = "";
                            }}
                          />
                        </div>

                        {/* What to avoid */}
                        <div>
                          <label
                            className="text-[11px] font-bold uppercase tracking-wide block mb-2"
                            style={{ color: "#6B5C80" }}
                          >
                            What to avoid
                          </label>
                          <input
                            value={editNegative}
                            onChange={(e) => setEditNegative(e.target.value)}
                            className="w-full rounded-xl border px-4 py-3 text-sm focus:outline-none focus:ring-2 transition-all"
                            style={{
                              borderColor: "rgba(180,150,210,0.18)",
                              background: "#FDFBFF",
                              color: "#2D2235",
                              fontFamily: "inherit",
                              // @ts-ignore
                              "--tw-ring-color": "rgba(199,125,255,0.2)",
                            }}
                            placeholder="e.g. Photorealism, scary imagery, dark themes…"
                          />
                        </div>
                      </div>

                      {/* Save from customise panel */}
                      <div className="px-6 pb-6">
                        <button
                          onClick={handleAcceptAndContinue}
                          disabled={isSaving}
                          className="w-full py-4 rounded-[14px] text-sm font-bold text-white flex items-center justify-center gap-2 transition-all hover:-translate-y-px active:scale-[0.98] disabled:opacity-60"
                          style={{
                            background:
                              "linear-gradient(135deg, #B05CE6, #D45DA0)",
                            boxShadow: "0 4px 16px rgba(176,92,230,0.25)",
                            border: "none",
                          }}
                        >
                          {isSaving ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Check className="w-4 h-4" />
                          )}
                          {isSaving ? "Saving…" : "Save & continue"}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </div>
      </div>
    </>
  );
}