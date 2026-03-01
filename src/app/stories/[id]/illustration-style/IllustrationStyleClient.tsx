"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle,
  Lock,
  Unlock,
  Sparkles,
  Save,
  Loader2,
  Wand2,
  X,
  Eye,
  Palette,
  Tag,
  ChevronDown,
  Info,
} from "lucide-react";
import type { StepKey } from "@/lib/storySteps";
import UnifiedStoryHeader from "@/app/stories/components/StoryHeader";

/* ------------------------------------------------------------------ */
/* TYPES                                                               */
/* ------------------------------------------------------------------ */

type ColorPalette = {
  primary: string;
  secondary: string;
  accent: string;
  mood: string;
  hex: string[];
};

// What the DB / server gives us — user-facing fields only
export type StyleGuide = {
  id: string;
  storyId: string;
  summary: string | null;
  artStyle: string | null;
  visualThemes: string | null;
  colorPalette: ColorPalette | null;
  sampleIllustrationUrl: string | null;
  approved: boolean | null;
  updatedAt: string | Date | null;
  // 🔒 promptBase / negativePrompt intentionally NOT in this type
  //    They live in DB as userNotes/negativePrompt but are never passed to the client
};

type Props = {
  storyId: string;
  storyTitle?: string;
  storyConfirmed: boolean;
  styleGuide: StyleGuide | null;
  currentStep?: StepKey;
  completedSteps?: StepKey[];
};

// What the analyze endpoint returns (includes internal fields we immediately forward to save)
type AnalysisResult = {
  summary: string;
  artStyle: string;
  visualThemes: string;
  colorPalette: ColorPalette;
  promptBase: string;      // 🔒 internal — forwarded to save, never stored in state
  negativePrompt: string;  // 🔒 internal — forwarded to save, never stored in state
};

/* ------------------------------------------------------------------ */
/* QUICK-TUNE PRESETS                                                  */
/* ------------------------------------------------------------------ */

const QUICK_TUNES = [
  { label: "Dreamlike & Soft",  icon: "🌙", prompt: "Soft, dreamlike quality with gentle, diffused lighting and a slightly ethereal atmosphere. Colours feel like a half-remembered dream." },
  { label: "Bold & Graphic",    icon: "⚡", prompt: "Bold graphic outlines with flat, punchy colours. High contrast. Clean and striking like a vintage poster." },
  { label: "Cosy & Warm",       icon: "🍂", prompt: "Warm golden tones, cosy textures, intimate scenes. Feels like a story told by firelight." },
  { label: "Magical Forest",    icon: "🌿", prompt: "Lush greens and dappled light. Organic, nature-inspired details. Every leaf and twig feels alive with magic." },
  { label: "Bright & Playful",  icon: "🎨", prompt: "Rainbow-bright palette, energetic composition, full of joy and movement. Makes you want to jump inside the page." },
  { label: "Gentle Pastels",    icon: "🌸", prompt: "Soft pastel palette with delicate, light-filled scenes. Tender and gentle, like a lullaby in colour." },
];

/* ------------------------------------------------------------------ */
/* FIELD CONFIG — user-facing only, no internal prompt fields         */
/* ------------------------------------------------------------------ */

type FieldKey = "summary" | "artStyle" | "visualThemes";

type FieldConfig = {
  key: FieldKey;
  label: string;
  icon: React.ReactNode;
  placeholder: string;
  hint: string;
  minH: string;
};

const FIELDS: FieldConfig[] = [
  {
    key: "summary",
    label: "Style Vision",
    icon: <Eye className="w-4 h-4" />,
    placeholder: "Describe the overall look and feel you're dreaming of… e.g. 'Warm watercolour with a whimsical, storybook glow — every page glowing like a summer afternoon'",
    hint: "This is your creative brief — the heart of how your illustrations will feel. Be vivid and personal.",
    minH: "min-h-[140px]",
  },
  {
    key: "artStyle",
    label: "Art Style",
    icon: <Palette className="w-4 h-4" />,
    placeholder: "e.g. Watercolour & soft ink, Bold graphic illustration, Gentle pencil wash",
    hint: "A short, beautiful label for the technique. Auto-filled when you upload a reference image.",
    minH: "min-h-[64px]",
  },
  {
    key: "visualThemes",
    label: "Mood & Themes",
    icon: <Tag className="w-4 h-4" />,
    placeholder: "e.g. Nature, wonder, golden hour, cosy adventure, friendship",
    hint: "The emotional themes that will run through every illustration. Helps the AI stay true to the feeling you want.",
    minH: "min-h-[64px]",
  },
];

