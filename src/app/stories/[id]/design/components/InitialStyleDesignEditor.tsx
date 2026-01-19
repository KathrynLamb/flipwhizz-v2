"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Wand2,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Image as ImageIcon,
  Loader2,
  Upload,
  X,
  BookOpen,
  Users,
  MapPin,
  Palette,
  Camera,
  Check,
  Edit3,
  CreditCard,
  ArrowRight,
} from "lucide-react";
import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";

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
  const [promptDraft, setPromptDraft] = useState(style.summary ?? "");
  const [styleRefUrl, setStyleRefUrl] = useState(style.styleGuideImage);
  const [isEditingPrompt, setIsEditingPrompt] = useState(false);
  const [isUploadingStyle, setIsUploadingStyle] = useState(false);

  const [isGeneratingSample, setIsGeneratingSample] = useState(false);
  const [sampleUrl, setSampleUrl] = useState(
    style.sampleIllustrationUrl || sampleImage || null
  );
  const [generationProgress, setGenerationProgress] = useState("");
  const [showPayment, setShowPayment] = useState(false);

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
      if (isEditingPrompt) return;
      if (e.key === "ArrowLeft") setSpreadIndex((i) => Math.max(0, i - 1));
      if (e.key === "ArrowRight")
        setSpreadIndex((i) => Math.min(spreads.length - 1, i + 1));
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [spreads.length, isEditingPrompt]);

  // HARD GUARD
  if (!Array.isArray(spreads) || spreads.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-orange-50 via-pink-50 to-purple-50 gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-purple-600" />
        <p className="font-semibold text-purple-900">Preparing storyboard...</p>
      </div>
    );
  }

  const spread = spreads[spreadIndex];

  if (!spread) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 via-pink-50 to-purple-50">
        <p className="text-purple-700">Loading spread...</p>
      </div>
    );
  }

  /* ======================================================
     ACTIONS
  ====================================================== */

  const savePrompt = useCallback(async () => {
    await fetch("/api/style-guide/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        storyId: style.storyId,
        summary: promptDraft,
      }),
    });
    setPrompt(promptDraft);
    setIsEditingPrompt(false);
  }, [promptDraft, style.storyId]);

  const uploadStyleReference = useCallback(
    async (file: File) => {
      setIsUploadingStyle(true);
      try {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("storyId", style.storyId);

        const res = await fetch("/api/uploads/reference", {
          method: "POST",
          body: fd,
        });

        const data = await res.json();
        if (!res.ok) throw new Error();

        setStyleRefUrl(data.url);

        await fetch("/api/style-guide/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            storyId: style.storyId,
            styleGuideImage: data.url,
          }),
        });
      } catch {
        alert("Failed to upload reference image");
      } finally {
        setIsUploadingStyle(false);
      }
    },
    [style.storyId]
  );

  const generateSample = useCallback(async () => {
    setIsGeneratingSample(true);
    setSampleUrl(null);
    setGenerationProgress("Starting up...");

    const locationRefs = spread.locations
      .filter((l) => l.referenceImageUrl)
      .map((l) => ({
        type: "location",
        label: l.name,
        mode: "image",
        url: l.referenceImageUrl!,
      }));

    const characterRefs = buildCharacterReferences(spread.characters);

    const references = [...locationRefs, ...characterRefs];

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

      if (ticks === 3) setGenerationProgress("Sketching the scene...");
      if (ticks === 6) setGenerationProgress("Adding colors...");
      if (ticks === 12) setGenerationProgress("Drawing details...");
      if (ticks === 18) setGenerationProgress("Almost done...");

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
        alert("Generation timed out. Please try again.");
      }
    }, 2000);
  }, [spread, style.storyId, prompt]);

  /* ======================================================
     UI
  ====================================================== */

  const totalRefs =
    (styleRefUrl ? 1 : 0) +
    spread.characters.filter((c) => c.referenceImageUrl).length +
    spread.locations.filter((l) => l.referenceImageUrl).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-pink-50 to-purple-50">
      {/* HEADER */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-purple-100 shadow-sm">
        <div className="max-w-[1600px] mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-orange-400 to-purple-500 blur-lg opacity-40 rounded-2xl" />
              <div className="relative h-12 w-12 bg-gradient-to-br from-orange-400 via-pink-400 to-purple-500 rounded-2xl flex items-center justify-center shadow-xl">
                <Palette className="w-6 h-6 text-white" />
              </div>
            </div>
            <div>
              <h1 className="text-xl font-bold text-purple-900">Style Designer</h1>
              <p className="text-xs font-medium text-purple-600 uppercase tracking-wide">
                Visual Concept Studio
              </p>
            </div>
          </div>

          {/* SPREAD NAVIGATOR */}
          <div className="flex items-center gap-3">
            <button
              disabled={spreadIndex === 0}
              onClick={() => setSpreadIndex((i) => i - 1)}
              className="p-2.5 rounded-xl bg-white hover:bg-purple-50 disabled:opacity-30 disabled:hover:bg-white transition-all border border-purple-200 shadow-sm disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-5 h-5 text-purple-700" />
            </button>

            <div className="px-5 py-2.5 rounded-xl bg-white border border-purple-200 shadow-sm">
              <div className="text-sm font-bold text-purple-900">
                {spreadIndex + 1}{" "}
                <span className="text-purple-400">/ {spreads.length}</span>
              </div>
              <div className="text-[10px] text-purple-600 uppercase tracking-wider">
                Spread
              </div>
            </div>

            <button
              disabled={spreadIndex === spreads.length - 1}
              onClick={() => setSpreadIndex((i) => i + 1)}
              className="p-2.5 rounded-xl bg-white hover:bg-purple-50 disabled:opacity-30 disabled:hover:bg-white transition-all border border-purple-200 shadow-sm disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-5 h-5 text-purple-700" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto p-6 lg:p-10">
        <div className="grid lg:grid-cols-[1fr_550px] gap-10 items-start">
          {/* LEFT: CONTROLS */}
          <div className="space-y-8">
            {/* STORY SPREAD */}
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <div className="flex items-center gap-3 mb-5">
                <div className="p-2 rounded-lg bg-gradient-to-br from-blue-400 to-blue-600">
                  <BookOpen className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-lg font-bold text-purple-900">Story Spread</h2>
              </div>

              <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-orange-200 via-pink-200 to-purple-200 rounded-[2rem] blur opacity-25 group-hover:opacity-40 transition duration-500" />

                <div className="relative bg-white rounded-[2rem] shadow-xl border border-purple-100 overflow-hidden">
                  {/* BOOK SPINE */}
                  <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-purple-200 to-transparent" />
                  <div className="absolute left-1/2 -ml-8 top-0 bottom-0 w-16 bg-gradient-to-r from-transparent via-purple-50/50 to-transparent pointer-events-none" />

                  <div className="grid grid-cols-2">
                    {/* LEFT PAGE */}
                    <div className="relative p-10 min-h-[280px] flex flex-col justify-center">
                      <div className="absolute top-6 left-10 text-[10px] font-bold text-purple-300 uppercase tracking-widest">
                        Page {spreadIndex * 2 + 1}
                      </div>
                      <AnimatePresence mode="wait">
                        <motion.div
                          key={spreadIndex + "L"}
                          initial={{ opacity: 0, x: -15 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 15 }}
                          transition={{ duration: 0.3 }}
                          className="font-serif text-lg leading-relaxed text-purple-900"
                        >
                          {spread.leftText || (
                            <span className="text-purple-300 italic">Empty page</span>
                          )}
                        </motion.div>
                      </AnimatePresence>
                    </div>

                    {/* RIGHT PAGE */}
                    <div className="relative p-10 min-h-[280px] flex flex-col justify-center border-l border-purple-50">
                      <div className="absolute top-6 right-10 text-[10px] font-bold text-purple-300 uppercase tracking-widest">
                        Page {spreadIndex * 2 + 2}
                      </div>
                      <AnimatePresence mode="wait">
                        <motion.div
                          key={spreadIndex + "R"}
                          initial={{ opacity: 0, x: 15 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -15 }}
                          transition={{ duration: 0.3 }}
                          className="font-serif text-lg leading-relaxed text-purple-900"
                        >
                          {spread.rightText || (
                            <span className="text-purple-300 italic">Empty page</span>
                          )}
                        </motion.div>
                      </AnimatePresence>
                    </div>
                  </div>

                  {spread.sceneSummary && (
                    <div className="px-8 py-4 bg-purple-50/50 border-t border-purple-100">
                      <p className="text-sm text-purple-700 italic">
                        &ldquo;{spread.sceneSummary}&rdquo;
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </motion.section>

            {/* STYLE PROMPT */}
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              <div className="flex items-center gap-3 mb-5">
                <div className="p-2 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-lg font-bold text-purple-900">Art Direction</h2>
              </div>

              <div className="bg-white rounded-2xl shadow-lg border border-purple-100 p-6">
                {!isEditingPrompt ? (
                  <>
                    <p className="text-purple-800 leading-relaxed mb-4">
                      {prompt || (
                        <span className="text-purple-400 italic">
                          No style defined yet...
                        </span>
                      )}
                    </p>
                    <button
                      onClick={() => {
                        setIsEditingPrompt(true);
                        setPromptDraft(prompt);
                      }}
                      className="inline-flex items-center gap-2 text-sm font-semibold text-purple-600 hover:text-purple-700 transition-colors"
                    >
                      <Edit3 className="w-4 h-4" />
                      Edit prompt
                    </button>
                  </>
                ) : (
                  <>
                    <textarea
                      value={promptDraft}
                      onChange={(e) => setPromptDraft(e.target.value)}
                      className="w-full h-32 bg-purple-50/50 border border-purple-200 rounded-xl p-4 text-purple-900 placeholder:text-purple-400 focus:border-purple-400 focus:ring-2 focus:ring-purple-200 outline-none transition-all resize-none"
                      placeholder="Describe your visual style..."
                      autoFocus
                    />
                    <div className="flex justify-end gap-3 mt-4">
                      <button
                        onClick={() => {
                          setIsEditingPrompt(false);
                          setPromptDraft(prompt);
                        }}
                        className="px-4 py-2 rounded-lg text-sm font-semibold text-purple-600 hover:bg-purple-50 transition-all"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={savePrompt}
                        className="px-5 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold text-sm shadow-lg shadow-purple-200 hover:shadow-purple-300 transition-all flex items-center gap-2"
                      >
                        <Check className="w-4 h-4" />
                        Save
                      </button>
                    </div>
                  </>
                )}
              </div>
            </motion.section>

            {/* STYLE REFERENCE UPLOAD */}
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <div className="flex items-center gap-3 mb-5">
                <div className="p-2 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-500">
                  <Camera className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-lg font-bold text-purple-900">Style Reference</h2>
                <span className="text-xs text-purple-500 font-medium uppercase tracking-wider">
                  Optional
                </span>
              </div>

              <div className="bg-white rounded-2xl shadow-lg border border-purple-100 p-6">
                {styleRefUrl ? (
                  <div className="relative">
                    <img
                      src={styleRefUrl}
                      alt="Style reference"
                      className="w-full h-48 object-cover rounded-xl border border-purple-100 shadow-md"
                    />
                    <button
                      onClick={() => setStyleRefUrl(null)}
                      className="absolute top-3 right-3 p-2 bg-white/90 backdrop-blur-sm rounded-lg border border-purple-100 hover:bg-red-50 hover:border-red-300 transition-all shadow-lg"
                    >
                      <X className="w-4 h-4 text-purple-600 hover:text-red-600" />
                    </button>
                    <p className="text-xs text-purple-600 mt-3">
                      ✨ AI will match this artistic style
                    </p>
                  </div>
                ) : (
                  <label className="block cursor-pointer">
                    <div className="flex flex-col items-center justify-center h-48 border-2 border-dashed border-purple-200 rounded-xl hover:border-emerald-400 hover:bg-emerald-50/30 transition-all">
                      {isUploadingStyle ? (
                        <>
                          <Loader2 className="w-8 h-8 text-emerald-500 animate-spin mb-3" />
                          <p className="text-sm text-purple-700">Uploading...</p>
                        </>
                      ) : (
                        <>
                          <Upload className="w-8 h-8 text-purple-400 mb-3" />
                          <p className="text-sm font-semibold text-purple-900 mb-1">
                            Upload style reference
                          </p>
                          <p className="text-xs text-purple-500">
                            Drop an image or click to browse
                          </p>
                        </>
                      )}
                    </div>
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*"
                      onChange={(e) =>
                        e.target.files?.[0] && uploadStyleReference(e.target.files[0])
                      }
                      disabled={isUploadingStyle}
                    />
                  </label>
                )}
              </div>
            </motion.section>

            {/* REFERENCES PANEL */}
            {totalRefs > 0 && (
              <motion.section
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
              >
                <div className="flex items-center gap-3 mb-5">
                  <div className="p-2 rounded-lg bg-gradient-to-br from-fuchsia-400 to-purple-500">
                    <Sparkles className="w-5 h-5 text-white" />
                  </div>
                  <h2 className="text-lg font-bold text-purple-900">
                    Active References
                  </h2>
                  <span className="px-2.5 py-1 rounded-full bg-purple-100 text-purple-700 text-xs font-bold">
                    {totalRefs}
                  </span>
                </div>

                <div className="bg-white rounded-2xl shadow-lg border border-purple-100 p-6 space-y-6">
                  {/* CHARACTERS */}
                  {spread.characters.some((c) => c.referenceImageUrl) && (
                    <div>
                      <div className="flex items-center gap-2 mb-4">
                        <Users className="w-4 h-4 text-purple-600" />
                        <p className="text-xs font-bold text-purple-600 uppercase tracking-wider">
                          Characters
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        {spread.characters
                          .filter((c) => c.referenceImageUrl)
                          .map((c) => (
                            <div
                              key={c.id}
                              className="flex items-center gap-3 p-3 rounded-xl bg-purple-50 hover:bg-purple-100 border border-purple-100 transition-all"
                            >
                              <div className="w-12 h-12 rounded-lg overflow-hidden border border-purple-200 shrink-0 shadow-sm">
                                <img
                                  src={c.referenceImageUrl!}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-bold text-purple-900 truncate">
                                  {c.name}
                                </p>
                                <p className="text-xs text-purple-600">Character</p>
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* LOCATIONS */}
                  {spread.locations.some((l) => l.referenceImageUrl) && (
                    <div>
                      <div className="flex items-center gap-2 mb-4">
                        <MapPin className="w-4 h-4 text-emerald-600" />
                        <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider">
                          Locations
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        {spread.locations
                          .filter((l) => l.referenceImageUrl)
                          .map((l) => (
                            <div
                              key={l.id}
                              className="flex items-center gap-3 p-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-100 transition-all"
                            >
                              <div className="w-12 h-12 rounded-lg overflow-hidden border border-emerald-200 shrink-0 shadow-sm">
                                <img
                                  src={l.referenceImageUrl!}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-bold text-emerald-900 truncate">
                                  {l.name}
                                </p>
                                <p className="text-xs text-emerald-600">Location</p>
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              </motion.section>
            )}
          </div>

          {/* RIGHT: PREVIEW */}
          <div className="lg:sticky lg:top-28">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <div className="bg-white rounded-[2rem] shadow-2xl border border-purple-100 p-5">
                {/* CANVAS - FIX: Changed to 16:9 aspect ratio and contain instead of cover */}
                <div className="relative aspect-video rounded-2xl overflow-hidden bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-100">
                  <AnimatePresence>
                    {isGeneratingSample && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 z-20 bg-white/95 backdrop-blur-sm flex flex-col items-center justify-center p-8"
                      >
                        <div className="relative mb-6">
                          <div className="absolute inset-0 bg-gradient-to-br from-orange-400 to-purple-500 blur-2xl opacity-30 animate-pulse rounded-full" />
                          <Loader2 className="relative w-16 h-16 text-purple-600 animate-spin" />
                        </div>
                        <motion.p
                          key={generationProgress}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="text-xl font-bold text-purple-900 mb-2"
                        >
                          {generationProgress}
                        </motion.p>
                        <p className="text-sm text-purple-600">
                          Creating your illustration...
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {!isGeneratingSample && !sampleUrl && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center">
                      <div className="w-20 h-20 rounded-2xl bg-purple-100 border border-purple-200 flex items-center justify-center mb-4 shadow-lg">
                        <ImageIcon className="w-10 h-10 text-purple-400" />
                      </div>
                      <p className="text-lg font-bold text-purple-900 mb-2">
                        No concept yet
                      </p>
                      <p className="text-sm text-purple-600">
                        Generate a visual proof of concept
                      </p>
                    </div>
                  )}

                  {sampleUrl && !isGeneratingSample && (
                    <motion.div
                      initial={{ opacity: 0, scale: 1.05 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.5 }}
                      className="relative h-full group/img"
                    >
                      {/* FIX: Changed object-cover to object-contain */}
                      <img
                        src={sampleUrl}
                        alt="Generated sample"
                        className="w-full h-full object-contain"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover/img:opacity-100 transition-opacity duration-300 flex items-end justify-center pb-6">
                        <a
                          href={sampleUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="px-5 py-2 rounded-xl bg-white/90 backdrop-blur-sm border border-purple-200 text-purple-900 text-sm font-semibold hover:bg-white shadow-lg transition-all"
                        >
                          View Full Size →
                        </a>
                      </div>
                    </motion.div>
                  )}
                </div>

                {/* GENERATE BUTTON */}
                <button
                  onClick={generateSample}
                  disabled={isGeneratingSample || isEditingPrompt}
                  className="relative w-full mt-5 group/btn overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-orange-400 via-pink-500 to-purple-600 rounded-2xl group-hover/btn:scale-105 transition-transform" />
                  <div className="relative px-6 py-4 rounded-2xl flex items-center justify-center gap-3">
                    <Wand2 className="w-5 h-5 text-white" />
                    <span className="text-base font-bold text-white">
                      {sampleUrl ? "Regenerate Concept" : "Generate Concept"}
                    </span>
                  </div>
                </button>

                {/* PROCEED TO PAYMENT */}
                {sampleUrl && !isGeneratingSample && (
                  <motion.button
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    onClick={() => setShowPayment(true)}
                    className="relative w-full mt-3 group/btn overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-2xl group-hover/btn:scale-105 transition-transform" />
                    <div className="relative px-6 py-3 rounded-2xl flex items-center justify-center gap-3">
                      <CreditCard className="w-5 h-5 text-white" />
                      <span className="text-base font-bold text-white">
                        Continue to Payment
                      </span>
                      <ArrowRight className="w-5 h-5 text-white" />
                    </div>
                  </motion.button>
                )}

                <p className="text-xs text-center text-purple-600 mt-4 px-4">
                  Creates a high-quality visual concept for this spread using your style
                  and references
                </p>
              </div>
            </motion.div>
          </div>
        </div>
      </main>

      {/* PAYMENT MODAL */}
      <AnimatePresence>
        {showPayment && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6"
            onClick={() => setShowPayment(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
            >
              <div className="p-8">
                {/* HEADER */}
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <h2 className="text-2xl font-bold text-purple-900 mb-2">
                      Complete Your Book
                    </h2>
                    <p className="text-sm text-purple-600">
                      Generate your full illustrated storybook
                    </p>
                  </div>
                  <button
                    onClick={() => setShowPayment(false)}
                    className="p-2 hover:bg-purple-50 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5 text-purple-600" />
                  </button>
                </div>

                {/* PREVIEW */}
                <div className="mb-6">
                  <img
                    src={sampleUrl!}
                    alt="Sample"
                    className="w-full aspect-video object-contain rounded-xl border border-purple-100 bg-purple-50"
                  />
                  <p className="text-xs text-purple-600 text-center mt-3">
                    Your style concept preview
                  </p>
                </div>

                {/* PRICING */}
                <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-6 mb-6 border border-purple-100">
                  <div className="flex items-baseline justify-between mb-4">
                    <div>
                      <p className="text-sm text-purple-600 font-medium mb-1">
                        Complete Book Generation
                      </p>
                      <ul className="text-xs text-purple-700 space-y-1">
                        <li>✓ All {spreads.length} spreads illustrated</li>
                        <li>✓ Professional quality artwork</li>
                        <li>✓ Print-ready PDF download</li>
                        <li>✓ Character consistency throughout</li>
                      </ul>
                    </div>
                    <div className="text-right">
                      <p className="text-3xl font-bold text-purple-900">£29</p>
                      <p className="text-xs text-purple-600">one-time</p>
                    </div>
                  </div>
                </div>

                {/* PAYPAL BUTTONS */}
                <PayPalScriptProvider
                  options={{
                    clientId: process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID!,
                    currency: "GBP",
                  }}
                >
                  <PayPalButtons
                    style={{
                      layout: "vertical",
                      color: "gold",
                      shape: "rect",
                      label: "paypal",
                    }}
                    createOrder={async () => {
                      const res = await fetch("/api/paypal/order", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          storyId: style.storyId,
                          product: "FlipWhizz Complete Book",
                          price: "29.00",
                          currency: "GBP",
                        }),
                      });

                      const data = await res.json();
                      return data.orderID;
                    }}
                    onApprove={async (data) => {
                      const res = await fetch("/api/paypal/capture", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ orderID: data.orderID }),
                      });

                      const result = await res.json();

                      if (result.success) {
                        // Redirect to generation page or show success
                        window.location.href = `/stories/${style.storyId}/generate`;
                      } else {
                        alert("Payment failed. Please try again.");
                      }
                    }}
                    onError={(err) => {
                      console.error("PayPal error:", err);
                      alert("Payment error. Please try again.");
                    }}
                  />
                </PayPalScriptProvider>

                <p className="text-xs text-center text-purple-500 mt-4">
                  Secure payment powered by PayPal
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}