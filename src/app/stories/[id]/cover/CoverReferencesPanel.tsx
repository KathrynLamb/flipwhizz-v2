// src/app/stories/[id]/cover/CoverReferencesPanel.tsx
"use client";

import { useState, useEffect } from "react";
import {
  User, MapPin, Palette, AlertTriangle,
  ChevronDown, ChevronUp, Sparkles, CheckCircle,
  Layers, Eye,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

/* ------------------------------------------------------------------ */
/* TYPES                                                               */
/* ------------------------------------------------------------------ */

type CoverCharacter = {
  id: string;
  name: string;
  portraitUrl: string | null;
  referenceUrl: string | null;
  appearance: string | null;
  species: string | null;
  breed: string | null;
  hasPortrait: boolean;
  isAnimal: boolean;
};

type CoverLocation = {
  id: string;
  name: string;
  imageUrl: string | null;
};

type CoverStyleRef = {
  url: string | null;
  isUploadedStyle: boolean;
  artStyle: string | null;
  summary: string | null;
};

type CoverPlanSummary = {
  approach: string;
  hasGenerationStrategy: boolean;
  front: { titleText: string; authorText?: string; visualIntent: string } | null;
  back: { blurbText?: string; dedicationText?: string; visualIntent: string } | null;
  spine: { spineText: string } | null;
  pass1Prompt: string | null;
  pass2Prompt: string | null;
};

type CoverReferences = {
  characters: CoverCharacter[];
  location: CoverLocation | null;
  styleRef: CoverStyleRef;
  coverPlan: CoverPlanSummary;
};

const FONT = "'Bricolage Grotesque', system-ui, sans-serif";

/* ------------------------------------------------------------------ */
/* SECTION HEADER                                                      */
/* ------------------------------------------------------------------ */

function SectionHeader({
  icon: Icon,
  label,
  badge,
  warning,
}: {
  icon: any;
  label: string;
  badge?: string;
  warning?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <Icon
        className="w-3.5 h-3.5 flex-shrink-0"
        style={{ color: warning ? "#F59E0B" : "#B05CE6" }}
      />
      <span
        className="text-[11px] font-bold uppercase tracking-wide"
        style={{ color: "#6B5C80" }}
      >
        {label}
      </span>
      {badge && (
        <span
          className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
          style={{ background: "rgba(176,92,230,0.1)", color: "#8B5CB8" }}
        >
          {badge}
        </span>
      )}
      {warning && (
        <AlertTriangle className="w-3 h-3 ml-auto" style={{ color: "#F59E0B" }} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* MAIN COMPONENT                                                      */
/* ------------------------------------------------------------------ */

export default function CoverReferencesPanel({ storyId }: { storyId: string }) {
  const [refs, setRefs] = useState<CoverReferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPrompts, setShowPrompts] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    fetch(`/api/stories/${storyId}/cover-references`)
      .then(r => r.json())
      .then(data => {
        setRefs(data);
        setLoading(false);
      })
      .catch(err => {
        setError("Failed to load references");
        setLoading(false);
      });
  }, [storyId]);

  const missingPortraits = refs?.characters.filter(c => !c.hasPortrait) ?? [];
  const hasIssues = missingPortraits.length > 0 || !refs?.styleRef.url;

  return (
    <div
      className="rounded-[22px] overflow-hidden flex-shrink-0"
      style={{
        background: "white",
        border: `1px solid ${hasIssues ? "rgba(245,158,11,0.3)" : "rgba(180,150,210,0.12)"}`,
        boxShadow: "0 2px 12px rgba(100,60,140,0.06)",
        fontFamily: FONT,
      }}
    >
      {/* Header — always visible */}
      <button
        onClick={() => setIsOpen(v => !v)}
        className="w-full flex items-center gap-3 px-5 py-3 transition-colors hover:bg-[rgba(180,150,210,0.03)]"
        style={{ borderBottom: isOpen ? "1px solid rgba(180,150,210,0.08)" : "none" }}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Eye className="w-4 h-4 flex-shrink-0" style={{ color: hasIssues ? "#F59E0B" : "#B05CE6" }} />
          <p className="text-sm font-bold text-left" style={{ color: "#2D2235" }}>
            What Gemini Receives
          </p>
          {hasIssues && (
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
              style={{ background: "rgba(245,158,11,0.1)", color: "#D97706" }}
            >
              {missingPortraits.length} issue{missingPortraits.length !== 1 ? "s" : ""}
            </span>
          )}
          {!hasIssues && !loading && (
            <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#2FA482" }} />
          )}
        </div>
        {isOpen
          ? <ChevronUp className="w-4 h-4 flex-shrink-0" style={{ color: "#A897BD" }} />
          : <ChevronDown className="w-4 h-4 flex-shrink-0" style={{ color: "#A897BD" }} />
        }
      </button>

      {/* Expandable body */}
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            <div className="px-5 py-4 space-y-5">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "rgba(176,92,230,0.3)", borderTopColor: "#B05CE6" }} />
                </div>
              ) : error ? (
                <p className="text-xs text-center py-4" style={{ color: "#E91E63" }}>{error}</p>
              ) : refs ? (
                <>
                  {/* ── Missing portraits warning ── */}
                  {missingPortraits.length > 0 && (
                    <div
                      className="flex items-start gap-2.5 px-3 py-3 rounded-xl"
                      style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.2)" }}
                    >
                      <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "#D97706" }} />
                      <div>
                        <p className="text-xs font-bold" style={{ color: "#92400E" }}>
                          Missing AI portraits
                        </p>
                        <p className="text-[11px] mt-0.5" style={{ color: "#B45309" }}>
                          {missingPortraits.map(c => c.name).join(", ")} — cover generation will fail without portraits. Go to Characters and generate them first.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* ── Characters ── */}
                  <div>
                    <SectionHeader
                      icon={User}
                      label="Characters"
                      badge={`${refs.characters.length}`}
                      warning={missingPortraits.length > 0}
                    />
                    {refs.characters.length === 0 ? (
                      <p className="text-xs" style={{ color: "#A897BD" }}>No characters selected in cover plan.</p>
                    ) : (
                      <div className="space-y-2">
                        {refs.characters.map(c => (
                          <div
                            key={c.id}
                            className="flex items-center gap-2.5 p-2 rounded-xl"
                            style={{
                              background: c.hasPortrait ? "rgba(67,184,156,0.04)" : "rgba(245,158,11,0.06)",
                              border: `1px solid ${c.hasPortrait ? "rgba(67,184,156,0.12)" : "rgba(245,158,11,0.2)"}`,
                            }}
                          >
                            {/* Portrait */}
                            <div
                              className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0"
                              style={{ border: `2px solid ${c.hasPortrait ? "rgba(67,184,156,0.3)" : "rgba(245,158,11,0.3)"}` }}
                            >
                              {c.portraitUrl && !c.portraitUrl.startsWith("data:image") ? (
                                <img src={c.portraitUrl} alt={c.name} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center" style={{ background: "rgba(180,150,210,0.1)" }}>
                                  <User className="w-4 h-4" style={{ color: "#C4B5D4" }} />
                                </div>
                              )}
                            </div>

                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold truncate" style={{ color: "#2D2235" }}>{c.name}</p>
                              <p className="text-[10px]" style={{ color: "#A897BD" }}>
                                {c.isAnimal ? `${c.breed || c.species}` : "Human"}
                                {" · "}
                                {c.hasPortrait ? (
                                  <span style={{ color: "#2FA482" }}>✓ Portrait ready</span>
                                ) : (
                                  <span style={{ color: "#D97706" }}>⚠ No portrait</span>
                                )}
                              </p>
                            </div>

                            {/* Reference photo if different from portrait */}
                            {c.referenceUrl && c.referenceUrl !== c.portraitUrl && !c.referenceUrl.startsWith("data:image") && (
                              <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0 opacity-60" title="Reference photo">
                                <img src={c.referenceUrl} alt={`${c.name} reference`} className="w-full h-full object-cover" />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* ── Location ── */}
                  <div>
                    <SectionHeader
                      icon={MapPin}
                      label="Location"
                      warning={!refs.location?.imageUrl}
                    />
                    {refs.location ? (
                      <div
                        className="flex items-center gap-2.5 p-2 rounded-xl"
                        style={{
                          background: refs.location.imageUrl ? "rgba(180,150,210,0.04)" : "rgba(245,158,11,0.06)",
                          border: `1px solid ${refs.location.imageUrl ? "rgba(180,150,210,0.12)" : "rgba(245,158,11,0.2)"}`,
                        }}
                      >
                        <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0" style={{ border: "1px solid rgba(180,150,210,0.15)" }}>
                          {refs.location.imageUrl ? (
                            <img src={refs.location.imageUrl} alt={refs.location.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center" style={{ background: "rgba(180,150,210,0.1)" }}>
                              <MapPin className="w-4 h-4" style={{ color: "#C4B5D4" }} />
                            </div>
                          )}
                        </div>
                        <div>
                          <p className="text-xs font-bold" style={{ color: "#2D2235" }}>{refs.location.name}</p>
                          <p className="text-[10px]" style={{ color: refs.location.imageUrl ? "#2FA482" : "#D97706" }}>
                            {refs.location.imageUrl ? "✓ Image available" : "⚠ No image — text only"}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs" style={{ color: "#A897BD" }}>No location selected.</p>
                    )}
                  </div>

                  {/* ── Style reference ── */}
                  <div>
                    <SectionHeader
                      icon={Palette}
                      label="Style reference"
                      warning={!refs.styleRef.url}
                    />
                    {refs.styleRef.url ? (
                      <div className="space-y-2">
                        <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(180,150,210,0.12)" }}>
                          <img src={refs.styleRef.url} alt="Style reference" className="w-full h-20 object-cover" />
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span
                            className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                            style={{ background: refs.styleRef.isUploadedStyle ? "rgba(67,184,156,0.1)" : "rgba(180,150,210,0.1)", color: refs.styleRef.isUploadedStyle ? "#2FA482" : "#8B5CB8" }}
                          >
                            {refs.styleRef.isUploadedStyle ? "Uploaded style" : "Spread fallback"}
                          </span>
                          {refs.styleRef.artStyle && (
                            <span className="text-[10px]" style={{ color: "#A897BD" }}>{refs.styleRef.artStyle}</span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs" style={{ color: "#D97706" }}>⚠ No style reference — Gemini will use default style.</p>
                    )}
                  </div>

                  {/* ── Generation approach ── */}
                  <div>
                    <SectionHeader icon={Layers} label="Generation approach" />
                    <div
                      className="px-3 py-2.5 rounded-xl"
                      style={{ background: "rgba(180,150,210,0.06)", border: "1px solid rgba(180,150,210,0.1)" }}
                    >
                      <p className="text-xs font-bold capitalize" style={{ color: "#2D2235" }}>
                        {refs.coverPlan.approach.replace(/-/g, " ")} pass
                      </p>
                      <p className="text-[11px] mt-0.5" style={{ color: "#A897BD" }}>
                        {refs.coverPlan.approach === "two-pass"
                          ? "Pass 1: composition without character pressure. Pass 2: swap in character portraits."
                          : refs.coverPlan.approach === "edit"
                          ? "Edit mode: modify the existing cover with character references."
                          : "Single pass with all references provided simultaneously."}
                      </p>
                    </div>
                  </div>

                  {/* ── Cover plan prompts (collapsible) ── */}
                  {(refs.coverPlan.pass1Prompt || refs.coverPlan.front) && (
                    <div>
                      <button
                        onClick={() => setShowPrompts(v => !v)}
                        className="flex items-center gap-1.5 text-[11px] font-semibold w-full py-1"
                        style={{ color: "#A897BD", background: "none", border: "none", cursor: "pointer", fontFamily: FONT }}
                      >
                        <Sparkles className="w-3 h-3" />
                        {showPrompts ? "Hide" : "Show"} generation prompts
                        {showPrompts ? <ChevronUp className="w-3 h-3 ml-auto" /> : <ChevronDown className="w-3 h-3 ml-auto" />}
                      </button>

                      <AnimatePresence>
                        {showPrompts && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden space-y-2 mt-2"
                          >
                            {refs.coverPlan.front && (
                              <div className="rounded-xl p-3 space-y-1.5" style={{ background: "rgba(180,150,210,0.06)", border: "1px solid rgba(180,150,210,0.1)" }}>
                                <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "#8B5CB8" }}>Front cover</p>
                                <p className="text-[11px] leading-relaxed" style={{ color: "#4A3D5E" }}>{refs.coverPlan.front.visualIntent}</p>
                                {refs.coverPlan.front.titleText && (
                                  <p className="text-[11px]" style={{ color: "#A897BD" }}>Title: "{refs.coverPlan.front.titleText}"</p>
                                )}
                              </div>
                            )}
                            {refs.coverPlan.back && (
                              <div className="rounded-xl p-3 space-y-1.5" style={{ background: "rgba(180,150,210,0.06)", border: "1px solid rgba(180,150,210,0.1)" }}>
                                <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "#8B5CB8" }}>Back cover</p>
                                <p className="text-[11px] leading-relaxed" style={{ color: "#4A3D5E" }}>{refs.coverPlan.back.visualIntent}</p>
                                {(refs.coverPlan.back.blurbText || refs.coverPlan.back.dedicationText) && (
                                  <p className="text-[11px] italic" style={{ color: "#A897BD" }}>"{refs.coverPlan.back.blurbText || refs.coverPlan.back.dedicationText}"</p>
                                )}
                              </div>
                            )}
                            {refs.coverPlan.pass1Prompt && (
                              <div className="rounded-xl p-3" style={{ background: "rgba(180,150,210,0.06)", border: "1px solid rgba(180,150,210,0.1)" }}>
                                <p className="text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: "#8B5CB8" }}>Pass 1 prompt</p>
                                <p className="text-[11px] leading-relaxed font-mono" style={{ color: "#4A3D5E" }}>{refs.coverPlan.pass1Prompt.slice(0, 200)}{refs.coverPlan.pass1Prompt.length > 200 ? "…" : ""}</p>
                              </div>
                            )}
                            {refs.coverPlan.pass2Prompt && (
                              <div className="rounded-xl p-3" style={{ background: "rgba(180,150,210,0.06)", border: "1px solid rgba(180,150,210,0.1)" }}>
                                <p className="text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: "#8B5CB8" }}>Pass 2 prompt</p>
                                <p className="text-[11px] leading-relaxed font-mono" style={{ color: "#4A3D5E" }}>{refs.coverPlan.pass2Prompt.slice(0, 200)}{refs.coverPlan.pass2Prompt.length > 200 ? "…" : ""}</p>
                              </div>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}
                </>
              ) : null}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}