/* ------------------------------------------------------------------ */
/* COMPONENT                                                           */
/* ------------------------------------------------------------------ */

export default function IllustrationStyleClient({
  storyId,
  storyTitle = "Illustration Style",
  storyConfirmed,
  styleGuide,
  currentStep = "studio",
  completedSteps = [],
}: Props) {
  const router = useRouter();

  /* ── User-facing state (displayed in UI) ── */
  const [summary, setSummary]             = useState(styleGuide?.summary ?? "");
  const [artStyle, setArtStyle]           = useState(styleGuide?.artStyle ?? "");
  const [visualThemes, setVisualThemes]   = useState(styleGuide?.visualThemes ?? "");
  const [colorPalette, setColorPalette]   = useState<ColorPalette | null>(styleGuide?.colorPalette ?? null);
  const [sampleIllustrationUrl, setSampleIllustrationUrl] = useState<string | null>(
    styleGuide?.sampleIllustrationUrl ?? null
  );
  const [locked, setLocked] = useState(styleGuide?.approved ?? false);

  /* ── UI state ── */
  const [saving, setSaving]               = useState(false);
  const [analyzing, setAnalyzing]         = useState(false);
  const [uploading, setUploading]         = useState(false);
  const [saveSuccess, setSaveSuccess]     = useState(false);
  const [activeHint, setActiveHint]       = useState<string | null>(null);
  const [showQuickTunes, setShowQuickTunes] = useState(false);
  const [dragOver, setDragOver]           = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  /* ── Setters map for FIELDS loop ── */
  const setters: Record<FieldKey, (v: string) => void> = {
    summary: setSummary,
    artStyle: setArtStyle,
    visualThemes: setVisualThemes,
  };
  const values: Record<FieldKey, string> = { summary, artStyle, visualThemes };

  /* ── Sync when styleGuide prop changes ── */
  useEffect(() => {
    setSummary(styleGuide?.summary ?? "");
    setArtStyle(styleGuide?.artStyle ?? "");
    setVisualThemes(styleGuide?.visualThemes ?? "");
    setColorPalette(styleGuide?.colorPalette ?? null);
    setSampleIllustrationUrl(styleGuide?.sampleIllustrationUrl ?? null);
    setLocked(styleGuide?.approved ?? false);
  // Include colorPalette in deps: old rows without hex will re-sync cleanly
  // Include sampleIllustrationUrl: image appears after upload without hard refresh
  }, [styleGuide?.id, styleGuide?.sampleIllustrationUrl, styleGuide?.colorPalette]);

  /* ── Dirty check (user-facing fields only) ── */
  const dirty = useMemo(() => {
    return (
      (styleGuide?.summary ?? "")              !== summary       ||
      (styleGuide?.artStyle ?? "")             !== artStyle      ||
      (styleGuide?.visualThemes ?? "")         !== visualThemes  ||
      (styleGuide?.sampleIllustrationUrl ?? null) !== sampleIllustrationUrl ||
      (styleGuide?.approved ?? false)          !== locked
    );
  }, [styleGuide, summary, artStyle, visualThemes, sampleIllustrationUrl, locked]);

  /* ---------------------------------------------------------------- */
  /* SAVE                                                              */
  /* Accepts an optional partial to merge in internal fields           */
  /* (promptBase / negativePrompt) without storing them in state       */
  /* ---------------------------------------------------------------- */
  async function saveGuide(partial?: Record<string, unknown>) {
    setSaving(true);
    try {
      const res = await fetch(`/api/stories/${storyId}/style-guide`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // User-facing fields from state
          summary,
          artStyle,
          visualThemes,
          colorPalette,
          sampleIllustrationUrl,
          approved: locked,
          // Internal fields (promptBase / negativePrompt) only present when
          // passed via `partial` — never stored in component state
          ...(partial ?? {}),
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
      router.refresh();
    } catch (err: any) {
      alert(err?.message ?? "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  /* ---------------------------------------------------------------- */
  /* LOCK                                                              */
  /* ---------------------------------------------------------------- */
  async function toggleLock(next: boolean) {
    setLocked(next);
    await saveGuide({ approved: next });
  }

  /* ---------------------------------------------------------------- */
  /* FILE UPLOAD + VISION                                              */
  /* ---------------------------------------------------------------- */
  async function onPickFile(file: File) {
    if (!file) return;
    setUploading(true);

    try {
      /* 1. Upload to Cloudinary */
      const form = new FormData();
      form.append("file", file);
      const up = await fetch(`/api/stories/${storyId}/style-guide/upload`, {
        method: "POST",
        body: form,
      });
      if (!up.ok) throw new Error(await up.text());
      const { url } = await up.json();
      setSampleIllustrationUrl(url);

      /* 2. Analyse with Claude vision */
      setAnalyzing(true);
      const vision = await fetch(`/api/stories/${storyId}/style-guide/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: url }),
      });
      if (!vision.ok) throw new Error(await vision.text());

      const v: AnalysisResult = await vision.json();

      /* 3. Update user-facing state */
      if (v.summary)       setSummary(v.summary);
      if (v.artStyle)      setArtStyle(v.artStyle);
      if (v.visualThemes)  setVisualThemes(v.visualThemes);
      if (v.colorPalette)  setColorPalette(v.colorPalette);

      /* 4. Save everything including internal fields
            promptBase → stored server-side as `userNotes` (column name obscures purpose)
            negativePrompt → stored as `negativePrompt`
            Neither ever touches React state — forwarded directly here */
      await saveGuide({
        sampleIllustrationUrl: url,
        summary: v.summary,
        artStyle: v.artStyle,
        visualThemes: v.visualThemes,
        colorPalette: v.colorPalette,
        promptBase: v.promptBase,           // 🔒 internal — goes straight to server
        negativePrompt: v.negativePrompt,   // 🔒 internal — goes straight to server
      });
    } catch (err: any) {
      alert(err?.message ?? "Failed");
    } finally {
      setUploading(false);
      setAnalyzing(false);
    }
  }

  const isLoading = uploading || analyzing;
  const loadingLabel = uploading ? "Uploading your image…" : "Reading the magic…";

  /* ---------------------------------------------------------------- */
  /* RENDER                                                            */
  /* ---------------------------------------------------------------- */
  return (
    <>
      <UnifiedStoryHeader
        storyId={storyId}
        title={storyTitle}
        currentStep={currentStep}
        completedSteps={completedSteps}
        showProgress={!storyConfirmed}
        progressCurrent={locked ? 1 : 0}
        progressTotal={1}
      />

      <main className="max-w-[1160px] mx-auto px-4 sm:px-6 py-10">

        {/* PAGE HEADER */}
        <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl">🎨</span>
              <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
                Craft Your Illustration Style
              </h1>
            </div>
            <p className="text-gray-500 text-base max-w-lg leading-relaxed">
              This is where your book finds its visual voice. Upload an image you love, or describe the world you're imagining — our AI will weave it into every single page.
            </p>
          </div>

          <AnimatePresence>
            {locked && (
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-2 rounded-full text-sm font-semibold"
              >
                <Lock className="w-4 h-4" />
                Style Locked — Ready to Illustrate
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="grid lg:grid-cols-5 gap-6 items-start">

          {/* ════════════════════════════════ */}
          {/* LEFT PANEL                       */}
          {/* ════════════════════════════════ */}
          <div className="lg:col-span-2 space-y-4">

            {/* ── Upload zone ── */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div
                className={`relative group transition-all duration-200 ${dragOver ? "ring-2 ring-violet-400 ring-offset-2" : ""}`}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  const f = e.dataTransfer.files[0];
                  if (f) onPickFile(f);
                }}
              >
                {sampleIllustrationUrl ? (
                  <div className="relative">
                    <img
                      src={sampleIllustrationUrl}
                      className="w-full h-[230px] object-cover"
                      alt="Style reference"
                    />
                    {!locked && (
                      <button
                        onClick={() => setSampleIllustrationUrl(null)}
                        className="absolute top-3 right-3 w-8 h-8 bg-white/90 backdrop-blur rounded-full flex items-center justify-center shadow-md hover:bg-white transition-colors"
                        title="Remove image"
                      >
                        <X className="w-4 h-4 text-gray-600" />
                      </button>
                    )}
                    <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-black/40 to-transparent" />
                    <div className="absolute bottom-3 left-4 text-white text-xs font-medium opacity-90">
                      Style Reference
                    </div>
                  </div>
                ) : (
                  <div
                    className={`h-[230px] flex flex-col items-center justify-center cursor-pointer transition-all duration-200 ${
                      dragOver
                        ? "bg-violet-50"
                        : "bg-gradient-to-br from-violet-50 via-pink-50 to-amber-50 hover:from-violet-100 hover:via-pink-100 hover:to-amber-100"
                    }`}
                    onClick={() => !locked && fileInputRef.current?.click()}
                  >
                    <div className="w-16 h-16 rounded-2xl bg-white shadow-sm flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                      <span className="text-3xl">{dragOver ? "✨" : "🖼️"}</span>
                    </div>
                    <p className="text-gray-700 font-semibold text-sm">Drop an image you love</p>
                    <p className="text-gray-400 text-xs mt-1">or click to browse</p>
                  </div>
                )}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                hidden
                accept="image/*"
                onChange={(e) => e.target.files && onPickFile(e.target.files[0])}
              />

              <div className="p-4 space-y-3">
                <button
                  onClick={() => !locked && fileInputRef.current?.click()}
                  disabled={locked || isLoading}
                  className="w-full relative overflow-hidden py-3 rounded-xl font-semibold text-sm text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    background: locked
                      ? "#9ca3af"
                      : "linear-gradient(135deg, #7c3aed 0%, #db2777 100%)",
                  }}
                >
                  <AnimatePresence mode="wait">
                    {isLoading ? (
                      <motion.span
                        key="loading"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex items-center justify-center gap-2"
                      >
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {loadingLabel}
                      </motion.span>
                    ) : (
                      <motion.span
                        key="idle"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex items-center justify-center gap-2"
                      >
                        <Wand2 className="w-4 h-4" />
                        {sampleIllustrationUrl ? "Analyse a New Image" : "Upload & Auto-Fill Style"}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </button>

                <p className="text-center text-xs text-gray-400 leading-relaxed">
                  Our AI reads your image and fills in your style guide automatically.
                </p>
              </div>
            </div>

            {/* ── Colour Palette card (shown after analysis) ── */}
            <AnimatePresence>
              {colorPalette && (colorPalette.hex?.length ?? 0) > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-violet-500"><Palette className="w-4 h-4" /></span>
                    <span className="font-semibold text-gray-800 text-sm">Colour Palette</span>
                  </div>

                  {/* Editable swatches */}
                  <div className="flex gap-2 mb-2">
                    {(colorPalette.hex ?? []).slice(0, 3).map((hex, i) => (
                      <div key={i} className="flex-1 relative">
                        <div
                          className="h-10 rounded-lg shadow-sm border border-black/5 cursor-pointer hover:ring-2 hover:ring-violet-300 transition-all"
                          style={{ backgroundColor: hex }}
                          title={`Click to change: ${hex}`}
                        />
                        <input
                          type="color"
                          value={hex}
                          disabled={locked}
                          onChange={(e) => {
                            const newHex = [...(colorPalette.hex ?? [])];
                            newHex[i] = e.target.value;
                            setColorPalette({ ...colorPalette, hex: newHex });
                          }}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                        />
                      </div>
                    ))}
                  </div>

                  {/* Editable labels */}
                  <div className="flex gap-2 text-xs mb-3">
                    <input
                      type="text"
                      value={colorPalette.primary}
                      disabled={locked}
                      onChange={(e) => setColorPalette({ ...colorPalette, primary: e.target.value })}
                      className="flex-1 bg-transparent text-gray-500 placeholder-gray-300 focus:outline-none focus:text-gray-700 truncate disabled:cursor-not-allowed"
                      placeholder="Primary"
                    />
                    <input
                      type="text"
                      value={colorPalette.secondary}
                      disabled={locked}
                      onChange={(e) => setColorPalette({ ...colorPalette, secondary: e.target.value })}
                      className="flex-1 bg-transparent text-gray-500 placeholder-gray-300 focus:outline-none focus:text-gray-700 truncate disabled:cursor-not-allowed"
                      placeholder="Secondary"
                    />
                    <input
                      type="text"
                      value={colorPalette.accent}
                      disabled={locked}
                      onChange={(e) => setColorPalette({ ...colorPalette, accent: e.target.value })}
                      className="flex-1 bg-transparent text-gray-500 placeholder-gray-300 focus:outline-none focus:text-gray-700 truncate disabled:cursor-not-allowed"
                      placeholder="Accent"
                    />
                  </div>

                  {/* Editable mood */}
                  <div className="inline-flex items-center gap-1.5 bg-violet-50 text-violet-600 text-xs font-medium px-3 py-1.5 rounded-full">
                    <Sparkles className="w-3 h-3" />
                    Feels{" "}
                    <input
                      type="text"
                      value={colorPalette.mood}
                      disabled={locked}
                      onChange={(e) => setColorPalette({ ...colorPalette, mood: e.target.value })}
                      className="bg-transparent text-violet-600 focus:outline-none w-24 disabled:cursor-not-allowed"
                      placeholder="mood"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Quick Mood Tunes ── */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <button
                onClick={() => setShowQuickTunes((v) => !v)}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">⚡</span>
                  <span className="font-semibold text-gray-800 text-sm">Quick Mood Tunes</span>
                </div>
                <ChevronDown
                  className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${
                    showQuickTunes ? "rotate-180" : ""
                  }`}
                />
              </button>

              <AnimatePresence>
                {showQuickTunes && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-4 grid grid-cols-2 gap-2">
                      {QUICK_TUNES.map((t) => (
                        <button
                          key={t.label}
                          disabled={locked}
                          onClick={() =>
                            setSummary((prev) =>
                              prev ? `${prev}\n\n${t.prompt}` : t.prompt
                            )
                          }
                          className="text-left p-3 rounded-xl border border-gray-100 hover:border-violet-300 hover:bg-violet-50 transition-all disabled:opacity-40 disabled:cursor-not-allowed group"
                        >
                          <span className="text-lg block mb-1">{t.icon}</span>
                          <span className="text-xs font-semibold text-gray-700 group-hover:text-violet-700">
                            {t.label}
                          </span>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* ── Lock / Save ── */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-3">
              <button
                onClick={() => toggleLock(!locked)}
                disabled={false}
                className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                  locked
                    ? "bg-amber-50 text-amber-700 border-2 border-amber-200 hover:bg-amber-100"
                    : "text-white"
                }`}
                style={
                  !locked
                    ? { background: "linear-gradient(135deg, #10b981 0%, #059669 100%)" }
                    : {}
                }
              >
                {locked ? (
                  <><Unlock className="w-4 h-4" /> Unlock & Edit Style</>
                ) : (
                  <><Lock className="w-4 h-4" /> Lock Style — I'm Happy!</>
                )}
              </button>

              {!locked && (
                <button
                  onClick={() => saveGuide()}
                  disabled={!dirty || saving}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm border-2 border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <AnimatePresence mode="wait">
                    {saveSuccess ? (
                      <motion.span
                        key="ok"
                        initial={{ scale: 0.8 }}
                        animate={{ scale: 1 }}
                        className="flex items-center gap-2 text-emerald-600"
                      >
                        <CheckCircle className="w-4 h-4" /> Saved!
                      </motion.span>
                    ) : saving ? (
                      <motion.span key="saving" className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" /> Saving…
                      </motion.span>
                    ) : (
                      <motion.span key="idle" className="flex items-center gap-2">
                        <Save className="w-4 h-4" /> Save Progress
                      </motion.span>
                    )}
                  </AnimatePresence>
                </button>
              )}

              <p className={`text-center text-xs leading-relaxed font-medium ${
                locked ? "text-emerald-600" : "text-gray-400"
              }`}>
                {locked
                  ? "✅ Your style is locked and ready. Every illustration will follow this guide."
                  : "Lock your style when you're happy — this keeps every illustration consistent throughout your book."}
              </p>
            </div>
          </div>

          {/* ════════════════════════════════ */}
          {/* RIGHT PANEL                      */}
          {/* ════════════════════════════════ */}
          <div className="lg:col-span-3 space-y-4">

            {/* Tip banner */}
            <div className="flex items-start gap-3 bg-violet-50 border border-violet-100 rounded-xl px-4 py-3">
              <Sparkles className="w-4 h-4 text-violet-500 flex-shrink-0 mt-0.5" />
              <p className="text-violet-700 text-sm leading-relaxed">
                <strong>Pro tip:</strong> The more vivid and specific your Style Vision, the more magical and consistent your illustrations will be. Think of this as your art director's brief — paint us a picture with your words.
              </p>
            </div>

            {/* Fields — user-facing only */}
            {FIELDS.map((field, i) => (
              <motion.div
                key={field.key}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
              >
                <div className="flex items-center justify-between px-5 pt-4 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-violet-500">{field.icon}</span>
                    <label className="font-semibold text-gray-800 text-sm">
                      {field.label}
                    </label>
                  </div>
                  <button
                    onClick={() =>
                      setActiveHint(activeHint === field.key ? null : field.key)
                    }
                    className="text-gray-300 hover:text-gray-500 transition-colors"
                  >
                    <Info className="w-4 h-4" />
                  </button>
                </div>

                <AnimatePresence>
                  {activeHint === field.key && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <p className="mx-5 mb-2 text-xs text-violet-600 bg-violet-50 rounded-lg px-3 py-2 leading-relaxed">
                        {field.hint}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>

                <textarea
                  value={values[field.key]}
                  onChange={(e) => setters[field.key](e.target.value)}
                  disabled={locked}
                  placeholder={field.placeholder}
                  className={`w-full px-5 pb-4 text-sm text-gray-700 placeholder-gray-300 bg-transparent resize-none focus:outline-none leading-relaxed ${field.minH} disabled:opacity-60 disabled:cursor-not-allowed`}
                />
              </motion.div>
            ))}
          </div>
        </div>
      </main>
    </>
  );
}