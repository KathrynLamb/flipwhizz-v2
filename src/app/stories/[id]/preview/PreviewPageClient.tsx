"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import {
  Eye,
  Sparkles,
  Loader2,
  Wand2,
  MapPin,
  RefreshCw,
  CheckCircle,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  AlertCircle,
  Lock,
} from "lucide-react";
import type { StepKey } from "@/lib/storySteps";
import UnifiedStoryHeader from "@/app/stories/components/StoryHeader";
import RedrawModal from "@/app/stories/[id]/studio/components/redrawModal";
import MobilePreview from "./MobilePreview";

/* ------------------------------------------------------------------ */
/* TYPES                                                              */
/* ------------------------------------------------------------------ */

interface SpreadCharacter {
  id: string;
  name: string;
  imageUrl: string | null;
}

interface SpreadLocation {
  id: string;
  name: string;
  imageUrl: string | null;
}

interface SpreadOption {
  spreadId: string;
  spreadIndex: number;
  pageLabel: string;
  leftPageId: string;
  rightPageId: string | null;
  leftText: string;
  rightText: string | null;
  existingImageUrl: string | null;
  scene: string;
  mood: string | null;
  characters: SpreadCharacter[];
  location: SpreadLocation | null;
}

type GenerationStatus = "idle" | "queued" | "generating" | "done" | "error";

type RedrawSubmitPayload = {
  feedback: string;
  includedCharacterIds: string[];
  outfitOverrides: Record<string, string>;
  primaryLocationId: string | null;
  includedLocationIds: string[];
  freshStart?: boolean;
};

type Props = {
  storyId: string;
  storyTitle?: string;
  storyConfirmed: boolean;
  currentStep?: StepKey;
  completedSteps?: StepKey[];
};

/* ------------------------------------------------------------------ */
/* GRADIENTS                                                          */
/* ------------------------------------------------------------------ */

const GRADIENTS = [
  "linear-gradient(135deg, #a78bfa 0%, #7c3aed 100%)",
  "linear-gradient(135deg, #fb923c 0%, #f59e0b 100%)",
  "linear-gradient(135deg, #38bdf8 0%, #6366f1 100%)",
  "linear-gradient(135deg, #34d399 0%, #059669 100%)",
  "linear-gradient(135deg, #f472b6 0%, #ec4899 100%)",
  "linear-gradient(135deg, #fbbf24 0%, #f97316 100%)",
  "linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%)",
];

const grad = (i: number) => GRADIENTS[i % GRADIENTS.length];

/* ------------------------------------------------------------------ */
/* AVATAR                                                             */
/* ------------------------------------------------------------------ */

