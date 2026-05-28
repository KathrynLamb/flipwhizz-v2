"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Loader2,
  Download,
  ImagePlus,
  Sparkles,
  RotateCcw,
  Check,
  BookImage,
  ChevronRight,
  PartyPopper,
  Printer,
  Users,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import RedrawModal from "@/app/stories/[id]/studio/components/redrawModal";
import FocusSceneModal from "@/app/stories/[id]/studio/components/FocusSceneModal";
import StudioPaywall from "@/components/StudioPaywall";
import UnifiedStoryHeader from "@/app/stories/components/StoryHeader";

import RedrawStrategistModal, {
  type RedrawPlan,
  type RedrawStrategistContext,
  type StrategistMessage,
} from "@/app/stories/[id]/studio/components/RedrawStrategistModal";

/* ---------------------------------- Types --------------------------------- */

type Page = {
  id: string;
  pageNumber: number;
  text: string;
  imageUrl: string | null;
};

type Spread = {
  id: string;
  spreadId: string | null;
  left: Page;
  right: Page | null;
};

type FocusCharacterOption = {
  characterId: string;
  name: string;
  imageUrl: string | null;
  role?: string | null;
};

type FocusSceneSelection = {
  featuredCharacterIds: string[];
  backgroundCharacterIds: string[];
  hiddenCharacterIds: string[];
};

type SpreadReferencesResponse = {
  spread?: {
    id: string;
    spreadIndex: number;
    sceneSummary: string | null;
    illustrationPrompt: string | null;
    mood: string | null;
    compositionNotes: string[];
  };
  assignedCharacters: {
    characterId: string;
    name: string;
    portraitImageUrl: string | null;
    fullBodyImageUrl: string | null;
    referenceImageUrl: string | null;
    role: string | null;
    currentOutfitKey?: string | null;
    currentOutfitDescription?: string | null;
  }[];
  availableCharacters: {
    characterId: string;
    name: string;
    portraitImageUrl: string | null;
    fullBodyImageUrl: string | null;
    referenceImageUrl: string | null;
    role: string | null;
    availableOutfits?: {
      outfitKey: string;
      outfitDescription: string;
      isDefault: boolean;
    }[];
  }[];
  assignedLocation?: {
    id: string;
    name: string;
    portraitImageUrl: string | null;
    referenceImageUrl: string | null;
    description?: string | null;
  } | null;
  assignedLocations?: {
    id: string;
    name: string;
    portraitImageUrl: string | null;
    referenceImageUrl: string | null;
    description?: string | null;
    role?: "primary" | "secondary" | "background" | "referenced" | "memory" | null;
  }[];
  availableLocations?: {
    id: string;
    name: string;
    portraitImageUrl: string | null;
    referenceImageUrl: string | null;
    description?: string | null;
  }[];
  styleGuide?: {
    summary: string | null;
    artStyle: string | null;
    sampleIllustrationUrl?: string | null;
  } | null;
};

/* -------------------------- Helper: build spreads -------------------------- */

function groupIntoSpreads(
  pages: Page[],
  dbSpreads?: { id: string; leftPageId: string | null; rightPageId: string | null }[]
): Spread[] {
  const spreads: Spread[] = [];
  const sorted = [...pages].sort((a, b) => a.pageNumber - b.pageNumber);

  for (let i = 0; i < sorted.length; i += 2) {
    const dbSpread = dbSpreads?.find(
      (s) =>
        s.leftPageId === sorted[i].id ||
        (sorted[i + 1] && s.rightPageId === sorted[i + 1]?.id)
    );

    spreads.push({
      id: `spread-${sorted[i].id}`,
      spreadId: dbSpread?.id ?? null,
      left: sorted[i],
      right: sorted[i + 1] || null,
    });
  }

  return spreads;
}

function bestCharacterImage(c: {
  portraitImageUrl?: string | null;
  fullBodyImageUrl?: string | null;
  referenceImageUrl?: string | null;
}) {
  return c.portraitImageUrl || c.fullBodyImageUrl || c.referenceImageUrl || null;
}

