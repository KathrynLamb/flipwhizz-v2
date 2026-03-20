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
  Users,
  RefreshCw,
  CheckCircle,
  ChevronRight,
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
  locationId: string | null;
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
/* SPREAD CARD (sidebar)                                              */
/* ------------------------------------------------------------------ */

function SpreadCard({
  spread,
  selected,
  index,
  onSelect,
}: {
  spread: SpreadOption;
  selected: boolean;
  index: number;
  onSelect: () => void;
}) {
  return (
    <motion.button
      layout
      onClick={onSelect}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98 }}
      className={`w-full text-left bg-white rounded-2xl shadow-sm border-2 overflow-hidden transition-all duration-150 ${
        selected
          ? "border-violet-400 shadow-violet-100 shadow-md"
          : "border-gray-100 hover:border-violet-200"
      }`}
    >
      <div
        className="relative h-[80px] w-full overflow-hidden"
        style={{
          background: spread.existingImageUrl ? undefined : grad(index),
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

        {selected && (
          <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-violet-500 flex items-center justify-center shadow">
            <CheckCircle className="w-3.5 h-3.5 text-white" />
          </div>
        )}

        <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-black/50 to-transparent" />
        <span className="absolute bottom-1.5 left-3 text-white text-[10px] font-semibold tracking-wide">
          {spread.pageLabel}
        </span>
      </div>

      <div className="px-3 py-2.5">
        {spread.scene ? (
          <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed mb-2">
            {spread.scene}
          </p>
        ) : (
          <p className="text-xs text-gray-300 italic mb-2">No scene summary</p>
        )}

        <div className="flex flex-wrap gap-1">
          {spread.characters.slice(0, 2).map((c, i) => (
            <span
              key={c.id}
              className="inline-flex items-center gap-1 text-[10px] font-medium bg-violet-50 text-violet-600 px-1.5 py-0.5 rounded-full"
            >
              <Avatar
                name={c.name}
                imageUrl={c.imageUrl}
                size={12}
                index={i}
              />
              {c.name}
            </span>
          ))}

          {spread.characters.length > 2 && (
            <span className="text-[10px] text-gray-400">
              +{spread.characters.length - 2}
            </span>
          )}

          {spread.location && (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded-full">
              <MapPin className="w-2.5 h-2.5" />
              {spread.location.name}
            </span>
          )}
        </div>
      </div>
    </motion.button>
  );
}

/* ------------------------------------------------------------------ */
/* GENERATION PANEL — uses RedrawModal                                */
/* ------------------------------------------------------------------ */

