// src/app/stories/[id]/illustration-style/IllustrationStyleClient.tsx
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check,
  ChevronDown,
  Loader2,
  Paintbrush,
  Sparkles,
  Upload,
  X,
  ArrowLeft,
} from "lucide-react";
import UnifiedStoryHeader from "@/app/stories/components/StoryHeader";
import { getNextStepHref, type StepKey } from "@/lib/storySteps";

/* ─────────────── Types ─────────────── */

type StyleGuide = {
  id?: string;
  userNotes: string | null;
  artStyle: string | null;
  colorPalette: {
    primary?: string | string[];
    secondary?: string | string[];
    accent?: string | string[];
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
  storyConfirmed,
}: {
  storyId: string;
  title: string;
  currentStep?: StepKey;
  completedSteps?: StepKey[];
  initialStyleGuide: StyleGuide | null;
  storyConfirmed?: boolean;
}) {
  const router = useRouter();

  const [style, setStyle] = useState<StyleGuide | null>(initialStyleGuide);
  const [isLoading, setIsLoading] = useState(!initialStyleGuide);
  const [isSaving, setIsSaving] = useState(false);
  const [mode, setMode] = useState<"suggest" | "customise">("suggest");
  const [uploadingImage, setUploadingImage] = useState(false);

  // Editable fields
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
    return () => {
      cancelled = true;
    };
  }, [storyId, initialStyleGuide]);

  // Sync edit fields when style loads
  useEffect(() => {
    if (!style) return;
    setEditVision(style.userNotes ?? "");
    setEditArtStyle(style.artStyle ?? "");
    setEditNegative(style.negativePrompt ?? "");
    setPreviewImageUrl(style.sampleIllustrationUrl ?? null);
  }, [style]);

  // Summary for the suggestion card
  const styleSummary = style
    ? [style.userNotes, style.artStyle].filter(Boolean).join(" — ")
    : "";

  const paletteColors = style?.colorPalette
    ? [
        style.colorPalette.primary,
        style.colorPalette.secondary,
        style.colorPalette.accent,
      ]
        .flat()
        .filter((v): v is string => typeof v === "string" && v.length > 0)
    : [];

  /* ── Actions ── */

  const handleAcceptAndContinue = async () => {
    setIsSaving(true);
    try {
      // If user customised, save their edits
      if (mode === "customise") {
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
      const storyRes = await fetch(`/api/stories/${storyId}`, {
        cache: "no-store",
      });
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

  const handleImageUpload = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("image/")) return;
      setUploadingImage(true);

      try {
        const formData = new FormData();
        formData.append("file", file);

        const uploadRes = await fetch(
          `/api/stories/${storyId}/style-guide/upload`,
          { method: "POST", body: formData }
        );
        if (!uploadRes.ok) throw new Error("Upload failed");
        const { url } = await uploadRes.json();
        setPreviewImageUrl(url);

        const analyseRes = await fetch(
          `/api/stories/${storyId}/style-guide/analyze`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ imageUrl: url }),
          }
        );

        if (analyseRes.ok) {
          const v = await analyseRes.json();
          if (v.summary) setEditVision(v.summary);
          if (v.artStyle) setEditArtStyle(v.artStyle);
          if (v.negativePrompt) setEditNegative(v.negativePrompt);

          await fetch(`/api/stories/${storyId}/style-guide`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              summary: v.summary,
              artStyle: v.artStyle,
              visualThemes: v.visualThemes,
              colorPalette: v.colorPalette,
              sampleIllustrationUrl: url,
              promptBase: v.promptBase,
              negativePrompt: v.negativePrompt,
            }),
          });
        }
      } catch (err) {
        console.error("Upload/analyse failed:", err);
      } finally {
        setUploadingImage(false);
      }
    },
    [storyId]
  );

  /* ── Render ── */

  return (
    <>
      <FontLoader />

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
          storyConfirmed={storyConfirmed}
        />

        {/* Content */}
        <div className="max-w-xl mx-auto px-4 sm:px-6 py-10 pb-32">
          {isLoading ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-20 text-center"
            >
              <div
                className="w-16 h-16 rounded-[22px] flex items-center justify-center mb-5"
                style={{
                  background: "linear-gradient(135deg, #E8D5FF, #FFD5E5)",
                }}
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
                Choosing a style for your story…
              </h2>
              <p className="text-sm mt-2" style={{ color: "#7B6E90" }}>
                This only takes a moment.
              </p>
            </motion.div>
          ) : !style ? (
            <div className="text-center py-20">
              <p className="text-sm" style={{ color: "#7B6E90" }}>
                No style guide found. Please go back and try again.
              </p>
            </div>
          ) : (
            <AnimatePresence mode="wait">
              {mode === "suggest" ? (
                /* ════════════════════════════════════════
                   SUGGESTION CARD
                   ════════════════════════════════════════ */
                <motion.div
                  key="suggest"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.3 }}
                >
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
                      style={{
                        borderBottom: "1px solid rgba(180,150,210,0.08)",
                      }}
                    >
                      <div
                        className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0"
                        style={{
                          background:
                            "linear-gradient(135deg, #E8D5FF, #FFD5E5)",
                        }}
                      >
                        <Paintbrush
                          className="w-5 h-5"
                          style={{ color: "#B05CE6" }}
                        />
                      </div>
                      <div>
                        <h2
                          className="text-lg font-extrabold"
                          style={{ color: "#2D2235" }}
                        >
                          Here's the look we'd suggest
                        </h2>
                        <p
                          className="text-sm mt-1 leading-relaxed"
                          style={{ color: "#7B6E90" }}
                        >
                          Based on the tone and characters in your story, we
                          think this style fits. You can always change it.
                        </p>
                      </div>
                    </div>

                    {/* Style content */}
                    <div className="px-6 py-5">
                      {previewImageUrl && (
                        <div className="mb-4 rounded-xl overflow-hidden bg-gray-50 border border-gray-100">
                          <img
                            src={previewImageUrl}
                            alt="Style reference"
                            className="w-full h-44 object-cover"
                          />
                        </div>
                      )}

                      <p
                        className="text-[15px] leading-[1.75]"
                        style={{ color: "#3A2E48" }}
                      >
                        {styleSummary ||
                          "A warm, whimsical children's book illustration style."}
                      </p>

                      {/* Palette */}
                      {paletteColors.length > 0 && (
                        <div className="flex flex-wrap items-center gap-2 mt-4">
                          <span
                            className="text-[11px] font-bold uppercase tracking-wide"
                            style={{ color: "#A897BD" }}
                          >
                            Palette
                          </span>
                          {paletteColors.map((color, i) => (
                            <span
                              key={i}
                              className="text-xs font-medium px-2.5 py-1 rounded-full capitalize"
                              style={{
                                background: "rgba(180,150,210,0.1)",
                                color: "#6B5C80",
                              }}
                            >
                              {color}
                            </span>
                          ))}
                        </div>
                      )}

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

                    {/* Actions */}
                    <div className="px-6 pb-6 space-y-3">
                      <button
                        onClick={handleAcceptAndContinue}
                        disabled={isSaving}
                        className="w-full py-4 rounded-[14px] text-sm font-bold text-white flex items-center justify-center gap-2 transition-all hover:-translate-y-px active:scale-[0.98] disabled:opacity-60 relative overflow-hidden"
                        style={{
                          background:
                            "linear-gradient(135deg, #B05CE6, #D45DA0)",
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
                        onClick={() => setMode("customise")}
                        className="w-full py-3 rounded-[14px] text-sm font-semibold flex items-center justify-center gap-2 transition-all hover:bg-[rgba(180,150,210,0.04)]"
                        style={{
                          background: "transparent",
                          color: "#7B6E90",
                          border: "1px solid rgba(180,150,210,0.2)",
                        }}
                      >
                        <Paintbrush className="w-3.5 h-3.5" />
                        I'd like to change something
                      </button>
                    </div>
                  </div>
                </motion.div>
              ) : (
                /* ════════════════════════════════════════
                   CUSTOMISE CARD — replaces suggestion
                   ════════════════════════════════════════ */
                <motion.div
                  key="customise"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.3 }}
                >
                  <div
                    className="rounded-[22px] border overflow-hidden"
                    style={{
                      background: "white",
                      borderColor: "rgba(180,150,210,0.12)",
                      boxShadow:
                        "0 2px 8px rgba(100,60,140,0.05), 0 12px 40px rgba(100,60,140,0.07)",
                    }}
                  >
                    {/* Header with back */}
                    <div
                      className="px-6 py-4 flex items-center justify-between border-b"
                      style={{ borderColor: "rgba(180,150,210,0.08)" }}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                          style={{
                            background:
                              "linear-gradient(135deg, #E8D5FF, #FFD5E5)",
                          }}
                        >
                          <Paintbrush
                            className="w-4 h-4"
                            style={{ color: "#B05CE6" }}
                          />
                        </div>
                        <div>
                          <h3
                            className="text-[15px] font-bold"
                            style={{ color: "#2D2235" }}
                          >
                            Customise your style
                          </h3>
                          <p
                            className="text-[11px] mt-0.5"
                            style={{ color: "#A897BD" }}
                          >
                            Edit anything below, or upload an image you like.
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => setMode("suggest")}
                        className="text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-all hover:bg-[rgba(180,150,210,0.06)]"
                        style={{
                          color: "#8B7BA0",
                          border: "1px solid rgba(180,150,210,0.15)",
                          background: "transparent",
                          cursor: "pointer",
                          fontFamily: "inherit",
                        }}
                      >
                        ← Back
                      </button>
                    </div>

                    {/* Fields */}
                    <div className="px-6 py-5 space-y-5">
                      {/* Reference image */}
                      <div>
                        <label
                          className="text-[11px] font-bold uppercase tracking-wide block mb-2"
                          style={{ color: "#6B5C80" }}
                        >
                          Reference image
                        </label>
                        <p
                          className="text-xs mb-3 leading-relaxed"
                          style={{ color: "#A897BD" }}
                        >
                          Got an illustration style you love? Upload it and
                          we'll match the feel.
                        </p>

                        {previewImageUrl ? (
                          <div className="relative rounded-xl overflow-hidden border" style={{ borderColor: "rgba(180,150,210,0.12)" }}>
                            <img
                              src={previewImageUrl}
                              alt="Style reference"
                              className="w-full h-36 object-cover"
                            />
                            <button
                              onClick={() => setPreviewImageUrl(null)}
                              className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center transition-colors"
                              style={{
                                background: "rgba(0,0,0,0.5)",
                                color: "white",
                                border: "none",
                                cursor: "pointer",
                              }}
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploadingImage}
                            className="w-full py-7 rounded-xl border-2 border-dashed flex flex-col items-center gap-2 transition-all hover:border-[#C77DFF] hover:bg-[rgba(199,125,255,0.03)]"
                            style={{
                              borderColor: "rgba(180,150,210,0.25)",
                              background: "rgba(200,180,220,0.04)",
                              color: "#8B7BA0",
                              cursor: "pointer",
                              fontFamily: "inherit",
                            }}
                          >
                            {uploadingImage ? (
                              <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                              <Upload className="w-5 h-5" />
                            )}
                            <span className="text-xs font-semibold">
                              {uploadingImage
                                ? "Analysing your image…"
                                : "Tap to upload"}
                            </span>
                          </button>
                        )}
                      </div>

                      {/* Divider */}
                      <div
                        className="h-px"
                        style={{ background: "rgba(180,150,210,0.08)" }}
                      />

                      {/* Overall feel */}
                      <div>
                        <label
                          className="text-[11px] font-bold uppercase tracking-wide block mb-1.5"
                          style={{ color: "#6B5C80" }}
                        >
                          Overall feel
                        </label>
                        <p
                          className="text-xs mb-2"
                          style={{ color: "#A897BD" }}
                        >
                          Describe the vibe in your own words.
                        </p>
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
                          }}
                          placeholder="e.g. Warm and cosy, like a bedtime story…"
                        />
                      </div>

                      {/* Art style */}
                      <div>
                        <label
                          className="text-[11px] font-bold uppercase tracking-wide block mb-1.5"
                          style={{ color: "#6B5C80" }}
                        >
                          Art style
                        </label>
                        <p
                          className="text-xs mb-2"
                          style={{ color: "#A897BD" }}
                        >
                          The illustration technique — watercolour, digital
                          cartoon, pencil sketch, etc.
                        </p>
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
                          }}
                          placeholder="e.g. Soft watercolour with ink outlines"
                        />
                      </div>

                      {/* What to avoid */}
                      <div>
                        <label
                          className="text-[11px] font-bold uppercase tracking-wide block mb-1.5"
                          style={{ color: "#6B5C80" }}
                        >
                          Anything to avoid?
                        </label>
                        <p
                          className="text-xs mb-2"
                          style={{ color: "#A897BD" }}
                        >
                          Styles or elements you definitely don't want.
                        </p>
                        <input
                          value={editNegative}
                          onChange={(e) => setEditNegative(e.target.value)}
                          className="w-full rounded-xl border px-4 py-3 text-sm focus:outline-none focus:ring-2 transition-all"
                          style={{
                            borderColor: "rgba(180,150,210,0.18)",
                            background: "#FDFBFF",
                            color: "#2D2235",
                            fontFamily: "inherit",
                          }}
                          placeholder="e.g. Photorealism, scary imagery"
                        />
                      </div>
                    </div>

                    {/* Save */}
                    <div className="px-6 pb-6">
                      <button
                        onClick={handleAcceptAndContinue}
                        disabled={isSaving}
                        className="w-full py-4 rounded-[14px] text-sm font-bold text-white flex items-center justify-center gap-2 transition-all hover:-translate-y-px active:scale-[0.98] disabled:opacity-60 relative overflow-hidden"
                        style={{
                          background:
                            "linear-gradient(135deg, #B05CE6, #D45DA0)",
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
                          {isSaving ? "Saving…" : "Save & continue"}
                        </span>
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </div>
      </div>
    </>
  );
}