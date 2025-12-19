"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Wand2,
  Upload,
  Pencil,
  ArrowLeft,
  Rocket,
  Settings2,
  ArrowRight,
  Check,
  Image as ImageIcon,
  Loader2,
  RefreshCw,
  X,
  ChevronDown,
  ChevronUp,
  Sparkles,
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

type StoryStatus =
  | "world_ready"
  | "style_ready"
  | "awaiting_payment"
  | "awaiting_generation_choice"
  | "generating";

/* ======================================================
   ANIMATIONS
====================================================== */

const easeOut: [number, number, number, number] = [0.16, 1, 0.3, 1];

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: easeOut } },
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.92 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.4, ease: easeOut },
  },
};

const slideDown = {
  hidden: { opacity: 0, height: 0 },
  visible: {
    opacity: 1,
    height: "auto",
    transition: { duration: 0.3, ease: easeOut },
  },
  exit: { opacity: 0, height: 0, transition: { duration: 0.2 } },
};

/* ======================================================
   COMPONENT
====================================================== */

export default function InitialStyleDesignEditor({
  style,
  leftText,
  rightText,
  characters,
  locations,
  storyStatus,
  sampleImage
}: {
  style: ClientStyleGuide;
  leftText: string;
  rightText: string;
  characters: Entity[];
  locations: Entity[];
  storyStatus: StoryStatus;
  sampleImage: string | null | undefined;
}) {
  /* ---------------- STATE ---------------- */

  const [prompt, setPrompt] = useState(style.summary ?? "");
  const [styleRefUrl, setStyleRefUrl] = useState(style.styleGuideImage);
  const [mode, setMode] = useState<"view" | "edit" | "upload">("view");
  const [showDetails, setShowDetails] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isGeneratingSample, setIsGeneratingSample] = useState(false);
  const [sampleUrl, setSampleUrl] = useState(style.sampleIllustrationUrl || sampleImage);
  const [generationProgress, setGenerationProgress] = useState("");
  const [isSampleOpen, setIsSampleOpen] = useState(false);

  const needsPayment = storyStatus === "awaiting_payment";
  const canContinue = storyStatus === "awaiting_generation_choice";


  console.log('stort status', storyStatus)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setIsSampleOpen(false);
    }
  
    if (isSampleOpen) {
      window.addEventListener("keydown", onKey);
    }
  
    return () => window.removeEventListener("keydown", onKey);
  }, [isSampleOpen]);
  
  /* ======================================================
     ACTIONS
  ====================================================== */

  async function uploadStyleRef(file: File) {
    setIsUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);

      const res = await fetch("/api/uploads/reference", {
        method: "POST",
        body: fd,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setStyleRefUrl(data.url);

      await fetch("/api/style-guide/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storyId: style.storyId,
          styleGuideImage: data.url,
        }),
      });

      setMode("view");
    } finally {
      setIsUploading(false);
    }
  }

  async function savePromptEdit() {
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
    setGenerationProgress("Preparing your style...");

    await fetch("/api/style-guide/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        storyId: style.storyId,
        summary: prompt,
      }),
    });

    const references: any[] = [];

    if (styleRefUrl) {
      references.push({
        url: styleRefUrl,
        type: "style",
        label: "Art Style",
      });
    }

    references.push(...buildCharacterReferences(characters));

    await fetch("/api/style/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        storyId: style.storyId,
        description: prompt,
        leftText,
        rightText,
        references,
      }),
    });

    setGenerationProgress("Gathering references...");

    // Poll with progress updates
    let pollCount = 0;
    const poll = setInterval(async () => {
      pollCount++;
      
      if (pollCount === 3) setGenerationProgress("Creating illustration...");
      if (pollCount === 6) setGenerationProgress("Adding details...");
      if (pollCount === 9) setGenerationProgress("Almost there...");

      const res = await fetch(`/api/stories/${style.storyId}/style-poll`);
      if (!res.ok) return;

      const data = await res.json();
      if (data.sampleUrl) {
        clearInterval(poll);
        setSampleUrl(data.sampleUrl);
        setIsGeneratingSample(false);
        setGenerationProgress("");
      }
    }, 2000);
  }

  async function regenerateSample() {
    setSampleUrl(null);
    await generateSample();
  }

  /* ======================================================
     STATUS-DRIVEN VIEWS
  ====================================================== */

  if (storyStatus === "awaiting_generation_choice") {
    return (
      <CenteredShell>
        <SuccessIcon />
        <h1 className="text-5xl font-black mb-4 bg-gradient-to-r from-violet-600 to-fuchsia-600 bg-clip-text text-transparent">
          You're Ready to Create ✨
        </h1>
        <p className="text-xl text-stone-600 mb-12 max-w-xl">
          Choose how you'd like to bring your book to life.
        </p>

        <div className="grid md:grid-cols-2 gap-6 max-w-4xl w-full">
          <ActionCard
            icon={Rocket}
            title="Generate Full Book"
            text="Start illustrating every page automatically."
            onClick={() =>
              fetch(`/api/stories/${style.storyId}/start-generation`, {
                method: "POST",
              }).then(() => {
                window.location.href = `/stories/${style.storyId}/studio`;
              })
            }
          />

          <ActionCard
            icon={Settings2}
            title="Edit in Studio"
            text="Fine-tune characters and details first."
            onClick={() =>
              (window.location.href = `/stories/${style.storyId}/studio?mode=edit`)
            }
          />
        </div>
      </CenteredShell>
    );
  }

  if (storyStatus === "generating") {
    return (
      <CenteredShell>
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
          className="w-28 h-28 rounded-3xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-2xl mb-8"
        >
          <Wand2 className="w-14 h-14 text-white" />
        </motion.div>

        <h2 className="text-5xl font-black mb-4 bg-gradient-to-r from-violet-600 to-fuchsia-600 bg-clip-text text-transparent">
          Creating Your Book…
        </h2>
        <p className="text-xl text-stone-600">
          Illustrating each page with care ✨
        </p>
      </CenteredShell>
    );
  }

  /* ======================================================
     STYLE EDITOR (MAIN VIEW)
  ====================================================== */

  const hasCharacters = characters.length > 0;
  const hasLocations = locations.length > 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-fuchsia-50 to-amber-50">
      {/* HEADER */}
      <motion.header
        initial="hidden"
        animate="visible"
        variants={fadeUp}
        className="pt-20 pb-12 px-6 text-center"
      >
        <h1 className="text-5xl md:text-6xl font-black mb-4 bg-gradient-to-r from-violet-600 to-fuchsia-600 bg-clip-text text-transparent">
          Design Your Story's Look
        </h1>
        <p className="text-xl text-stone-600 max-w-2xl mx-auto">
          We've suggested a style based on your story. Edit it, upload a
          reference, or generate a sample.
        </p>
      </motion.header>

      <div className="max-w-6xl mx-auto px-6 pb-20">
        <div className="grid lg:grid-cols-2 gap-8">
          {/* LEFT COLUMN: STYLE EDITOR */}
          <motion.div
            initial="hidden"
            animate="visible"
            variants={scaleIn}
            className="space-y-6"
          >
            {/* STYLE PROMPT CARD */}
            <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl border border-white overflow-hidden">
              <div className="p-8">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-2xl font-bold text-stone-800">
                    Art Style
                  </h3>
                  {mode === "view" && (
                    <button
                      onClick={() => setMode("edit")}
                      className="flex items-center gap-2 px-4 py-2 rounded-full bg-violet-100 text-violet-700 hover:bg-violet-200 transition-colors text-sm font-semibold"
                    >
                      <Pencil className="w-4 h-4" />
                      Edit
                    </button>
                  )}
                </div>

                {mode === "view" && (
                  <p className="text-lg text-stone-700 leading-relaxed italic">
                    "{prompt}"
                  </p>
                )}

                {mode === "edit" && (
                  <div className="space-y-4">
                    <textarea
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      className="w-full h-40 border-2 border-violet-200 rounded-2xl p-4 text-lg focus:border-violet-400 focus:outline-none transition-colors"
                      placeholder="Describe the art style..."
                      autoFocus
                    />
                    <div className="flex gap-3">
                      <button
                        onClick={savePromptEdit}
                        className="flex-1 px-6 py-3 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white font-bold hover:shadow-lg transition-shadow"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => {
                          setPrompt(style.summary ?? "");
                          setMode("view");
                        }}
                        className="px-6 py-3 rounded-full bg-stone-200 text-stone-700 font-bold hover:bg-stone-300 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* STYLE REFERENCE IMAGE */}
            <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl border border-white overflow-hidden">
              <div className="p-8">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-2xl font-bold text-stone-800">
                    Reference Image
                  </h3>
                  {mode === "view" && !styleRefUrl && (
                    <button
                      onClick={() => setMode("upload")}
                      className="flex items-center gap-2 px-4 py-2 rounded-full bg-violet-100 text-violet-700 hover:bg-violet-200 transition-colors text-sm font-semibold"
                    >
                      <Upload className="w-4 h-4" />
                      Upload
                    </button>
                  )}
                </div>

                {mode === "upload" && (
                  <div className="space-y-4">
                    <label className="block border-2 border-dashed border-violet-300 rounded-2xl p-12 text-center cursor-pointer hover:border-violet-400 transition-colors bg-violet-50/50">
                      {isUploading ? (
                        <div className="flex flex-col items-center gap-3">
                          <Loader2 className="w-10 h-10 text-violet-600 animate-spin" />
                          <p className="text-violet-600 font-semibold">
                            Uploading...
                          </p>
                        </div>
                      ) : (
                        <>
                          <Upload className="w-12 h-12 mx-auto mb-4 text-violet-400" />
                          <p className="text-lg font-semibold text-stone-700 mb-1">
                            Click to upload
                          </p>
                          <p className="text-sm text-stone-500">
                            JPG, PNG or WebP
                          </p>
                        </>
                      )}
                      <input
                        type="file"
                        className="hidden"
                        accept="image/*"
                        onChange={(e) =>
                          e.target.files && uploadStyleRef(e.target.files[0])
                        }
                        disabled={isUploading}
                      />
                    </label>
                    <button
                      onClick={() => setMode("view")}
                      className="w-full px-6 py-3 rounded-full bg-stone-200 text-stone-700 font-bold hover:bg-stone-300 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                )}

                {mode === "view" && styleRefUrl && (
                  <div className="space-y-4">
                    <div className="relative group">
                      <img
                        src={styleRefUrl}
                        alt="Style reference"
                        className="w-full rounded-2xl shadow-lg"
                      />
                      <button
                        onClick={() => {
                          setStyleRefUrl(null);
                          setMode("upload");
                        }}
                        className="absolute top-3 right-3 p-2 rounded-full bg-white/90 text-stone-700 hover:bg-red-100 hover:text-red-600 transition-colors shadow-lg opacity-0 group-hover:opacity-100"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                )}

                {mode === "view" && !styleRefUrl && (
                  <div className="text-center py-8 text-stone-400">
                    <ImageIcon className="w-12 h-12 mx-auto mb-3 opacity-40" />
                    <p className="text-sm">No reference image uploaded</p>
                  </div>
                )}
              </div>
            </div>

            {/* CHARACTER & LOCATION DETAILS */}
            {(hasCharacters || hasLocations) && (
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="w-full bg-white/90 backdrop-blur-xl rounded-3xl shadow-xl border border-white p-6 hover:shadow-2xl transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
                      <Sparkles className="w-5 h-5 text-white" />
                    </div>
                    <div className="text-left">
                      <h4 className="font-bold text-stone-800">
                        Story Details
                      </h4>
                      <p className="text-sm text-stone-500">
                        {characters.length} character{characters.length !== 1 ? "s" : ""} · {locations.length} location{locations.length !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>
                  {showDetails ? (
                    <ChevronUp className="w-5 h-5 text-stone-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-stone-400" />
                  )}
                </div>
              </button>
            )}

            <AnimatePresence>
              {showDetails && (
                <motion.div
                  variants={slideDown}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-xl border border-white overflow-hidden"
                >
                  <div className="p-8 space-y-6">
                    {hasCharacters && (
                      <div>
                        <h4 className="font-bold text-stone-800 mb-4">
                          Characters
                        </h4>
                        <div className="space-y-3">
                          {characters.map((char) => (
                            <div
                              key={char.id}
                              className="flex items-center gap-3 p-3 rounded-xl bg-stone-50"
                            >
                              {char.referenceImageUrl ? (
                                <img
                                  src={char.referenceImageUrl}
                                  alt={char.name}
                                  className="w-12 h-12 rounded-lg object-cover"
                                />
                              ) : (
                                <div className="w-12 h-12 rounded-lg bg-violet-200 flex items-center justify-center text-violet-700 font-bold">
                                  {char.name[0]}
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-stone-800">
                                  {char.name}
                                </p>
                                {char.description && (
                                  <p className="text-sm text-stone-500 truncate">
                                    {char.description}
                                  </p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {hasLocations && (
                      <div>
                        <h4 className="font-bold text-stone-800 mb-4">
                          Locations
                        </h4>
                        <div className="space-y-3">
                          {locations.map((loc) => (
                            <div
                              key={loc.id}
                              className="flex items-center gap-3 p-3 rounded-xl bg-stone-50"
                            >
                              {loc.referenceImageUrl ? (
                                <img
                                  src={loc.referenceImageUrl}
                                  alt={loc.name}
                                  className="w-12 h-12 rounded-lg object-cover"
                                />
                              ) : (
                                <div className="w-12 h-12 rounded-lg bg-amber-200 flex items-center justify-center text-amber-700 font-bold">
                                  {loc.name[0]}
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-stone-800">
                                  {loc.name}
                                </p>
                                {loc.description && (
                                  <p className="text-sm text-stone-500 truncate">
                                    {loc.description}
                                  </p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* RIGHT COLUMN: SAMPLE PREVIEW */}
          <motion.div
            initial="hidden"
            animate="visible"
            variants={scaleIn}
            className="lg:sticky lg:top-8 h-fit"
          >
            <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl border border-white overflow-hidden">
              <div className="p-8">
                <h3 className="text-2xl font-bold text-stone-800 mb-6">
                  Sample Preview
                </h3>

                {isGeneratingSample && (
                  <div className="aspect-[4/3] rounded-2xl bg-gradient-to-br from-violet-100 to-fuchsia-100 flex flex-col items-center justify-center p-8">
                    <Loader2 className="w-16 h-16 text-violet-600 animate-spin mb-6" />
                    <p className="text-lg font-semibold text-violet-700 mb-2">
                      {generationProgress}
                    </p>
                    <p className="text-sm text-violet-600 text-center max-w-xs">
                      This usually takes 30-60 seconds
                    </p>
                  </div>
                )}

                {!isGeneratingSample && !sampleUrl && (
                  <div className="aspect-[4/3] rounded-2xl bg-gradient-to-br from-stone-100 to-stone-200 flex flex-col items-center justify-center p-8 border-2 border-dashed border-stone-300">
                    <Wand2 className="w-16 h-16 text-stone-400 mb-4" />
                    <p className="text-lg font-semibold text-stone-600 mb-2">
                      No Sample Yet
                    </p>
                    <p className="text-sm text-stone-500 text-center max-w-xs">
                      Generate a sample to preview your story's visual style
                    </p>
                  </div>
                )}

                {!isGeneratingSample && sampleUrl && (
                  <div className="space-y-4">
                    <div className="relative group">
                    <img
                          src={sampleUrl}
                          alt="Style sample"
                          onClick={() => setIsSampleOpen(true)}
                          className="w-full rounded-2xl shadow-lg cursor-zoom-in hover:opacity-95 transition"
                        />

<div className="absolute inset-0 pointer-events-none bg-black/0 group-hover:bg-black/5 transition-colors rounded-2xl" />
                    </div>
                    <button
                      onClick={regenerateSample}
                      className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-stone-100 text-stone-700 font-semibold hover:bg-stone-200 transition-colors"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Regenerate Sample
                    </button>
                  </div>
                )}

<div className="mt-8 pt-8 border-t space-y-4">
  {!sampleUrl && (
    <button
      onClick={generateSample}
      disabled={isGeneratingSample || mode !== "view"}
      className="w-full px-8 py-5 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white font-black text-lg shadow-xl hover:shadow-2xl hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {isGeneratingSample ? (
        <span className="flex items-center justify-center gap-3">
          <Loader2 className="w-5 h-5 animate-spin" />
          Generating...
        </span>
      ) : (
        <span className="flex items-center justify-center gap-3">
          <Wand2 className="w-5 h-5" />
          Generate Sample
        </span>
      )}
    </button>
  )}

  {sampleUrl && (
    <div className="space-y-4 text-center">
      <p className="text-lg font-semibold text-stone-700">
        Happy with this style?
      </p>

      {needsPayment ? (
        <button
          onClick={() =>
            (window.location.href = `/stories/${style.storyId}/checkout`)
          }
          className="w-full px-8 py-5 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-black text-lg shadow-xl hover:shadow-2xl hover:scale-105 transition-all"
        >
          <span className="flex items-center justify-center gap-3">
            <Sparkles className="w-5 h-5" />
            Unlock Full Book
          </span>
        </button>
      ) : (
        <button
          onClick={() =>
            (window.location.href = `/stories/${style.storyId}/studio`)
          }
          className="w-full px-8 py-5 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white font-black text-lg shadow-xl hover:shadow-2xl hover:scale-105 transition-all"
        >
          <span className="flex items-center justify-center gap-3">
            <ArrowRight className="w-5 h-5" />
            Continue to Studio
          </span>
        </button>
      )}

      <button
        onClick={regenerateSample}
        className="mx-auto flex items-center gap-2 text-sm text-stone-500 hover:text-stone-700 transition"
      >
        <RefreshCw className="w-4 h-4" />
        Try a different style
      </button>
    </div>
  )}

  {mode !== "view" && (
    <p className="text-sm text-center text-stone-500">
      Save your changes before generating
    </p>
  )}
</div>

              </div>
            </div>
          </motion.div>
        </div>
      </div>
      <AnimatePresence>
  {isSampleOpen && sampleUrl && (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center px-4"
      onClick={() => setIsSampleOpen(false)}
    >
      {/* Image container */}
      <motion.div
        initial={{ scale: 0.92, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.92, opacity: 0 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="relative max-w-6xl max-h-[90vh] w-full"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={() => setIsSampleOpen(false)}
          className="absolute -top-4 -right-4 z-10 p-2 rounded-full bg-white shadow-lg hover:bg-stone-100 transition"
        >
          <X className="w-5 h-5 text-stone-700" />
        </button>

        {/* Full image */}
        <img
          src={sampleUrl}
          alt="Full style sample"
          className="w-full h-auto max-h-[90vh] object-contain rounded-2xl shadow-2xl bg-white"
        />
      </motion.div>
    </motion.div>
  )}
</AnimatePresence>

    </div>
  );
}

/* ======================================================
   UI HELPERS
====================================================== */

function CenteredShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center px-6 bg-gradient-to-br from-violet-50 via-fuchsia-50 to-amber-50">
      {children}
    </div>
  );
}

function SuccessIcon() {
  return (
    <motion.div
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ type: "spring", duration: 0.6 }}
      className="w-28 h-28 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-2xl mb-10"
    >
      <Check className="w-14 h-14 text-white" />
    </motion.div>
  );
}

function ActionCard({
  icon: Icon,
  title,
  text,
  onClick,
}: {
  icon: any;
  title: string;
  text: string;
  onClick: () => void;
}) {
  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="group bg-white/80 backdrop-blur-xl p-10 rounded-[2rem] border-2 border-transparent hover:border-violet-400 shadow-xl text-left transition-all"
    >
      <div className="w-16 h-16 bg-gradient-to-br from-violet-500 to-fuchsia-500 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
        <Icon className="w-8 h-8 text-white" />
      </div>
      <h3 className="text-2xl font-bold mb-3 text-stone-800">{title}</h3>
      <p className="text-stone-600 mb-6">{text}</p>
      <div className="flex items-center text-violet-600 font-bold group-hover:gap-3 transition-all">
        Continue
        <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
      </div>
    </motion.button>
  );
}