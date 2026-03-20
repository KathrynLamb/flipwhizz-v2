"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
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
import RedrawModal from "@/app/stories/[id]/studio/components/redrawModal";

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

/* ------------------------------------------------------------------ */
/* CONSTANTS                                                          */
/* ------------------------------------------------------------------ */

const FONT = "'Bricolage Grotesque', system-ui, sans-serif";

const ACCENT_COLORS = [
  { from: "#C77DFF", to: "#E07ABA" },
  { from: "#FFB347", to: "#FF8A65" },
  { from: "#A78BFA", to: "#67E8F9" },
  { from: "#F472B6", to: "#C084FC" },
  { from: "#34D399", to: "#60A5FA" },
];

function accentFor(i: number) {
  return ACCENT_COLORS[i % ACCENT_COLORS.length];
}

/* ------------------------------------------------------------------ */
/* SPREAD THUMBNAIL (horizontal scroller)                             */
/* ------------------------------------------------------------------ */

function SpreadThumb({
  spread,
  index,
  selected,
  onSelect,
}: {
  spread: SpreadOption;
  index: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const accent = accentFor(index);

  return (
    <button
      onClick={onSelect}
      className="flex-shrink-0 rounded-2xl overflow-hidden transition-all active:scale-[0.97]"
      style={{
        width: 140,
        border: selected
          ? "2.5px solid #B05CE6"
          : "2px solid rgba(180,150,210,0.12)",
        boxShadow: selected
          ? "0 4px 16px rgba(176,92,230,0.2)"
          : "0 2px 8px rgba(0,0,0,0.04)",
        fontFamily: FONT,
      }}
    >
      <div
        className="relative w-full overflow-hidden"
        style={{
          aspectRatio: "2 / 1",
          background: spread.existingImageUrl
            ? undefined
            : `linear-gradient(135deg, ${accent.from}, ${accent.to})`,
        }}
      >
        {spread.existingImageUrl ? (
          <img
            src={spread.existingImageUrl}
            alt={spread.pageLabel}
            className="w-full h-full object-cover"
            draggable={false}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <Eye className="w-5 h-5 text-white/40" />
          </div>
        )}

        {selected && (
          <div
            className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center"
            style={{ background: "#B05CE6" }}
          >
            <CheckCircle className="w-3 h-3 text-white" />
          </div>
        )}
      </div>

      <div className="px-2.5 py-2" style={{ background: "white" }}>
        <p
          className="text-[11px] font-bold truncate"
          style={{ color: selected ? "#B05CE6" : "#2D2235" }}
        >
          {spread.pageLabel}
        </p>
        {spread.location && (
          <p
            className="text-[10px] truncate mt-0.5 flex items-center gap-1"
            style={{ color: "#8B7BA0" }}
          >
            <MapPin className="w-2.5 h-2.5 flex-shrink-0" />
            {spread.location.name}
          </p>
        )}
      </div>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* GENERATION SECTION                                                 */
/* ------------------------------------------------------------------ */

function MobileGenerationSection({
  spread,
  storyId,
  isLocked,
  onGenerated,
}: {
  spread: SpreadOption;
  storyId: string;
  isLocked: boolean;
  onGenerated: () => void;
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
    if (pollRef.current) clearInterval(pollRef.current);
    setStatus("idle");
    setResultImageUrl(spread.existingImageUrl);
    setError(null);
    setJobId(null);
    setStyleWarning(null);
    setShowRedraw(false);
    setIsSubmitting(false);
  }, [spread.spreadId, spread.existingImageUrl]);

  useEffect(() => {
    if (!jobId || (status !== "queued" && status !== "generating")) return;

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
          if (pollRef.current) clearInterval(pollRef.current);
          if (data.status === "error") {
            setError("Generation failed — try again.");
          }
        }
      } catch {
        // swallow
      }
    }, 2500);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
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
      onGenerated();
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
      onGenerated();
    } catch (e: any) {
      setError(e.message ?? "Something went wrong");
      setStatus("error");
    } finally {
      setIsSubmitting(false);
    }
  }

  const busy = status === "queued" || status === "generating";

  return (
    <>
      <div
        className="mx-4 rounded-2xl overflow-hidden"
        style={{
          boxShadow: resultImageUrl
            ? "0 8px 32px rgba(100,40,160,0.15)"
            : "0 2px 12px rgba(100,40,160,0.06)",
          border: resultImageUrl
            ? "none"
            : "1.5px dashed rgba(176,92,230,0.2)",
          background: resultImageUrl ? "transparent" : "rgba(176,92,230,0.04)",
        }}
      >
        <div className="relative w-full" style={{ aspectRatio: "2 / 1" }}>
          {busy && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center"
                style={{ background: "rgba(176,92,230,0.1)" }}
              >
                <Sparkles
                  className="w-6 h-6 animate-pulse"
                  style={{ color: "#B05CE6" }}
                />
              </div>
              <p className="text-xs font-semibold" style={{ color: "#9B59D0" }}>
                {status === "queued" ? "Queued…" : "Illustrating…"}
              </p>
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ background: "#B05CE6" }}
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{
                      repeat: Infinity,
                      duration: 1.2,
                      delay: i * 0.2,
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {!busy && resultImageUrl && (
            <img
              src={resultImageUrl}
              alt={spread.pageLabel}
              className="w-full h-full object-cover"
              draggable={false}
            />
          )}

          {!busy && !resultImageUrl && !isLocked && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center"
                style={{ background: "rgba(176,92,230,0.08)" }}
              >
                <Eye className="w-6 h-6" style={{ color: "#C4A0E0" }} />
              </div>
              <p className="text-xs font-semibold" style={{ color: "#C4A0E0" }}>
                Tap below to generate
              </p>
            </div>
          )}

          {!busy && !resultImageUrl && isLocked && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 px-6">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center"
                style={{ background: "rgba(180,150,210,0.08)" }}
              >
                <Lock className="w-6 h-6" style={{ color: "#C4A0E0" }} />
              </div>
              <p
                className="text-xs font-semibold text-center"
                style={{ color: "#C4A0E0" }}
              >
                Preview used on another spread
              </p>
              <p
                className="text-[10px] text-center leading-relaxed"
                style={{ color: "#C4A0E0" }}
              >
                Order your book to generate all spreads
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="px-4 pt-3">
        {!resultImageUrl && !busy && !isLocked && (
          <button
            onClick={handleQuickGenerate}
            className="w-full py-3.5 rounded-2xl text-sm font-bold text-white flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
            style={{
              background: "linear-gradient(135deg, #B05CE6, #E91E8C)",
              boxShadow: "0 4px 16px rgba(176,92,230,0.25)",
              border: "none",
              fontFamily: FONT,
            }}
          >
            <Wand2 className="w-4 h-4" />
            Generate Free Preview
          </button>
        )}

        {resultImageUrl && !busy && !isLocked && (
          <button
            onClick={() => setShowRedraw(true)}
            className="w-full py-3.5 rounded-2xl text-sm font-bold text-white flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
            style={{
              background: "linear-gradient(135deg, #B05CE6, #E91E8C)",
              boxShadow: "0 4px 16px rgba(176,92,230,0.25)",
              border: "none",
              fontFamily: FONT,
            }}
          >
            <RefreshCw className="w-4 h-4" />
            Redraw This Spread
          </button>
        )}

        {busy && (
          <button
            disabled
            className="w-full py-3.5 rounded-2xl text-sm font-bold text-white flex items-center justify-center gap-2 opacity-50"
            style={{
              background: "rgba(176,92,230,0.3)",
              border: "none",
              fontFamily: FONT,
            }}
          >
            <Loader2 className="w-4 h-4 animate-spin" />
            {status === "queued" ? "Queued…" : "Generating…"}
          </button>
        )}

        {styleWarning && (
          <div
            className="flex items-start gap-2 mt-2.5 px-3 py-2 rounded-xl text-[11px]"
            style={{ background: "rgba(255,179,71,0.1)", color: "#C67A00" }}
          >
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <span>
              {styleWarning === "no_style_guide" &&
                "No style guide found — using default style."}
              {styleWarning === "style_not_locked" &&
                "Style guide not locked yet — lock it in Design for best results."}
              {styleWarning === "no_reference_image" &&
                "No style reference image — add one in Design for consistency."}
            </span>
          </div>
        )}

        {error && (
          <div
            className="flex items-start gap-2 mt-2.5 px-3 py-2 rounded-xl text-[11px]"
            style={{ background: "rgba(233,30,99,0.06)", color: "#E91E63" }}
          >
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
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
    </>
  );
}

/* ------------------------------------------------------------------ */
/* MAIN MOBILE PREVIEW COMPONENT                                      */
/* ------------------------------------------------------------------ */

export default function MobilePreview({
  storyId,
  storyTitle,
  onContinue,
}: {
  storyId: string;
  storyTitle: string;
  onContinue: () => void;
}) {
  const [spreads, setSpreads] = useState<SpreadOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [previewGeneratedId, setPreviewGeneratedId] = useState<string | null>(
    null
  );
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    setFetchError(null);

    fetch(`/api/stories/${storyId}/spreads-preview`)
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
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

        const existing = unique.find((s) => s.existingImageUrl);
        if (existing) {
          setPreviewGeneratedId(existing.spreadId);
        }
      })
      .catch((e) => setFetchError(e.message ?? "Failed to load spreads"))
      .finally(() => setLoading(false));
  }, [storyId]);

  const selected = spreads.find((s) => s.spreadId === selectedId) ?? null;
  const hasUsedFreePreview = !!previewGeneratedId;

  return (
    <div
      className="w-full flex flex-col pb-6"
      style={{ background: "#FDFBFF", fontFamily: FONT, minHeight: "100%" }}
    >
      <div className="px-4 pt-5 pb-3">
        <h1
          className="text-xl font-extrabold flex items-center gap-2"
          style={{ color: "#2D2235", letterSpacing: "-0.02em" }}
        >
          <span className="text-lg">👁️</span>
          Preview Your Book
        </h1>
        <p
          className="text-sm mt-1.5 leading-relaxed"
          style={{ color: "#8B7BA0" }}
        >
          Pick a spread and generate a sample illustration using your
          characters, locations, and style.
        </p>
      </div>

      <div
        className="mx-4 mb-4 px-3.5 py-3 rounded-xl flex items-start gap-2.5"
        style={{
          background: "rgba(176,92,230,0.06)",
          border: "1px solid rgba(176,92,230,0.1)",
        }}
      >
        <Sparkles
          className="w-4 h-4 flex-shrink-0 mt-0.5"
          style={{ color: "#B05CE6" }}
        />
        <p className="text-[12px] leading-relaxed" style={{ color: "#7B4DAA" }}>
          Generate a sample, then tap <strong>Redraw</strong> to swap
          characters, change outfits, or give feedback.
        </p>
      </div>

      {fetchError && (
        <div
          className="mx-4 mb-4 px-3.5 py-3 rounded-xl flex items-start gap-2.5"
          style={{
            background: "rgba(233,30,99,0.06)",
            border: "1px solid rgba(233,30,99,0.1)",
          }}
        >
          <AlertCircle
            className="w-4 h-4 flex-shrink-0 mt-0.5"
            style={{ color: "#E91E63" }}
          />
          <p className="text-[12px]" style={{ color: "#E91E63" }}>
            {fetchError}
          </p>
        </div>
      )}

      <div className="mb-4">
        <p
          className="px-4 mb-2.5 text-[10px] font-bold uppercase tracking-widest"
          style={{ color: "#A897BD" }}
        >
          Choose a spread
        </p>

        {loading ? (
          <div className="flex gap-3 px-4 overflow-hidden">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="flex-shrink-0 rounded-2xl animate-pulse"
                style={{
                  width: 140,
                  height: 100,
                  background: "rgba(176,92,230,0.08)",
                }}
              />
            ))}
          </div>
        ) : (
          <div
            ref={scrollerRef}
            className="flex gap-3 px-4 overflow-x-auto pb-2"
            style={{
              scrollSnapType: "x mandatory",
              WebkitOverflowScrolling: "touch",
            }}
          >
            {spreads.map((s, i) => (
              <SpreadThumb
                key={s.spreadId}
                spread={s}
                index={i}
                selected={s.spreadId === selectedId}
                onSelect={() => setSelectedId(s.spreadId)}
              />
            ))}
          </div>
        )}
      </div>

      {selected && (
        <>
          <MobileGenerationSection
            spread={selected}
            storyId={storyId}
            isLocked={
              hasUsedFreePreview && previewGeneratedId !== selected.spreadId
            }
            onGenerated={() => setPreviewGeneratedId(selected.spreadId)}
          />

          <div className="px-4 pt-4 space-y-3">
            <div
              className="rounded-2xl p-4"
              style={{
                background: "white",
                border: "1px solid rgba(180,150,210,0.1)",
              }}
            >
              <p
                className="text-[10px] font-bold uppercase tracking-widest mb-2"
                style={{ color: "#B05CE6" }}
              >
                Story Text
              </p>
              <p
                className="text-sm leading-relaxed"
                style={{ color: "#2D2235", fontFamily: "'Lora', serif" }}
              >
                {selected.leftText}
                {selected.rightText ? ` ${selected.rightText}` : ""}
              </p>
            </div>

            {(selected.characters.length > 0 || selected.location) && (
              <div
                className="rounded-2xl px-4 py-3.5"
                style={{
                  background: "white",
                  border: "1px solid rgba(180,150,210,0.1)",
                }}
              >
                <p
                  className="text-[10px] font-bold uppercase tracking-widest mb-3 flex items-center gap-1.5"
                  style={{ color: "#A897BD" }}
                >
                  <Users className="w-3 h-3" /> In this scene
                </p>
                <div className="flex flex-wrap gap-4">
                  {selected.characters.map((c, i) => {
                    const accent = accentFor(i);
                    return (
                      <div
                        key={c.id}
                        className="flex flex-col items-center gap-1.5"
                      >
                        <div
                          className="w-12 h-12 rounded-full overflow-hidden flex-shrink-0"
                          style={{
                            border: "2px solid white",
                            boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                          }}
                        >
                          {c.imageUrl ? (
                            <img
                              src={c.imageUrl}
                              alt={c.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div
                              className="w-full h-full flex items-center justify-center"
                              style={{
                                background: `linear-gradient(135deg, ${accent.from}, ${accent.to})`,
                              }}
                            >
                              <span className="text-white font-bold text-sm">
                                {c.name[0]}
                              </span>
                            </div>
                          )}
                        </div>
                        <span
                          className="text-[11px] font-semibold"
                          style={{ color: "#5A4D6B" }}
                        >
                          {c.name}
                        </span>
                      </div>
                    );
                  })}

                  {selected.location && (
                    <div className="flex flex-col items-center gap-1.5">
                      <div
                        className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0"
                        style={{
                          border: "2px solid white",
                          boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                        }}
                      >
                        {selected.location.imageUrl ? (
                          <img
                            src={selected.location.imageUrl}
                            alt={selected.location.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div
                            className="w-full h-full flex items-center justify-center"
                            style={{
                              background:
                                "linear-gradient(135deg, #34D399, #60A5FA)",
                            }}
                          >
                            <MapPin className="w-4 h-4 text-white" />
                          </div>
                        )}
                      </div>
                      <span
                        className="text-[11px] font-semibold"
                        style={{ color: "#5A4D6B" }}
                      >
                        {selected.location.name}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {selected.scene && (
              <div
                className="rounded-xl px-3.5 py-3 flex items-start gap-2.5"
                style={{
                  background: "rgba(176,92,230,0.05)",
                  border: "1px solid rgba(176,92,230,0.1)",
                }}
              >
                <Sparkles
                  className="w-3.5 h-3.5 flex-shrink-0 mt-0.5"
                  style={{ color: "#B05CE6" }}
                />
                <div>
                  <p
                    className="text-[12px] leading-relaxed"
                    style={{ color: "#6B4D8A" }}
                  >
                    {selected.scene}
                  </p>
                  {selected.mood && (
                    <p
                      className="text-[10px] mt-1 font-bold uppercase tracking-wider"
                      style={{ color: "#B05CE6" }}
                    >
                      Mood: {selected.mood}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {spreads.length > 0 && (
        <div className="px-4 pt-6">
          <button
            onClick={onContinue}
            className="w-full py-4 rounded-2xl text-sm font-bold text-white flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
            style={{
              background: "linear-gradient(135deg, #B05CE6, #E91E8C)",
              boxShadow: "0 4px 16px rgba(176,92,230,0.25)",
              border: "none",
              fontFamily: FONT,
            }}
          >
            Continue to Order
            <ChevronRight className="w-4 h-4" />
          </button>
          <p className="text-center text-[11px] mt-2" style={{ color: "#A897BD" }}>
            Happy with your style? Move on to checkout.
          </p>
        </div>
      )}
    </div>
  );
}