// src/app/stories/[id]/characters/components/PhotoSuggestions.tsx
"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Check,
  X,
  ChevronRight,
  Loader2,
  Shirt,
  Eye,
  FileText,
} from "lucide-react";

type Suggestions = {
  appearance: string;
  appearanceConfidence: "high" | "medium" | "low";
  outfit: string;
  outfitStyle: string;
  enrichedDescription: string | null;
  notes: string | null;
};

type PhotoAnalysis = {
  status: "pending" | "ready" | "handled";
  suggestions?: Suggestions;
  imageUrl?: string;
};

export default function PhotoSuggestions({
  characterId,
  storyId,
  analysis,
  currentAppearance,
  currentDescription,
  onAccepted,
}: {
  characterId: string;
  storyId: string;
  analysis: PhotoAnalysis;
  currentAppearance: string | null;
  currentDescription: string | null;
  onAccepted: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);

  // Individual accept states
  const [acceptAppearance, setAcceptAppearance] = useState(true);
  const [acceptDescription, setAcceptDescription] = useState(true);
  const [createOutfit, setCreateOutfit] = useState(false); // default false — user must opt in
  const [showOutfitQuestion, setShowOutfitQuestion] = useState(false);

  // Editable versions of suggestions
  const [editedAppearance, setEditedAppearance] = useState(
    analysis.suggestions?.appearance || ""
  );
  const [editedDescription, setEditedDescription] = useState(
    analysis.suggestions?.enrichedDescription || ""
  );
  const [editedOutfit, setEditedOutfit] = useState(
    analysis.suggestions?.outfit || ""
  );
  const [outfitLabel, setOutfitLabel] = useState(
    analysis.suggestions?.outfitStyle || "reference_photo"
  );

  if (analysis.status === "pending") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-2.5 px-4 py-3 rounded-xl"
        style={{
          background: "linear-gradient(135deg, rgba(232,213,255,0.5), rgba(255,213,229,0.5))",
          border: "1px solid rgba(199,125,255,0.15)",
        }}
      >
        <Loader2
          className="w-4 h-4 animate-spin flex-shrink-0"
          style={{ color: "#9B59D0" }}
        />
        <span className="text-[12px] font-medium" style={{ color: "#6B5C80" }}>
          Analysing your photo…
        </span>
      </motion.div>
    );
  }

  if (analysis.status !== "ready" || !analysis.suggestions) return null;

  const suggestions = analysis.suggestions;
  const hasDescriptionSuggestion = !!suggestions.enrichedDescription;

  const [accepted, setAccepted] = useState(false);
  const [generating, setGenerating] = useState(false);

  async function handleAccept() {
    setSaving(true);
    try {
      const res = await fetch(
        `/api/characters/${characterId}/accept-suggestions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            storyId,
            acceptAppearance,
            acceptDescription: acceptDescription && hasDescriptionSuggestion,
            createOutfit,
            customAppearance: editedAppearance,
            customDescription: editedDescription || undefined,
            customOutfitDescription: editedOutfit || undefined,
            outfitLabel,
          }),
        }
      );

      if (res.ok) {
        setAccepted(true);
        setSaving(false);
      }
    } catch {
      setSaving(false);
    }
  }

  async function handleGenerate(outfitMode: "story" | "reference") {
    setGenerating(true);
    try {
      const res = await fetch("/api/characters/use-ai-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterId, outfitMode }),
      });

      if (res.ok) {
        onAccepted(); // refresh
      }
    } finally {
      setGenerating(false);
    }
  }

  function handleDismiss() {
    // Mark as handled without accepting anything
    fetch(`/api/characters/${characterId}/accept-suggestions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        storyId,
        acceptAppearance: false,
        acceptDescription: false,
        createOutfit: false,
      }),
    }).then(() => onAccepted());
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl overflow-hidden"
      style={{
        background: "white",
        border: "1.5px solid rgba(199,125,255,0.2)",
        boxShadow: "0 4px 16px rgba(176,92,230,0.08)",
        fontFamily: "'Bricolage Grotesque', system-ui, sans-serif",
      }}
    >
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3.5"
        style={{
          background: "linear-gradient(135deg, rgba(232,213,255,0.4), rgba(255,213,229,0.4))",
          border: "none",
          cursor: "pointer",
          fontFamily: "inherit",
        }}
      >
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: "linear-gradient(135deg, #C77DFF, #E07ABA)" }}
        >
          <Sparkles className="w-3.5 h-3.5 text-white" />
        </div>
        <div className="flex-1 text-left">
          <span className="text-[13px] font-bold" style={{ color: "#2D2235" }}>
            Photo Analysed
          </span>
          <span
            className="text-[11px] ml-2"
            style={{ color: "#9B59D0" }}
          >
            Review suggestions
          </span>
        </div>
        <ChevronRight
          className="w-4 h-4 transition-transform"
          style={{
            color: "#A897BD",
            transform: expanded ? "rotate(90deg)" : "none",
          }}
        />
      </button>

      {/* Expanded content */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="px-4 py-4 space-y-4" style={{ borderTop: "1px solid rgba(180,150,210,0.1)" }}>
              {/* Notes */}
              {suggestions.notes && (
                <p className="text-[11px] italic" style={{ color: "#A897BD" }}>
                  💡 {suggestions.notes}
                </p>
              )}

              {/* Appearance suggestion */}
              <SuggestionField
                icon={<Eye className="w-3.5 h-3.5" />}
                label="Appearance"
                current={currentAppearance}
                suggested={editedAppearance}
                accepted={acceptAppearance}
                onToggle={() => setAcceptAppearance(!acceptAppearance)}
                onEdit={setEditedAppearance}
                confidence={suggestions.appearanceConfidence}
              />

              {/* Description suggestion */}
              {hasDescriptionSuggestion && (
                <SuggestionField
                  icon={<FileText className="w-3.5 h-3.5" />}
                  label="Description"
                  current={currentDescription}
                  suggested={editedDescription}
                  accepted={acceptDescription}
                  onToggle={() => setAcceptDescription(!acceptDescription)}
                  onEdit={setEditedDescription}
                />
              )}

              {/* Outfit */}
              <div
                className="rounded-xl p-3.5"
                style={{
                  background: createOutfit
                    ? "rgba(67,184,156,0.06)"
                    : "rgba(200,180,220,0.06)",
                  border: createOutfit
                    ? "1px solid rgba(67,184,156,0.15)"
                    : "1px solid rgba(180,150,210,0.08)",
                  transition: "all 0.2s",
                }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Shirt className="w-3.5 h-3.5" style={{ color: "#9B59D0" }} />
                  <span className="text-[11px] font-bold uppercase" style={{ color: "#6B5C80", letterSpacing: "0.08em" }}>
                    Detected Outfit
                  </span>
                  <span
                    className="text-[10px] ml-auto px-2 py-0.5 rounded-full"
                    style={{ background: "rgba(199,125,255,0.08)", color: "#9B59D0" }}
                  >
                    {suggestions.outfitStyle}
                  </span>
                </div>

                <p className="text-[12px] leading-relaxed mb-3" style={{ color: "#5A4D6B" }}>
                  {suggestions.outfit}
                </p>

                {!showOutfitQuestion && !createOutfit && (
                  <button
                    onClick={() => setShowOutfitQuestion(true)}
                    className="text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-colors"
                    style={{
                      background: "rgba(199,125,255,0.08)",
                      color: "#9B59D0",
                      border: "none",
                      cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    Save as character outfit?
                  </button>
                )}

                {showOutfitQuestion && !createOutfit && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-2"
                  >
                    <p className="text-[11px] font-medium" style={{ color: "#6B5C80" }}>
                      Is this what they typically wear in the story?
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setCreateOutfit(true);
                          setShowOutfitQuestion(false);
                        }}
                        className="flex-1 py-2 rounded-lg text-[11px] font-bold text-white"
                        style={{
                          background: "linear-gradient(135deg, #43B89C, #2FA482)",
                          border: "none",
                          cursor: "pointer",
                          fontFamily: "inherit",
                        }}
                      >
                        Yes — save this outfit
                      </button>
                      <button
                        onClick={() => setShowOutfitQuestion(false)}
                        className="flex-1 py-2 rounded-lg text-[11px] font-semibold"
                        style={{
                          background: "white",
                          border: "1.5px solid rgba(180,150,210,0.15)",
                          color: "#6B5C80",
                          cursor: "pointer",
                          fontFamily: "inherit",
                        }}
                      >
                        No — just for reference
                      </button>
                    </div>
                  </motion.div>
                )}

                {createOutfit && (
                  <div className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5" style={{ color: "#2FA482" }} />
                    <span className="text-[11px] font-semibold" style={{ color: "#2FA482" }}>
                      Will save as "{outfitLabel}" outfit
                    </span>
                    <button
                      onClick={() => setCreateOutfit(false)}
                      className="ml-auto text-[10px]"
                      style={{ color: "#A897BD", background: "none", border: "none", cursor: "pointer" }}
                    >
                      undo
                    </button>
                  </div>
                )}
              </div>

              {/* Actions */}
              {!accepted ? (
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={handleDismiss}
                    className="flex-1 py-2.5 rounded-xl text-[12px] font-semibold"
                    style={{
                      border: "1.5px solid rgba(180,150,210,0.15)",
                      background: "white",
                      color: "#8B7BA0",
                      cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    Dismiss All
                  </button>
                  <button
                    onClick={handleAccept}
                    disabled={saving || (!acceptAppearance && !acceptDescription && !createOutfit)}
                    className="flex-1 py-2.5 rounded-xl text-[12px] font-bold text-white flex items-center justify-center gap-1.5 disabled:opacity-40"
                    style={{
                      background: "linear-gradient(135deg, #B05CE6, #D45DA0)",
                      boxShadow: "0 3px 12px rgba(176,92,230,0.2)",
                      border: "none",
                      cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    {saving ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Check className="w-3.5 h-3.5" />
                    )}
                    Apply Selected
                  </button>
                </div>
              ) : (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-2.5 pt-1"
                >
                  <div className="flex items-center gap-2 py-2">
                    <Check className="w-4 h-4" style={{ color: "#2FA482" }} />
                    <span className="text-[12px] font-semibold" style={{ color: "#2FA482" }}>
                      Details updated! Now generate a portrait?
                    </span>
                  </div>

                  {generating ? (
                    <div
                      className="flex items-center justify-center gap-2 py-4 rounded-xl"
                      style={{ background: "rgba(232,213,255,0.3)" }}
                    >
                      <Loader2 className="w-5 h-5 animate-spin" style={{ color: "#9B59D0" }} />
                      <span className="text-[13px] font-semibold" style={{ color: "#6B5C80" }}>
                        Generating portrait…
                      </span>
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={() => handleGenerate("story")}
                        className="w-full py-3 rounded-xl text-[13px] font-bold text-white flex items-center justify-center gap-2"
                        style={{
                          background: "linear-gradient(135deg, #B05CE6, #D45DA0)",
                          boxShadow: "0 3px 12px rgba(176,92,230,0.2)",
                          border: "none",
                          cursor: "pointer",
                          fontFamily: "inherit",
                        }}
                      >
                        <Sparkles className="w-4 h-4" />
                        Generate with story outfit
                      </button>
                      <button
                        onClick={() => handleGenerate("reference")}
                        className="w-full py-3 rounded-xl text-[13px] font-semibold flex items-center justify-center gap-2"
                        style={{
                          border: "1.5px solid rgba(180,150,210,0.18)",
                          background: "white",
                          color: "#6B5C80",
                          cursor: "pointer",
                          fontFamily: "inherit",
                        }}
                      >
                        <Shirt className="w-4 h-4" />
                        Generate with photo's outfit
                      </button>
                      <button
                        onClick={onAccepted}
                        className="w-full py-2 text-[11px] font-medium"
                        style={{
                          background: "none",
                          border: "none",
                          color: "#A897BD",
                          cursor: "pointer",
                          fontFamily: "inherit",
                        }}
                      >
                        Skip — I'll generate later
                      </button>
                    </>
                  )}
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* SUGGESTION FIELD                                                    */
/* ------------------------------------------------------------------ */

function SuggestionField({
  icon,
  label,
  current,
  suggested,
  accepted,
  onToggle,
  onEdit,
  confidence,
}: {
  icon: React.ReactNode;
  label: string;
  current: string | null;
  suggested: string;
  accepted: boolean;
  onToggle: () => void;
  onEdit: (val: string) => void;
  confidence?: string;
}) {
  const [editing, setEditing] = useState(false);

  return (
    <div
      className="rounded-xl p-3.5"
      style={{
        background: accepted ? "rgba(67,184,156,0.06)" : "rgba(200,180,220,0.04)",
        border: accepted
          ? "1px solid rgba(67,184,156,0.15)"
          : "1px solid rgba(180,150,210,0.08)",
        transition: "all 0.2s",
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        <span style={{ color: "#9B59D0" }}>{icon}</span>
        <span
          className="text-[11px] font-bold uppercase"
          style={{ color: "#6B5C80", letterSpacing: "0.08em" }}
        >
          {label}
        </span>
        {confidence && (
          <span
            className="text-[9px] px-1.5 py-0.5 rounded ml-1"
            style={{
              background:
                confidence === "high"
                  ? "rgba(67,184,156,0.1)"
                  : confidence === "medium"
                  ? "rgba(251,191,36,0.1)"
                  : "rgba(239,68,68,0.1)",
              color:
                confidence === "high"
                  ? "#2FA482"
                  : confidence === "medium"
                  ? "#D97706"
                  : "#DC2626",
              fontWeight: 700,
            }}
          >
            {confidence}
          </span>
        )}
        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={() => setEditing(!editing)}
            className="text-[10px] font-medium px-1.5 py-0.5 rounded"
            style={{ color: "#9B59D0", background: "none", border: "none", cursor: "pointer" }}
          >
            {editing ? "done" : "edit"}
          </button>
          <button
            onClick={onToggle}
            className="w-6 h-6 rounded-lg flex items-center justify-center"
            style={{
              background: accepted
                ? "linear-gradient(135deg, #43B89C, #2FA482)"
                : "rgba(180,150,210,0.1)",
              border: "none",
              cursor: "pointer",
            }}
          >
            {accepted ? (
              <Check className="w-3 h-3 text-white" />
            ) : (
              <X className="w-3 h-3" style={{ color: "#A897BD" }} />
            )}
          </button>
        </div>
      </div>

      {current && !editing && (
        <p className="text-[10px] mb-1.5" style={{ color: "#A897BD" }}>
          Current: <span className="italic">{current.slice(0, 80)}…</span>
        </p>
      )}

      {editing ? (
        <textarea
          value={suggested}
          onChange={(e) => onEdit(e.target.value)}
          rows={3}
          className="w-full rounded-lg px-3 py-2 text-[12px] leading-relaxed outline-none resize-none"
          style={{
            border: "1.5px solid rgba(199,125,255,0.2)",
            background: "white",
            color: "#2D2235",
            fontFamily: "inherit",
          }}
        />
      ) : (
        <p className="text-[12px] leading-relaxed" style={{ color: "#5A4D6B" }}>
          {suggested}
        </p>
      )}
    </div>
  );
}