function SplitRedrawBanner({
  plan,
  onDismiss,
}: {
  plan: RedrawPlan;
  onDismiss: () => void;
}) {
  return (
    <div className="rounded-2xl border border-orange-200 bg-orange-50 px-5 py-4 flex items-start gap-3">
      <Users className="w-5 h-5 text-orange-600 mt-0.5" />
      <div className="flex-1">
        <p className="text-sm font-bold text-orange-900">Split redraw plan ready</p>
        <p className="text-xs text-orange-800 mt-1 leading-relaxed">
          The strategist judged this scene too crowded for one unified spread. The plan has been
          captured as a two-page redraw concept, but your current image worker still renders
          double-page spreads only.
        </p>

        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="rounded-xl bg-white border border-orange-200 p-3">
            <p className="text-[11px] uppercase tracking-wide text-orange-700 font-bold mb-1.5">
              Left page prompt
            </p>
            <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">
              {plan.leftPagePrompt || "—"}
            </p>
          </div>
          <div className="rounded-xl bg-white border border-orange-200 p-3">
            <p className="text-[11px] uppercase tracking-wide text-orange-700 font-bold mb-1.5">
              Right page prompt
            </p>
            <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">
              {plan.rightPagePrompt || "—"}
            </p>
          </div>
        </div>

        <button
          onClick={onDismiss}
          className="mt-3 inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-orange-300 text-xs font-bold text-orange-800 hover:bg-orange-100 transition-colors"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                               Cover Preview                                */
/* -------------------------------------------------------------------------- */

function CoverSpreadPreview({
  url,
  onRedraw,
}: {
  url: string;
  onRedraw: () => void;
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="group relative bg-white rounded-2xl shadow-sm border border-gray-200/50 overflow-hidden"
    >
      <div className="relative w-full aspect-[2/1] bg-gradient-to-br from-gray-100 via-white to-gray-100">
        <img src={url} alt="Book cover spread" className="w-full h-full object-contain" />
        <div className="absolute top-4 left-4 bg-black/70 backdrop-blur-md px-4 py-1.5 rounded-full text-xs font-bold text-white">
          Cover (Back · Spine · Front)
        </div>
        <div className="absolute top-4 right-4 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onRedraw}
            className="flex items-center gap-1.5 bg-white/90 backdrop-blur-md text-gray-700 hover:text-purple-600 hover:bg-white px-3 py-1.5 rounded-full text-xs font-bold shadow-md border border-gray-200/50 transition-all"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Redraw Cover
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function SpreadCard({
  spread,
  isGeneratingAll,
  isRegenerating,
  onRedraw,
  onGenerate,
}: {
  spread: Spread;
  isGeneratingAll: boolean;
  isRegenerating: boolean;
  onRedraw: () => void;
  onGenerate: () => void;
}) {
  const pageLabel = spread.right
    ? `Pages ${spread.left.pageNumber}–${spread.right.pageNumber}`
    : `Page ${spread.left.pageNumber}`;

  const hasImage = !!spread.left.imageUrl;

  return (
    <div className="group bg-white rounded-2xl border overflow-hidden relative">
      <div className="absolute top-3 left-3 z-10 bg-black/70 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold text-white">
        {pageLabel}
      </div>

      {hasImage && !isRegenerating && (
        <div className="absolute top-3 right-3 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onRedraw}
            className="flex items-center gap-1.5 bg-white/90 backdrop-blur-md text-gray-700 hover:text-purple-600 hover:bg-white px-3 py-1.5 rounded-full text-xs font-bold shadow-md border border-gray-200/50 transition-all"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Redraw
          </button>
        </div>
      )}

      <div className="aspect-[2/1] bg-gray-100 relative">
        {isRegenerating ? (
          <div className="flex h-full items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="relative">
                <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
                <Sparkles className="w-4 h-4 text-pink-500 absolute -top-1 -right-1 animate-pulse" />
              </div>
              <p className="text-sm text-purple-600 font-medium">Redrawing spread…</p>
            </div>
          </div>
        ) : hasImage ? (
          <img src={spread.left.imageUrl!} className="w-full h-full object-contain" alt={pageLabel} />
        ) : (
          <div className="flex h-full items-center justify-center text-gray-400">
            {isGeneratingAll ? (
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="w-8 h-8 animate-spin" />
                <p className="text-sm">Generating...</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4">
                <ImagePlus className="w-12 h-12" />
                <button
                  onClick={onGenerate}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:shadow-lg active:scale-[0.97]"
                  style={{
                    background: "linear-gradient(135deg, #B05CE6, #D45DA0)",
                    boxShadow: "0 3px 12px rgba(176,92,230,0.2)",
                    border: "none",
                  }}
                >
                  <Sparkles className="w-4 h-4" />
                  Generate This Spread
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {!hasImage && (
        <div className="px-5 py-3 border-t border-gray-100">
          <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">
            {spread.left.text}
            {spread.right?.text ? ` ${spread.right.text}` : ""}
          </p>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                           Studio Action Card                               */
/* -------------------------------------------------------------------------- */

function StudioActionCard({
  storyId,
  coverSpreadUrl,
  pdfUrl,
  isExporting,
  isOrdering,
  onDesignCover,
  onExportPDF,
  onOrderBook,
}: {
  storyId: string;
  coverSpreadUrl: string | null;
  pdfUrl: string | null;
  isExporting: boolean;
  isOrdering: boolean;
  onDesignCover: () => void;
  onExportPDF: () => void;
  onOrderBook: () => void;
}) {
  const hasCover = !!coverSpreadUrl;
  const hasPdf = !!pdfUrl;

  if (!hasCover) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 200, damping: 24 }}
        className="rounded-2xl overflow-hidden"
        style={{
          background: "white",
          border: "1px solid rgba(180,150,210,0.12)",
          boxShadow: "0 2px 12px rgba(100,60,140,0.06), 0 8px 32px rgba(100,60,140,0.04)",
          fontFamily: "'Bricolage Grotesque', system-ui, sans-serif",
        }}
      >
        <div className="flex flex-col sm:flex-row items-center gap-6 p-6 sm:p-8">
          <div className="flex-shrink-0">
            <motion.div
              initial={{ scale: 0, rotate: -20 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 300, delay: 0.15 }}
              className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{
                background: "linear-gradient(135deg, #43B89C, #2FA482)",
                boxShadow: "0 4px 16px rgba(67,184,156,0.25)",
              }}
            >
              <PartyPopper className="w-6 h-6 text-white" />
            </motion.div>
          </div>

          <div className="flex-1 text-center sm:text-left">
            <h3
              className="text-lg font-extrabold mb-1"
              style={{ color: "#2D2235", letterSpacing: "-0.02em" }}
            >
              All illustrations complete!
            </h3>
            <p className="text-sm leading-relaxed max-w-md" style={{ color: "#7B6E90" }}>
              Your pages are looking great. Next up: design a cover to bring it all together —
              you'll chat through your vision and we'll generate it for you.
            </p>
          </div>

          <div className="flex-shrink-0">
            <button
              onClick={onDesignCover}
              className="flex items-center gap-2.5 px-6 py-3.5 rounded-xl text-sm font-bold text-white transition-all hover:shadow-lg active:scale-[0.97]"
              style={{
                background: "linear-gradient(135deg, #B05CE6, #D45DA0)",
                boxShadow: "0 4px 16px rgba(176,92,230,0.25)",
                border: "none",
                fontFamily: "inherit",
                cursor: "pointer",
              }}
            >
              <BookImage className="w-4 h-4" />
              Design Your Cover
              <ChevronRight className="w-4 h-4 opacity-60" />
            </button>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 200, damping: 24 }}
      className="rounded-2xl overflow-hidden"
      style={{
        background: "white",
        border: "1px solid rgba(180,150,210,0.12)",
        boxShadow: "0 2px 12px rgba(100,60,140,0.06), 0 8px 32px rgba(100,60,140,0.04)",
        fontFamily: "'Bricolage Grotesque', system-ui, sans-serif",
      }}
    >
      <div className="flex flex-col sm:flex-row items-center gap-6 p-6 sm:p-8">
        <div className="flex-shrink-0">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center"
            style={{
              background: "linear-gradient(135deg, #43B89C, #2FA482)",
              boxShadow: "0 4px 16px rgba(67,184,156,0.25)",
            }}
          >
            <Check className="w-6 h-6 text-white" />
          </div>
        </div>

        <div className="flex-1 text-center sm:text-left">
          <h3
            className="text-lg font-extrabold mb-1"
            style={{ color: "#2D2235", letterSpacing: "-0.02em" }}
          >
            Your book is ready!
          </h3>
          <p className="text-sm leading-relaxed max-w-md" style={{ color: "#7B6E90" }}>
            Illustrations and cover are complete. Export a print-ready PDF or tweak the cover if
            you'd like changes.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          <button
            onClick={onDesignCover}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all hover:shadow-md active:scale-[0.97]"
            style={{
              background: "rgba(180,150,210,0.08)",
              color: "#6B5C80",
              border: "1px solid rgba(180,150,210,0.15)",
              fontFamily: "inherit",
              cursor: "pointer",
            }}
          >
            <BookImage className="w-3.5 h-3.5" />
            Tweak Cover
          </button>

          <button
            onClick={async () => {
              const res = await fetch(`/api/stories/${storyId}/export-home-print`, {
                method: "POST",
              });
              if (res.ok) {
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "book-print-at-home.pdf";
                a.click();
                URL.revokeObjectURL(url);
              } else {
                alert("Failed to export PDF");
              }
            }}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all hover:shadow-md active:scale-[0.97]"
            style={{
              background: "rgba(180,150,210,0.08)",
              color: "#6B5C80",
              border: "1px solid rgba(180,150,210,0.15)",
              fontFamily: "inherit",
              cursor: "pointer",
            }}
          >
            <Printer className="w-3.5 h-3.5" />
            Print at Home
          </button>

          <button
            onClick={onExportPDF}
            disabled={isExporting}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white transition-all hover:shadow-lg active:scale-[0.97] disabled:opacity-50"
            style={{
              background: "linear-gradient(135deg, #B05CE6, #D45DA0)",
              boxShadow: "0 3px 12px rgba(176,92,230,0.2)",
              border: "none",
              fontFamily: "inherit",
              cursor: "pointer",
            }}
          >
            {isExporting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Exporting…
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5" />
                Export PDF
              </>
            )}
          </button>

          {hasPdf && (
            <button
              onClick={onOrderBook}
              disabled={isOrdering}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white transition-all hover:shadow-lg active:scale-[0.97] disabled:opacity-50"
              style={{
                background: "linear-gradient(135deg, #43B89C, #2FA482)",
                boxShadow: "0 3px 12px rgba(67,184,156,0.2)",
                border: "none",
                fontFamily: "inherit",
                cursor: "pointer",
              }}
            >
              {isOrdering ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Ordering…
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  Order Print
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/* -------------------------------------------------------------------------- */
/*                               Desktop Studio                               */
/* -------------------------------------------------------------------------- */

export default function DesktopStudio({
  story,
  pages: initialPages,
  styleGuide,
  mode,
  dbSpreads,
}: {
  story: any;
  pages: Page[];
  styleGuide: any;
  mode: "live" | "edit";
  dbSpreads?: { id: string; leftPageId: string | null; rightPageId: string | null }[];
}) {
  const router = useRouter();

  const [pages, setPages] = useState<Page[]>(initialPages);
  const [isPolling, setIsPolling] = useState(
    mode === "live" || story.status === "generating"
  );
  const [isExporting, setIsExporting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isOrdering, setIsOrdering] = useState(false);

  const [regeneratingSpreads, setRegeneratingSpreads] = useState<Set<string>>(new Set());

  // ── Redraw Modal (character/location/outfit editor) ──
  const [redrawModalTarget, setRedrawModalTarget] = useState<Spread | null>(null);
  const [isSubmittingRedrawModal, setIsSubmittingRedrawModal] = useState(false);

  // ── Focus Scene Modal (large cast) ──
  const [focusTarget, setFocusTarget] = useState<Spread | null>(null);
  const [focusCharacters, setFocusCharacters] = useState<FocusCharacterOption[]>([]);
  const [focusSelectedCharacterIds, setFocusSelectedCharacterIds] = useState<string[] | null>(null);
  const [isSubmittingFocus, setIsSubmittingFocus] = useState(false);
  const [pendingFocusMode, setPendingFocusMode] = useState<"generate" | "redraw" | null>(null);

  const [pendingSplitPlan, setPendingSplitPlan] = useState<RedrawPlan | null>(null);

  // ── Strategist ──
  const [isOpeningStrategist, setIsOpeningStrategist] = useState(false);
  const [strategistTarget, setStrategistTarget] = useState<Spread | null>(null);
  const [isStrategistOpen, setIsStrategistOpen] = useState(false);
  const [isSendingStrategistMessage, setIsSendingStrategistMessage] = useState(false);
  const [isApplyingStrategistPlan, setIsApplyingStrategistPlan] = useState(false);
  const [strategistMessages, setStrategistMessages] = useState<StrategistMessage[]>([]);
  const [strategistPlan, setStrategistPlan] = useState<RedrawPlan | null>(null);
  const [strategistContext, setStrategistContext] = useState<RedrawStrategistContext | null>(null);

  const spreads = useMemo(() => groupIntoSpreads(pages, dbSpreads), [pages, dbSpreads]);

  const completedCount = pages.filter((p) => p.imageUrl).length;
  const totalCount = pages.length;
  const allGenerated = completedCount === totalCount;
  const isPaid = story.paymentStatus === "paid";

  /* ── Polling ── */
  useEffect(() => {
    if (!isPolling) return;

    const interval = setInterval(async () => {
      const res = await fetch(`/api/stories/${story.id}/pages`, { cache: "no-store" });
      if (!res.ok) return;

      const updatedPages: Page[] = await res.json();
      setPages(updatedPages);

      if (regeneratingSpreads.size > 0) {
        const updatedSpreads = groupIntoSpreads(updatedPages, dbSpreads);
        const stillRegenerating = new Set<string>();

        regeneratingSpreads.forEach((spreadId) => {
          const spread = updatedSpreads.find((s) => s.id === spreadId);
          if (spread && !spread.left.imageUrl) {
            stillRegenerating.add(spreadId);
          }
        });

        if (stillRegenerating.size !== regeneratingSpreads.size) {
          setRegeneratingSpreads(stillRegenerating);
        }
      }

      if (updatedPages.every((p) => p.imageUrl) && regeneratingSpreads.size === 0) {
        setIsPolling(false);
        setIsGenerating(false);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [isPolling, story.id, regeneratingSpreads, dbSpreads]);

  /* ── Auto-generate on paid ── */
  useEffect(() => {
    if (!isPaid) return;

    if (completedCount === 0 && !isGenerating) {
      setIsGenerating(true);
      setIsPolling(true);
      fetch(`/api/stories/${story.id}/generate-all`, { method: "POST" }).catch(() => {});
    } else if (completedCount > 0 && completedCount < totalCount && story.status === "generating") {
      setIsGenerating(true);
      setIsPolling(true);
    }
  }, [isPaid]);

  /* ── Helpers ── */
  async function loadFocusCandidates(spread: Spread): Promise<FocusCharacterOption[] | null> {
    if (!spread.spreadId) return null;

    const res = await fetch(
      `/api/stories/${story.id}/spreads/${spread.spreadId}/references`,
      { cache: "no-store" }
    );

    if (!res.ok) throw new Error("Failed to load spread references");

    const data: SpreadReferencesResponse = await res.json();

    return (data.assignedCharacters ?? []).map((c) => ({
      characterId: c.characterId,
      name: c.name,
      imageUrl: bestCharacterImage(c),
      role: c.role,
    }));
  }

  async function buildStrategistContext(
    spread: Spread,
    initialFeaturedCharacterIds?: string[] | null
  ): Promise<RedrawStrategistContext> {
    if (!spread.spreadId) throw new Error("Missing spread id");

    const res = await fetch(
      `/api/stories/${story.id}/spreads/${spread.spreadId}/references`,
      { cache: "no-store" }
    );

    if (!res.ok) throw new Error("Failed to load spread references");

    const data: SpreadReferencesResponse = await res.json();

    const allCharacters = [
      ...(data.assignedCharacters ?? []),
      ...(data.availableCharacters ?? []),
    ];

    const dedupedCharacters = Array.from(
      new Map(
        allCharacters.map((c) => [
          c.characterId,
          {
            characterId: c.characterId,
            name: c.name,
            imageUrl: bestCharacterImage(c),
            role: c.role,
            outfitKey: "currentOutfitKey" in c ? c.currentOutfitKey ?? null : null,
          },
        ])
      ).values()
    );

    const selectedSet = new Set(initialFeaturedCharacterIds ?? []);
    const charactersForContext =
      selectedSet.size > 0
        ? [
            ...dedupedCharacters.filter((c) => selectedSet.has(c.characterId)),
            ...dedupedCharacters.filter((c) => !selectedSet.has(c.characterId)),
          ]
        : dedupedCharacters;

    const allLocations = [
      ...(data.assignedLocations ?? []),
      ...(data.assignedLocation ? [data.assignedLocation] : []),
      ...(data.availableLocations ?? []),
    ];

    const dedupedLocations = Array.from(
      new Map(
        allLocations.map((l) => [
          l.id,
          {
            id: l.id,
            name: l.name,
            imageUrl: l.portraitImageUrl || l.referenceImageUrl || null,
          },
        ])
      ).values()
    );

    return {
      storyTitle: story.title,
      spreadLabel: spread.right
        ? `Pages ${spread.left.pageNumber}–${spread.right.pageNumber}`
        : `Page ${spread.left.pageNumber}`,
      sceneSummary: data.spread?.sceneSummary ?? null,
      illustrationBrief: data.spread?.illustrationPrompt ?? null,
      mood: data.spread?.mood ?? null,
      leftPageText: spread.left.text ?? null,
      rightPageText: spread.right?.text ?? null,
      currentSpreadImageUrl: spread.left.imageUrl ?? null,
      styleGuideSummary: data.styleGuide?.summary ?? styleGuide?.summary ?? null,
      styleGuideLabel: data.styleGuide?.artStyle ?? styleGuide?.artStyle ?? null,
      characters: charactersForContext,
      locations: dedupedLocations,
    };
  }

  async function startRegenerationForSpread(
    spread: Spread,
    options?: {
      includedCharacterIds?: string[];
      freshStart?: boolean;
      feedback?: string;
      primaryLocationId?: string | null;
      includedLocationIds?: string[];
      outfitOverrides?: Record<string, string>;
      strategistPlan?: {
        featuredCharacterIds: string[];
        backgroundCharacterIds: string[];
        hiddenCharacterIds: string[];
        recommendedPrompt: string;
        outfitOverrides?: Record<string, string>;
      } | null;
    }
  ) {
    const pageIds = [spread.left.id];
    if (spread.right) pageIds.push(spread.right.id);

    const res = await fetch(`/api/stories/${story.id}/spreads/regenerate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pageIds,
        spreadId: spread.spreadId,
        feedback: options?.feedback ?? "",
        includedCharacterIds: options?.includedCharacterIds ?? [],
        outfitOverrides: options?.outfitOverrides ?? {},
        primaryLocationId: options?.primaryLocationId ?? null,
        includedLocationIds: options?.includedLocationIds ?? [],
        freshStart: options?.freshStart ?? true,
        strategistPlan: options?.strategistPlan ?? null,
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Failed to start generation");
    }

    setRegeneratingSpreads((prev) => new Set(prev).add(spread.id));

    setPages((prev) =>
      prev.map((p) => (pageIds.includes(p.id) ? { ...p, imageUrl: null } : p))
    );

    setIsPolling(true);
  }

  async function maybeFocusSpread(spread: Spread, mode: "generate" | "redraw") {
    try {
      const assigned = await loadFocusCandidates(spread);

      if (assigned && assigned.length > 5) {
        setFocusTarget(spread);
        setFocusCharacters(assigned);
        setFocusSelectedCharacterIds(null);
        setPendingFocusMode(mode);
        return true;
      }

      if (mode === "generate") {
        await startRegenerationForSpread(spread, { freshStart: true });
      }

      return false;
    } catch (err: any) {
      alert(err.message || "Failed to prepare spread");
      return false;
    }
  }

  async function handleGenerateAll() {
    if (isGenerating) return;
    setIsGenerating(true);
    setIsPolling(true);

    try {
      const res = await fetch(`/api/stories/${story.id}/generate-all`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to start generation");

      if (Array.isArray(data.spreadsSkippedForFocus) && data.spreadsSkippedForFocus.length > 0) {
        alert(
          `Some spreads need scene focus before they can be generated: ${data.spreadsSkippedForFocus.join(", ")}`
        );
      }
    } catch (err: any) {
      alert(err.message || "Failed to start generation");
      setIsGenerating(false);
      setIsPolling(false);
    }
  }

  function resetStrategistState() {
    setStrategistMessages([]);
    setStrategistPlan(null);
    setIsSendingStrategistMessage(false);
    setIsApplyingStrategistPlan(false);
  }

  function closeStrategist() {
    setIsStrategistOpen(false);
    setStrategistTarget(null);
    setStrategistContext(null);
    resetStrategistState();
  }

  async function openStrategistForSpread(
    spread: Spread,
    initialFeaturedCharacterIds?: string[] | null
  ) {
    setStrategistTarget(spread);
    setStrategistContext(null);
    setStrategistMessages([]);
    setStrategistPlan(null);
    setIsStrategistOpen(true);
    setIsOpeningStrategist(true);

    try {
      const context = await buildStrategistContext(spread, initialFeaturedCharacterIds);

      setStrategistContext(context);
      setStrategistMessages([
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content:
            "I've reviewed this spread and the loaded references. Tell me what feels off, and I'll turn it into a stronger redraw plan for Gemini.",
        },
      ]);
    } catch (err: any) {
      alert(err.message || "Failed to open redraw strategist");
      closeStrategist();
    } finally {
      setIsOpeningStrategist(false);
    }
  }

  async function handleStrategistMessage(payload: {
    userMessage: string;
    messages: StrategistMessage[];
  }) {
    setStrategistMessages(payload.messages);
    setIsSendingStrategistMessage(true);

    try {
      const res = await fetch(`/api/stories/${story.id}/spreads/strategist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          spreadId: strategistTarget?.spreadId ?? null,
          context: strategistContext,
          messages: payload.messages,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to continue strategist chat");

      setStrategistMessages((prev) => [...prev, data.assistantMessage]);
      setStrategistPlan(data.plan ?? null);
    } catch (err: any) {
      alert(err.message || "Failed to continue strategist chat");
    } finally {
      setIsSendingStrategistMessage(false);
    }
  }

  async function handleUseStrategistPlan(plan: RedrawPlan) {
    if (!strategistTarget) return;

    setIsApplyingStrategistPlan(true);

    try {
      if (
        plan.executionMode === "single_spread_identity_repair" ||
        plan.executionMode === "single_spread_with_reduced_cast"
      ) {
        await startRegenerationForSpread(strategistTarget, {
          freshStart: false,
          strategistPlan: {
            featuredCharacterIds: plan.featuredCharacterIds,
            backgroundCharacterIds: plan.backgroundCharacterIds,
            hiddenCharacterIds: plan.hiddenCharacterIds,
            recommendedPrompt: plan.recommendedPrompt,
            outfitOverrides: plan.outfitOverrides ?? {},
          },
        });

        closeStrategist();
        setFocusSelectedCharacterIds(null);
        return;
      }

      if (plan.executionMode === "split_into_two_single_pages") {
        if (!strategistTarget.right) {
          throw new Error("Split plan requires a spread with both left and right pages");
        }

        const leftOnlySpread: Spread = { ...strategistTarget, right: null };

        await startRegenerationForSpread(leftOnlySpread, {
          freshStart: false,
          strategistPlan: {
            featuredCharacterIds: plan.leftPageFeaturedCharacterIds ?? [],
            backgroundCharacterIds: plan.leftPageBackgroundCharacterIds ?? [],
            hiddenCharacterIds: plan.leftPageHiddenCharacterIds ?? [],
            recommendedPrompt: plan.leftPagePrompt ?? "",
            outfitOverrides: plan.outfitOverrides ?? {},
          },
        });

        const rightOnlySpread: Spread = {
          id: `spread-${strategistTarget.right.id}`,
          spreadId: strategistTarget.spreadId,
          left: strategistTarget.right,
          right: null,
        };

        await startRegenerationForSpread(rightOnlySpread, {
          freshStart: false,
          strategistPlan: {
            featuredCharacterIds: plan.rightPageFeaturedCharacterIds ?? [],
            backgroundCharacterIds: plan.rightPageBackgroundCharacterIds ?? [],
            hiddenCharacterIds: plan.rightPageHiddenCharacterIds ?? [],
            recommendedPrompt: plan.rightPagePrompt ?? "",
            outfitOverrides: plan.outfitOverrides ?? {},
          },
        });

        closeStrategist();
        setFocusSelectedCharacterIds(null);
        return;
      }

      throw new Error("Unknown redraw execution mode");
    } catch (err: any) {
      alert(err.message || "Failed to use redraw plan");
    } finally {
      setIsApplyingStrategistPlan(false);
    }
  }

  async function handleGenerateSingle(spread: Spread) {
    await maybeFocusSpread(spread, "generate");
  }

  // ── Opens RedrawModal directly; no more auto-routing to strategist ──
  function handleRedrawClick(spread: Spread) {
    setRedrawModalTarget(spread);
  }

  async function handleRedrawModalSubmit(payload: {
    feedback: string;
    includedCharacterIds: string[];
    outfitOverrides: Record<string, string>;
    primaryLocationId: string | null;
    includedLocationIds: string[];
    freshStart?: boolean;
  }) {
    if (!redrawModalTarget) return;
    setIsSubmittingRedrawModal(true);
    try {
      await startRegenerationForSpread(redrawModalTarget, {
        feedback: payload.feedback,
        includedCharacterIds: payload.includedCharacterIds,
        outfitOverrides: payload.outfitOverrides,
        primaryLocationId: payload.primaryLocationId,
        includedLocationIds: payload.includedLocationIds,
        freshStart: payload.freshStart ?? false,
      });
      setRedrawModalTarget(null);
    } catch (err: any) {
      alert(err.message || "Failed to redraw spread");
    } finally {
      setIsSubmittingRedrawModal(false);
    }
  }

  async function handleFocusSubmit(selection: FocusSceneSelection) {
    if (!focusTarget || !pendingFocusMode) return;

    setIsSubmittingFocus(true);

    try {
      if (pendingFocusMode === "generate") {
        await startRegenerationForSpread(focusTarget, {
          includedCharacterIds: selection.featuredCharacterIds,
          freshStart: true,
        });

        setFocusTarget(null);
        setFocusCharacters([]);
        setFocusSelectedCharacterIds(null);
        setPendingFocusMode(null);
      } else {
        setFocusSelectedCharacterIds(selection.featuredCharacterIds);
        const target = focusTarget;

        setFocusTarget(null);
        setFocusCharacters([]);
        setPendingFocusMode(null);

        await openStrategistForSpread(target, selection.featuredCharacterIds);
      }
    } catch (err: any) {
      alert(err.message || "Failed to focus scene");
    } finally {
      setIsSubmittingFocus(false);
    }
  }

  async function handleExportPDF() {
    if (isExporting) return;
    setIsExporting(true);

    try {
      const res = await fetch(`/api/stories/${story.id}/export-complete`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error();
      window.open(data.url, "_blank");
    } catch {
      alert("Failed to export PDF");
    } finally {
      setIsExporting(false);
    }
  }

  async function handleOrderBook() {
    if (isOrdering) return;
    setIsOrdering(true);

    try {
      const res = await fetch(`/api/stories/${story.id}/order-test`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to place order");
      alert(`Order placed! Gelato order ID: ${data.gelatoOrderId}`);
    } catch (err: any) {
      alert(err.message || "Failed to place order");
    } finally {
      setIsOrdering(false);
    }
  }

  const focusLabel = focusTarget
    ? focusTarget.right
      ? `Pages ${focusTarget.left.pageNumber}–${focusTarget.right.pageNumber}`
      : `Page ${focusTarget.left.pageNumber}`
    : "";

  /* ── Paywall ── */
  if (!isPaid) {
    const previewSpread = pages.find((p) => p.imageUrl);

    return (
      <div className="min-h-screen bg-gray-50">
        <UnifiedStoryHeader
          storyId={story.id}
          title={story.title}
          currentStep="studio"
          completedSteps={story.completedSteps ?? []}
          paymentStatus={story.paymentStatus}
          hasPages={pages.length > 0}
          coverSpreadUrl={story.coverSpreadUrl}
        />
        <StudioPaywall
          storyId={story.id}
          storyTitle={story.title}
          previewSpreadUrl={previewSpread?.imageUrl}
        />
      </div>
    );
  }

  /* ── Main ── */
  return (
    <div className="min-h-screen bg-gray-50 pb-40">
      {/* Strategist */}
      <AnimatePresence>
        {isStrategistOpen && strategistTarget && (
          <RedrawStrategistModal
            isOpen
            onClose={closeStrategist}
            messages={strategistMessages}
            isSending={isSendingStrategistMessage}
            onSendMessage={handleStrategistMessage}
            context={strategistContext}
            isLoadingContext={isOpeningStrategist}
            plan={strategistPlan}
            onUsePlan={handleUseStrategistPlan}
            isUsingPlan={isApplyingStrategistPlan}
            onResetConversation={() => {
              setStrategistMessages([
                {
                  id: `assistant-${Date.now()}`,
                  role: "assistant",
                  content:
                    "I've reviewed this spread and the loaded references. Tell me what feels off, and I'll turn it into a stronger redraw plan for Gemini.",
                },
              ]);
              setStrategistPlan(null);
            }}
          />
        )}
      </AnimatePresence>

      {/* Redraw Modal */}
      <AnimatePresence>
        {redrawModalTarget && (
          <RedrawModal
            isOpen
            onClose={() => setRedrawModalTarget(null)}
            onSubmit={handleRedrawModalSubmit}
            isSubmitting={isSubmittingRedrawModal}
            storyId={story.id}
            spreadId={redrawModalTarget.spreadId ?? ""}
            spreadLabel={
              redrawModalTarget.right
                ? `Pages ${redrawModalTarget.left.pageNumber}–${redrawModalTarget.right.pageNumber}`
                : `Page ${redrawModalTarget.left.pageNumber}`
            }
          />
        )}
      </AnimatePresence>

      {/* Focus Scene Modal */}
      <AnimatePresence>
        {focusTarget && (
          <FocusSceneModal
            isOpen
            onClose={() => {
              setFocusTarget(null);
              setFocusCharacters([]);
              setFocusSelectedCharacterIds(null);
              setPendingFocusMode(null);
            }}
            onSubmit={handleFocusSubmit}
            isSubmitting={isSubmittingFocus}
            spreadLabel={focusLabel}
            characters={focusCharacters}
          />
        )}
      </AnimatePresence>

      <UnifiedStoryHeader
        storyId={story.id}
        title={story.title}
        currentStep="studio"
        completedSteps={story.completedSteps ?? []}
        paymentStatus={story.paymentStatus}
        hasPages={pages.length > 0}
        coverSpreadUrl={story.coverSpreadUrl}
        showProgress={isGenerating && totalCount > 0}
        progressCurrent={completedCount}
        progressTotal={totalCount}
        showGenerateAll={!allGenerated}
        onGenerateAll={handleGenerateAll}
        isGenerating={isGenerating}
      />

      {allGenerated && (
        <div className="max-w-[1400px] mx-auto px-8 pt-6">
          <StudioActionCard
            storyId={story.id}
            coverSpreadUrl={story.coverSpreadUrl}
            pdfUrl={story.pdfUrl}
            isExporting={isExporting}
            isOrdering={isOrdering}
            onDesignCover={async () => {
              await fetch(`/api/stories/${story.id}/complete-step`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ step: "studio" }),
              }).catch(() => {});
              router.push(`/stories/${story.id}/cover`);
            }}
            onExportPDF={handleExportPDF}
            onOrderBook={handleOrderBook}
          />
        </div>
      )}

      <div className="max-w-[1400px] mx-auto p-8 space-y-8">
        {story.coverSpreadUrl && (
          <CoverSpreadPreview
            url={story.coverSpreadUrl}
            onRedraw={() => router.push(`/stories/${story.id}/cover`)}
          />
        )}

        {spreads.map((spread) => (
          <SpreadCard
            key={spread.id}
            spread={spread}
            isGeneratingAll={isGenerating}
            isRegenerating={regeneratingSpreads.has(spread.id)}
            onRedraw={() => handleRedrawClick(spread)}
            onGenerate={() => handleGenerateSingle(spread)}
          />
        ))}

        {pendingSplitPlan && (
          <SplitRedrawBanner
            plan={pendingSplitPlan}
            onDismiss={() => setPendingSplitPlan(null)}
          />
        )}
      </div>
    </div>
  );
}