function Avatar({
  name,
  imageUrl,
  size = 44,
  rounded = "full",
  index = 0,
}: {
  name: string;
  imageUrl: string | null;
  size?: number;
  rounded?: "full" | "xl";
  index?: number;
}) {
  const cls = rounded === "full" ? "rounded-full" : "rounded-xl";

  if (imageUrl) {
    return (
      <Image
        src={imageUrl}
        alt={name}
        width={size}
        height={size}
        className={`${cls} object-cover border-2 border-white shadow-sm flex-shrink-0`}
      />
    );
  }

  return (
    <div
      style={{ width: size, height: size, background: grad(index) }}
      className={`${cls} flex items-center justify-center border-2 border-white shadow-sm flex-shrink-0`}
    >
      <span
        className="text-white font-bold select-none"
        style={{ fontSize: size * 0.38 }}
      >
        {name[0]?.toUpperCase()}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* PHASE 1 — SPREAD PICKER                                            */
/* ------------------------------------------------------------------ */

function SpreadPicker({
  spreads,
  onSelect,
}: {
  spreads: SpreadOption[];
  onSelect: (spread: SpreadOption) => void;
}) {
  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-2xl">👁️</span>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
            Preview Your Book
          </h1>
        </div>
        <p className="text-gray-500 text-base max-w-lg leading-relaxed">
          Pick a spread to generate a sample illustration — using your
          characters, locations, and style guide.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {spreads.map((spread, i) => (
          <motion.button
            key={spread.spreadId}
            onClick={() => onSelect(spread)}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            whileHover={{ y: -3 }}
            whileTap={{ scale: 0.98 }}
            className="text-left bg-white rounded-2xl shadow-sm border-2 border-gray-100 hover:border-violet-300 hover:shadow-md overflow-hidden transition-colors group"
          >
            {/* Gradient banner */}
            <div
              className="relative h-20 w-full overflow-hidden"
              style={{
                background: spread.existingImageUrl ? undefined : grad(i),
              }}
            >
              {spread.existingImageUrl ? (
                <Image
                  src={spread.existingImageUrl}
                  alt={spread.pageLabel}
                  fill
                  className="object-cover"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center opacity-20">
                  <Eye className="w-7 h-7 text-white" />
                </div>
              )}

              {spread.existingImageUrl && (
                <div className="absolute top-2 right-2">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/90 text-white text-[10px] font-semibold">
                    <CheckCircle className="w-3 h-3" />
                    Generated
                  </span>
                </div>
              )}

              <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-black/50 to-transparent" />
              <span className="absolute bottom-1.5 left-3 text-white text-xs font-semibold tracking-wide">
                {spread.pageLabel}
              </span>
            </div>

            <div className="px-4 py-3 space-y-2.5">
              {spread.scene ? (
                <p className="text-sm text-gray-600 line-clamp-2 leading-relaxed">
                  {spread.scene}
                </p>
              ) : (
                <p className="text-sm text-gray-300 italic">
                  No scene summary
                </p>
              )}

              {/* Characters + location row */}
              <div className="flex flex-wrap items-center gap-1.5">
                {spread.characters.map((c, ci) => (
                  <span
                    key={c.id}
                    className="inline-flex items-center gap-1 text-[11px] font-medium bg-violet-50 text-violet-600 px-2 py-0.5 rounded-full"
                  >
                    <Avatar
                      name={c.name}
                      imageUrl={c.imageUrl}
                      size={14}
                      index={ci}
                    />
                    {c.name}
                  </span>
                ))}
                {spread.location && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full">
                    <MapPin className="w-3 h-3" />
                    {spread.location.name}
                  </span>
                )}
              </div>

              {/* CTA hint */}
              <div className="flex items-center gap-1 text-violet-500 text-xs font-semibold opacity-0 group-hover:opacity-100 transition-opacity pt-0.5">
                Preview this spread
                <ChevronRight className="w-3.5 h-3.5" />
              </div>
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* PHASE 2 — GENERATION PANEL (selected spread)                       */
/* ------------------------------------------------------------------ */

function GenerationPanel({
  spread,
  storyId,
  isLocked = false,
  showBack = true,
  onGenerated,
  onBack,
  onContinue,
}: {
  spread: SpreadOption;
  storyId: string;
  isLocked?: boolean;
  showBack?: boolean;
  onGenerated?: () => void;
  onBack: () => void;
  onContinue: () => void;
}) {
  const [status, setStatus] = useState<GenerationStatus>("idle");
  const [resultImageUrl, setResultImageUrl] = useState<string | null>(
    spread.existingImageUrl
  );
  const [error, setError] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [styleWarning, setStyleWarning] = useState<string | null>(null);
  const [showRedraw, setShowRedraw] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showImageLightbox, setShowImageLightbox] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);

    setStatus("idle");
    setResultImageUrl(spread.existingImageUrl);
    setError(null);
    setJobId(null);
    setStyleWarning(null);
    setShowRedraw(false);
    setIsSubmitting(false);
    setShowImageLightbox(false);
  }, [spread.spreadId, spread.existingImageUrl]);

  useEffect(() => {
    if (!jobId || (status !== "queued" && status !== "generating")) return;

    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/inngest/job-status/${jobId}`);
        if (!res.ok) return;
        const data = await res.json();
        setStatus(data.status);
        if (data.imageUrl) setResultImageUrl(data.imageUrl);
        if (data.status === "done" || data.status === "error") {
          if (pollRef.current) clearInterval(pollRef.current);
          if (data.status === "error")
            setError("Generation failed — try again.");
        }
      } catch {
        /* swallow */
      }
    }, 2500);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [jobId, status]);

  useEffect(() => {
    function handleEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setShowImageLightbox(false);
    }
    if (showImageLightbox) {
      window.addEventListener("keydown", handleEsc);
      document.body.style.overflow = "hidden";
    }
    return () => {
      window.removeEventListener("keydown", handleEsc);
      document.body.style.overflow = "";
    };
  }, [showImageLightbox]);

  async function handleQuickGenerate() {
    setError(null);
    setStatus("queued");
    try {
      const res = await fetch(`/api/stories/${storyId}/generate-spread`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leftPageId: spread.leftPageId,
          rightPageId: spread.rightPageId,
          pageLabel: spread.pageLabel,
        }),
      });
      if (!res.ok) throw new Error((await res.text()) || "Request failed");
      const { jobId: id, styleWarning: sw } = await res.json();
      setJobId(id);
      setStyleWarning(sw ?? null);
      setStatus("generating");
      onGenerated?.();
    } catch (e: any) {
      setError(e.message ?? "Something went wrong");
      setStatus("error");
    }
  }

  async function handleRedrawSubmit(payload: RedrawSubmitPayload) {
    setIsSubmitting(true);
    setError(null);
    setShowRedraw(false);
    setStatus("queued");
    try {
      const res = await fetch(`/api/stories/${storyId}/generate-spread`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leftPageId: spread.leftPageId,
          rightPageId: spread.rightPageId,
          pageLabel: spread.pageLabel,
          feedback: payload.feedback?.trim() || undefined,
          existingSpreadImageUrl: payload.freshStart
            ? null
            : resultImageUrl ?? spread.existingImageUrl ?? null,
          freshStart: payload.freshStart ?? false,
          referenceOverrides: {
            includedCharacterIds: payload.includedCharacterIds,
            outfitOverrides: payload.outfitOverrides,
            primaryLocationId: payload.primaryLocationId,
            includedLocationIds: payload.includedLocationIds,
          },
        }),
      });
      if (!res.ok) throw new Error((await res.text()) || "Request failed");
      const { jobId: id, styleWarning: sw } = await res.json();
      setJobId(id);
      setStyleWarning(sw ?? null);
      setStatus("generating");
      onGenerated?.();
    } catch (e: any) {
      setError(e.message ?? "Something went wrong");
      setStatus("error");
    } finally {
      setIsSubmitting(false);
    }
  }

  const [showDetails, setShowDetails] = useState(false);

  const busy = status === "queued" || status === "generating";

  return (
    <>
      <div className="space-y-4">
        {/* Back link */}
        {showBack && (
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-violet-600 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Pick a different spread
          </button>
        )}

        {/* Header row — compact: page badge + title + scene inline */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm"
              style={{ background: grad(spread.spreadIndex) }}
            >
              <span className="text-white text-[11px] font-bold leading-none">
                {spread.pageLabel.replace("Pages ", "").replace("Page ", "")}
              </span>
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-gray-900 tracking-tight">
                {!showBack ? "Your Preview" : spread.pageLabel}
              </h1>
              {spread.scene && (
                <p className="text-sm text-gray-500 mt-0.5 line-clamp-1">
                  {spread.scene}
                </p>
              )}
            </div>
          </div>

          {/* Inline character + location pills */}
          {(spread.characters.length > 0 || spread.location) && (
            <div className="hidden lg:flex items-center gap-1.5 flex-shrink-0 pt-1">
              {spread.characters.map((c, i) => (
                <span
                  key={c.id}
                  className="inline-flex items-center gap-1 text-[11px] font-medium bg-violet-50 text-violet-600 px-2 py-1 rounded-full"
                >
                  <Avatar
                    name={c.name}
                    imageUrl={c.imageUrl}
                    size={16}
                    index={i}
                  />
                  {c.name}
                </span>
              ))}
              {spread.location && (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-emerald-50 text-emerald-600 px-2 py-1 rounded-full">
                  <MapPin className="w-3 h-3" />
                  {spread.location.name}
                </span>
              )}
            </div>
          )}
        </div>

        {/* ============ ILLUSTRATION — THE HERO ============ */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="relative w-full aspect-[16/9] bg-gradient-to-br from-violet-50 via-pink-50 to-amber-50">
            <AnimatePresence mode="wait">
              {busy && (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 flex flex-col items-center justify-center gap-3"
                >
                  <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center">
                    <Sparkles className="w-6 h-6 text-violet-400 animate-pulse" />
                  </div>
                  <p className="text-sm font-medium text-gray-500">
                    {status === "queued"
                      ? "Queued for generation…"
                      : "Illustrating your spread…"}
                  </p>
                  <div className="flex gap-1 mt-1">
                    {[0, 1, 2].map((i) => (
                      <motion.div
                        key={i}
                        className="w-1.5 h-1.5 rounded-full bg-violet-400"
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{
                          repeat: Infinity,
                          duration: 1.2,
                          delay: i * 0.2,
                        }}
                      />
                    ))}
                  </div>
                </motion.div>
              )}

              {!busy && resultImageUrl && (
                <motion.button
                  key="result"
                  type="button"
                  initial={{ opacity: 0, scale: 1.02 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setShowImageLightbox(true)}
                  className="absolute inset-0 group cursor-zoom-in"
                >
                  <Image
                    src={resultImageUrl}
                    alt={`Spread: ${spread.pageLabel}`}
                    fill
                    className="object-cover"
                    priority
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                  <div className="absolute bottom-3 right-3 rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-gray-700 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity">
                    Click to enlarge
                  </div>
                </motion.button>
              )}

              {!busy && !resultImageUrl && (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 flex flex-col items-center justify-center gap-3"
                >
                  <div className="w-16 h-16 rounded-2xl bg-white shadow-sm flex items-center justify-center">
                    <Eye className="w-7 h-7 text-gray-300" />
                  </div>
                  <p className="text-sm text-gray-400">
                    Your illustration will appear here
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Action buttons — directly under the image */}
          <div className="p-4 space-y-3">
            {isLocked && !busy && (
              <div className="text-center py-3 space-y-2">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gray-100 text-gray-500 text-sm font-medium">
                  <Lock className="w-4 h-4" />
                  Preview used on another spread
                </div>
                <p className="text-xs text-gray-400 max-w-sm mx-auto leading-relaxed">
                  Order your book to generate all spreads.
                </p>
              </div>
            )}

            {!resultImageUrl && !busy && !isLocked && (
              <button
                onClick={handleQuickGenerate}
                className="w-full py-3.5 rounded-xl font-semibold text-sm text-white transition-all flex items-center justify-center gap-2"
                style={{
                  background:
                    "linear-gradient(135deg, #7c3aed 0%, #db2777 100%)",
                }}
              >
                <Wand2 className="w-4 h-4" />
                Generate Free Preview
              </button>
            )}

            {resultImageUrl && !busy && !isLocked && (
              <div className="flex gap-3">
                <button
                  onClick={() => setShowRedraw(true)}
                  className="flex-1 py-3 rounded-xl font-semibold text-sm text-white transition-all flex items-center justify-center gap-2"
                  style={{
                    background:
                      "linear-gradient(135deg, #7c3aed 0%, #db2777 100%)",
                  }}
                >
                  <RefreshCw className="w-4 h-4" />
                  Redraw
                </button>
                <button
                  onClick={onContinue}
                  className="flex-1 py-3 rounded-xl font-semibold text-sm text-white transition-all flex items-center justify-center gap-2 bg-gray-900 hover:bg-gray-800"
                >
                  Continue to Order
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {busy && (
              <button
                disabled
                className="w-full py-3.5 rounded-xl font-semibold text-sm text-white flex items-center justify-center gap-2 opacity-50 cursor-not-allowed bg-gray-400"
              >
                <Loader2 className="w-4 h-4 animate-spin" />
                {status === "queued" ? "Queued…" : "Generating…"}
              </button>
            )}

            {styleWarning && (
              <div className="flex items-center gap-2 text-amber-600 text-xs bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 text-amber-500" />
                {styleWarning === "no_style_guide" &&
                  "No style guide found — generating with default style."}
                {styleWarning === "style_not_locked" &&
                  "Your style guide isn't locked yet. Lock it in Design for best results."}
                {styleWarning === "no_reference_image" &&
                  "No style reference image uploaded. Add one in Design for better consistency."}
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 text-red-500 text-xs">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                {error}
              </div>
            )}
          </div>
        </div>

        {/* ============ COLLAPSIBLE DETAILS ============ */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <button
            onClick={() => setShowDetails((v) => !v)}
            className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors"
          >
            <span className="text-xs font-semibold tracking-widest text-gray-400 uppercase">
              Page text &amp; scene details
            </span>
            <ChevronDown
              className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${
                showDetails ? "rotate-180" : ""
              }`}
            />
          </button>

          <AnimatePresence initial={false}>
            {showDetails && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="px-5 pb-5 space-y-4">
                  {/* Page text side by side */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-gray-50 rounded-xl p-4">
                      <p className="text-[10px] font-semibold tracking-widest text-violet-400 uppercase mb-1.5">
                        Left Page
                      </p>
                      <p className="text-sm text-gray-700 leading-relaxed font-serif">
                        {spread.leftText || (
                          <span className="text-gray-300 italic">No text</span>
                        )}
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-4">
                      <p className="text-[10px] font-semibold tracking-widest text-violet-400 uppercase mb-1.5">
                        Right Page
                      </p>
                      {spread.rightText ? (
                        <p className="text-sm text-gray-700 leading-relaxed font-serif">
                          {spread.rightText}
                        </p>
                      ) : (
                        <p className="text-xs text-gray-300 italic">
                          Single page spread
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Characters + location (mobile — already shown as pills on lg) */}
                  {(spread.characters.length > 0 || spread.location) && (
                    <div className="flex flex-wrap gap-4 pt-1">
                      {spread.characters.map((c, i) => (
                        <div
                          key={c.id}
                          className="flex flex-col items-center gap-1"
                        >
                          <Avatar
                            name={c.name}
                            imageUrl={c.imageUrl}
                            size={40}
                            index={i}
                          />
                          <span className="text-[10px] font-semibold text-gray-500">
                            {c.name}
                          </span>
                        </div>
                      ))}
                      {spread.location && (
                        <div className="flex flex-col items-center gap-1">
                          <Avatar
                            name={spread.location.name}
                            imageUrl={spread.location.imageUrl}
                            size={40}
                            rounded="xl"
                            index={spread.characters.length}
                          />
                          <span className="text-[10px] font-semibold text-gray-500">
                            {spread.location.name}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Scene + mood */}
                  {(spread.scene || spread.mood) && (
                    <div className="flex items-start gap-2 text-sm text-violet-600 bg-violet-50 rounded-lg px-3 py-2.5">
                      <Sparkles className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-violet-400" />
                      <div>
                        {spread.scene && (
                          <p className="leading-relaxed">{spread.scene}</p>
                        )}
                        {spread.mood && (
                          <p className="text-xs text-violet-400 mt-1 font-medium uppercase tracking-wide">
                            Mood: {spread.mood}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <RedrawModal
          isOpen={showRedraw}
          onClose={() => setShowRedraw(false)}
          onSubmit={handleRedrawSubmit}
          isSubmitting={isSubmitting}
          storyId={storyId}
          spreadId={spread.spreadId}
          spreadLabel={spread.pageLabel}
        />
      </div>

      {/* Lightbox */}
      <AnimatePresence>
        {showImageLightbox && resultImageUrl && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowImageLightbox(false)}
            className="fixed inset-0 z-[80] bg-black/85 backdrop-blur-sm flex items-center justify-center p-6"
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-6xl h-[85vh] rounded-2xl overflow-hidden shadow-2xl"
            >
              <Image
                src={resultImageUrl}
                alt={`Large preview of ${spread.pageLabel}`}
                fill
                className="object-contain bg-black"
                sizes="100vw"
                priority
              />
              <button
                type="button"
                onClick={() => setShowImageLightbox(false)}
                className="absolute top-4 right-4 rounded-full bg-white/90 px-3 py-2 text-sm font-medium text-gray-800 shadow hover:bg-white"
              >
                Close
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* MAIN CLIENT COMPONENT                                              */
/* ------------------------------------------------------------------ */

export default function PreviewPageClient({
  storyId,
  storyTitle = "Preview",
  storyConfirmed,
  currentStep = "preview",
  completedSteps = [],
}: Props) {
  const router = useRouter();

  const [spreads, setSpreads] = useState<SpreadOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [selectedSpread, setSelectedSpread] = useState<SpreadOption | null>(
    null
  );

  useEffect(() => {
    setLoading(true);
    setFetchError(null);

    fetch(`/api/stories/${storyId}/spreads-preview`)
      .then(async (res) => {
        if (!res.ok)
          throw new Error((await res.text()) || `HTTP ${res.status}`);
        return res.json();
      })
      .then((data: SpreadOption[]) => {
        const seen = new Set<string>();
        const unique = data.filter((s) => {
          if (seen.has(s.spreadId)) return false;
          seen.add(s.spreadId);
          return true;
        });
        setSpreads(unique);
      })
      .catch((e) => setFetchError(e.message ?? "Failed to load spreads"))
      .finally(() => setLoading(false));
  }, [storyId]);

  /* Track which spread used the free preview */
  const [previewGeneratedId, setPreviewGeneratedId] = useState<string | null>(
    null
  );

  useEffect(() => {
    const existing = spreads.find((s) => s.existingImageUrl);
    if (existing) {
      setPreviewGeneratedId(existing.spreadId);
      // Auto-navigate to the generated spread — skip the picker
      setSelectedSpread(existing);
    }
  }, [spreads]);

  const hasUsedFreePreview = !!previewGeneratedId;

  async function handleContinue() {
    await fetch(`/api/stories/${storyId}/complete-step`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step: "preview" }),
    }).catch(() => {});

    router.push(`/stories/${storyId}/checkout`);
  }

  return (
    <>
      <UnifiedStoryHeader
        storyId={storyId}
        title={storyTitle}
        currentStep={currentStep}
        completedSteps={completedSteps}
        showProgress={!storyConfirmed}
        progressCurrent={0}
        progressTotal={1}
        storyConfirmed
        hasPages
      />

      {/* Mobile */}
      <div className="md:hidden">
        <MobilePreview
          storyId={storyId}
          storyTitle={storyTitle}
          onContinue={handleContinue}
        />
      </div>

      {/* Desktop */}
      <main className="hidden md:block max-w-[860px] mx-auto px-4 sm:px-6 py-10">
        {fetchError && (
          <div className="flex items-center gap-3 bg-red-50 border border-red-100 rounded-xl px-4 py-3 mb-6 text-red-600 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {fetchError}
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-8">
            <div>
              <div className="h-9 w-64 bg-gray-100 rounded-lg animate-pulse mb-2" />
              <div className="h-5 w-96 bg-gray-50 rounded-lg animate-pulse" />
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div
                  key={i}
                  className="h-[180px] rounded-2xl bg-gray-100 animate-pulse"
                  style={{ animationDelay: `${i * 80}ms` }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!loading && !fetchError && spreads.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-4">
              <Eye className="w-7 h-7 text-gray-300" />
            </div>
            <p className="text-sm text-gray-400">
              No spreads found for this story.
            </p>
            <p className="text-xs text-gray-300 mt-1">
              Run &quot;Decide Scenes&quot; first.
            </p>
          </div>
        )}

        {/* Two-phase flow */}
        {!loading && spreads.length > 0 && (
          <AnimatePresence mode="wait">
            {!selectedSpread ? (
              <motion.div
                key="picker"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
              >
                <SpreadPicker
                  spreads={spreads}
                  onSelect={(s) => setSelectedSpread(s)}
                />
              </motion.div>
            ) : (
              <motion.div
                key="generation"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
              >
                <GenerationPanel
                  spread={selectedSpread}
                  storyId={storyId}
                  isLocked={
                    hasUsedFreePreview &&
                    previewGeneratedId !== selectedSpread.spreadId
                  }
                  showBack={!hasUsedFreePreview}
                  onGenerated={() =>
                    setPreviewGeneratedId(selectedSpread.spreadId)
                  }
                  onBack={() => setSelectedSpread(null)}
                  onContinue={handleContinue}
                />
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </main>
    </>
  );
}