function GenerationPanel({
  spread,
  storyId,
  isLocked = false,
  onGenerated,
}: {
  spread: SpreadOption;
  storyId: string;
  isLocked?: boolean;
  onGenerated?: () => void;
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
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
    }

    setStatus("idle");
    setResultImageUrl(spread.existingImageUrl);
    setError(null);
    setJobId(null);
    setStyleWarning(null);
    setShowRedraw(false);
    setIsSubmitting(false);
  }, [spread.spreadId, spread.existingImageUrl]);

  useEffect(() => {
    if (!jobId || (status !== "queued" && status !== "generating")) {
      return;
    }

    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/inngest/job-status/${jobId}`);
        if (!res.ok) return;

        const data = await res.json();
        setStatus(data.status);

        if (data.imageUrl) {
          setResultImageUrl(data.imageUrl);
        }

        if (data.status === "done" || data.status === "error") {
          if (pollRef.current) {
            clearInterval(pollRef.current);
          }

          if (data.status === "error") {
            setError("Generation failed — try again.");
          }
        }
      } catch {
        // swallow polling errors
      }
    }, 2500);

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
      }
    };
  }, [jobId, status]);

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

      if (!res.ok) {
        throw new Error((await res.text()) || "Request failed");
      }

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
            locationId: payload.locationId,
          },
        }),
      });

      if (!res.ok) {
        throw new Error((await res.text()) || "Request failed");
      }

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

  const busy = status === "queued" || status === "generating";

  return (
    <div className="space-y-4">
      {/* Page text */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <p className="text-[10px] font-semibold tracking-widest text-violet-400 uppercase mb-2">
            Left Page
          </p>
          <p className="text-sm text-gray-700 leading-relaxed font-serif">
            {spread.leftText || (
              <span className="text-gray-300 italic">No text</span>
            )}
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <p className="text-[10px] font-semibold tracking-widest text-violet-400 uppercase mb-2">
            Right Page
          </p>
          {spread.rightText ? (
            <p className="text-sm text-gray-700 leading-relaxed font-serif">
              {spread.rightText}
            </p>
          ) : (
            <p className="text-xs text-gray-300 italic">Single page spread</p>
          )}
        </div>
      </div>

      {/* In this scene */}
      {(spread.characters.length > 0 || spread.location) && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-5 py-4">
          <p className="text-[10px] font-semibold tracking-widest text-gray-400 uppercase mb-3 flex items-center gap-1.5">
            <Users className="w-3 h-3" /> In this scene
          </p>

          <div className="flex flex-wrap gap-5">
            {spread.characters.map((c, i) => (
              <div key={c.id} className="flex flex-col items-center gap-1.5">
                <Avatar
                  name={c.name}
                  imageUrl={c.imageUrl}
                  size={52}
                  index={i}
                />
                <span className="text-[11px] font-semibold text-gray-600">
                  {c.name}
                </span>
              </div>
            ))}

            {spread.location && (
              <div className="flex flex-col items-center gap-1.5">
                <Avatar
                  name={spread.location.name}
                  imageUrl={spread.location.imageUrl}
                  size={52}
                  rounded="xl"
                  index={spread.characters.length}
                />
                <span className="text-[11px] font-semibold text-gray-600">
                  {spread.location.name}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Scene info */}
      {(spread.scene || spread.mood) && (
        <div className="bg-violet-50 border border-violet-100 rounded-xl px-4 py-3">
          <div className="flex items-start gap-2">
            <Sparkles className="w-4 h-4 text-violet-400 flex-shrink-0 mt-0.5" />
            <div>
              {spread.scene && (
                <p className="text-sm text-violet-700 leading-relaxed">
                  {spread.scene}
                </p>
              )}
              {spread.mood && (
                <p className="text-xs text-violet-400 mt-1 font-medium uppercase tracking-wide">
                  Mood: {spread.mood}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Illustration canvas */}
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
              <motion.div
                key="result"
                initial={{ opacity: 0, scale: 1.02 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0"
              >
                <Image
                  src={resultImageUrl}
                  alt={`Spread: ${spread.pageLabel}`}
                  fill
                  className="object-cover"
                  priority
                />
              </motion.div>
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

        <div className="p-4 space-y-3">
          {isLocked && !busy && (
            <div className="text-center py-4 space-y-3">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gray-100 text-gray-500 text-sm font-medium">
                <Lock className="w-4 h-4" />
                Preview used on another spread
              </div>
              <p className="text-xs text-gray-400 max-w-sm mx-auto leading-relaxed">
                Your free preview illustration has been generated on a different
                spread. Order your book to generate all spreads.
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
            <button
              onClick={() => setShowRedraw(true)}
              className="w-full py-3.5 rounded-xl font-semibold text-sm text-white transition-all flex items-center justify-center gap-2"
              style={{
                background:
                  "linear-gradient(135deg, #7c3aed 0%, #db2777 100%)",
              }}
            >
              <RefreshCw className="w-4 h-4" />
              Redraw — Edit Characters, Outfits & More
            </button>
          )}

          {busy && (
            <button
              disabled
              className="w-full py-3.5 rounded-xl font-semibold text-sm text-white transition-all flex items-center justify-center gap-2 opacity-50 cursor-not-allowed bg-gray-400"
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
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setFetchError(null);

    fetch(`/api/stories/${storyId}/spreads-preview`)
      .then(async (res) => {
        if (!res.ok) {
          throw new Error((await res.text()) || `HTTP ${res.status}`);
        }
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

        if (unique.length > 0) {
          setSelectedId(unique[0].spreadId);
        }
      })
      .catch((e) => setFetchError(e.message ?? "Failed to load spreads"))
      .finally(() => setLoading(false));
  }, [storyId]);

  const selected = spreads.find((s) => s.spreadId === selectedId) ?? null;

  const [previewGeneratedId, setPreviewGeneratedId] = useState<string | null>(
    null
  );

  useEffect(() => {
    const existing = spreads.find((s) => s.existingImageUrl);
    if (existing) {
      setPreviewGeneratedId(existing.spreadId);
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

      <div className="md:hidden">
        <MobilePreview
          storyId={storyId}
          storyTitle={storyTitle}
          onContinue={handleContinue}
        />
      </div>

      <main className="hidden md:block max-w-[1160px] mx-auto px-4 sm:px-6 py-10">
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">👁️</span>
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
              Preview Your Book
            </h1>
          </div>
          <p className="text-gray-500 text-base max-w-lg leading-relaxed">
            Choose any spread and generate a sample illustration — using your
            characters, locations, and style guide. Redraw with full control
            over who appears and what they wear.
          </p>
        </div>

        <div className="flex items-start gap-3 bg-violet-50 border border-violet-100 rounded-xl px-4 py-3 mb-6">
          <Sparkles className="w-4 h-4 text-violet-500 flex-shrink-0 mt-0.5" />
          <p className="text-violet-700 text-sm leading-relaxed">
            <strong>Pro tip:</strong> Generate a first sample, then hit{" "}
            <strong>Redraw</strong> to swap characters, change outfits, switch
            locations, or give feedback — just like the Studio.
          </p>
        </div>

        {fetchError && (
          <div className="flex items-center gap-3 bg-red-50 border border-red-100 rounded-xl px-4 py-3 mb-6 text-red-600 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {fetchError}
          </div>
        )}

        <div className="grid lg:grid-cols-[280px_1fr] gap-6 items-start">
          <aside className="space-y-2 lg:sticky lg:top-6 max-h-[calc(100vh-120px)] overflow-y-auto pb-2 pr-1">
            <p className="text-[10px] font-semibold tracking-widest text-gray-400 uppercase px-1 mb-3">
              Choose a spread
            </p>

            {loading &&
              [1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="h-[130px] rounded-2xl bg-gray-100 animate-pulse"
                  style={{ animationDelay: `${i * 80}ms` }}
                />
              ))}

            {!loading && !fetchError && spreads.length === 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center">
                <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center mx-auto mb-2">
                  <Eye className="w-5 h-5 text-gray-300" />
                </div>
                <p className="text-sm text-gray-400">
                  No spreads found for this story.
                </p>
                <p className="text-xs text-gray-300 mt-1">
                  Run &quot;Decide Scenes&quot; first.
                </p>
              </div>
            )}

            {!loading &&
              spreads.map((s, i) => (
                <SpreadCard
                  key={s.spreadId}
                  spread={s}
                  selected={s.spreadId === selectedId}
                  index={i}
                  onSelect={() => setSelectedId(s.spreadId)}
                />
              ))}
          </aside>

          <div>
            {selected ? (
              <GenerationPanel
                spread={selected}
                storyId={storyId}
                isLocked={
                  hasUsedFreePreview && previewGeneratedId !== selected.spreadId
                }
                onGenerated={() => setPreviewGeneratedId(selected.spreadId)}
              />
            ) : !loading && !fetchError ? (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-16 flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 rounded-2xl bg-violet-50 flex items-center justify-center mb-4">
                  <Eye className="w-7 h-7 text-violet-300" />
                </div>
                <p className="text-gray-400 text-sm">
                  Select a spread on the left to get started
                </p>
              </div>
            ) : null}
          </div>
        </div>

        {spreads.length > 0 && (
          <div className="mt-10 bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <p className="font-semibold text-gray-800 text-sm">
                Happy with your style?
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                When you&apos;re ready, continue to order your printed book.
              </p>
            </div>

            <button
              onClick={handleContinue}
              className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm text-white flex-shrink-0 hover:opacity-90 transition-opacity"
              style={{
                background:
                  "linear-gradient(135deg, #7c3aed 0%, #db2777 100%)",
              }}
            >
              Continue to Order
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </main>
    </>
  );
}