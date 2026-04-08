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

  // Palette values can be strings ("warm orange") or arrays (["warm orange", "bright green"])
  // Flatten into a simple list for display
  const paletteColors = style?.colorPalette
    ? [style.colorPalette.primary, style.colorPalette.secondary, style.colorPalette.accent]
        .flat()
        .filter((v): v is string => typeof v === "string" && v.length > 0)
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
      // 1. Upload to Cloudinary
      const formData = new FormData();
      formData.append("file", file);

      const uploadRes = await fetch(`/api/stories/${storyId}/style-guide/upload`, {
        method: "POST",
        body: formData,
      });

      if (!uploadRes.ok) throw new Error("Upload failed");
      const { url } = await uploadRes.json();
      setPreviewImageUrl(url);

      // 2. Analyse with Claude vision
      const analyseRes = await fetch(`/api/stories/${storyId}/style-guide/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: url }),
      });

      if (analyseRes.ok) {
        const v = await analyseRes.json();
        if (v.summary) setEditVision(v.summary);
        if (v.artStyle) setEditArtStyle(v.artStyle);
        if (v.negativePrompt) setEditNegative(v.negativePrompt);

        // 3. Save everything including internal fields that go straight to the DB
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

                  {/* Colour palette */}
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