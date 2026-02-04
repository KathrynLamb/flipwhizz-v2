"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  PenLine,
  Users,
  Palette,
  Printer,
  Layers,
  Lock,
  Map,
  Check,
  Sparkles,
  Loader2,
} from "lucide-react";
import type { StepKey } from "@/lib/storySteps";

/* ======================================================
   STEP ORDER
====================================================== */

const STEP_ORDER: StepKey[] = [
  "write",
  "extract",
  "locations",
  "design",
  "studio",
  "print",
];

function stepIndex(step: StepKey) {
  const idx = STEP_ORDER.indexOf(step);
  return idx === -1 ? 0 : idx;
}

/* ======================================================
   STEP CONFIG
====================================================== */

type Step = {
  key: StepKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  href: (id: string) => string;
  match: (pathname: string, id: string) => boolean;
};

const STEPS: Step[] = [
  {
    key: "write",
    label: "Write",
    icon: PenLine,
    href: (id) => `/stories/${id}/pages`,
    match: (p, id) =>
      p === `/stories/${id}` || 
      p.startsWith(`/stories/${id}/pages`) ||
      p.startsWith(`/stories/${id}/hub`),
  },
  {
    key: "extract",
    label: "Characters",
    icon: Users,
    href: (id) => `/stories/${id}/characters`,
    match: (p, id) => p.startsWith(`/stories/${id}/characters`),
  },
  {
    key: "locations",
    label: "Locations",
    icon: Map,
    href: (id) => `/stories/${id}/locations`,
    match: (p, id) => p.startsWith(`/stories/${id}/locations`),
  },
  {
    key: "design",
    label: "Design",
    icon: Palette,
    href: (id) => `/stories/${id}/design`,
    match: (p, id) => p.startsWith(`/stories/${id}/design`),
  },
  {
    key: "studio",
    label: "Studio",
    icon: Layers,
    href: (id) => `/stories/${id}/studio`,
    match: (p, id) => p.startsWith(`/stories/${id}/studio`),
  },
  {
    key: "print",
    label: "Print",
    icon: Printer,
    href: (id) => `/stories/${id}/checkout`,
    match: (p, id) =>
      p.startsWith(`/stories/${id}/checkout`) ||
      p.startsWith(`/stories/${id}/print`),
  },
];

/* ======================================================
   COMPONENT
====================================================== */

export default function UnifiedStoryHeader({
  storyId,
  title,
  currentStep,
  completedSteps,
  // Optional: page-specific actions
  showProgress,
  progressCurrent,
  progressTotal,
  showGenerateAll,
  onGenerateAll,
  isGenerating,
}: {
  storyId: string;
  title: string;
  currentStep: StepKey | number; // Allow number for backward compatibility
  completedSteps: StepKey[] | number; // Allow number for backward compatibility
  // Optional progress bar
  showProgress?: boolean;
  progressCurrent?: number;
  progressTotal?: number;
  // Optional action button
  showGenerateAll?: boolean;
  onGenerateAll?: () => void;
  isGenerating?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  /* --------------------------------------------------------
     DERIVE STATE PER STEP
  -------------------------------------------------------- */

  // Defensive: ensure types are correct
  const safeCurrentStep = typeof currentStep === 'string' ? currentStep : STEP_ORDER[0];
  const safeCompletedSteps = Array.isArray(completedSteps) ? completedSteps : [];

  const highestReached = Math.max(
    stepIndex(safeCurrentStep),
    ...safeCompletedSteps.map(stepIndex)
  );

  function getStepState(step: Step): "completed" | "active" | "locked" | "idle" {
    const idx = stepIndex(step.key);

    if (mounted && step.match(pathname, storyId)) return "active";
    if (safeCompletedSteps.includes(step.key)) return "completed";
    if (idx > highestReached) return "locked";

    return "idle";
  }

  const progressPercent = progressTotal && progressCurrent
    ? (progressCurrent / progressTotal) * 100
    : 0;

  /* --------------------------------------------------------
     RENDER
  -------------------------------------------------------- */

  return (
    <header 
      className="sticky top-0 z-50 backdrop-blur-xl border-b" 
      style={{ 
        background: 'rgba(255, 255, 255, 0.85)',
        borderColor: 'rgba(0, 0, 0, 0.06)'
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* Main header row */}
        <div className="flex items-center justify-between h-14 sm:h-16">
          
          {/* Left: Back button */}
          <button
            onClick={() => router.push("/projects")}
            className="flex items-center gap-2 text-sm font-medium text-stone-600 hover:text-black transition-colors -ml-2 px-2 py-1.5 rounded-lg hover:bg-black/[0.04] active:scale-95"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Library</span>
          </button>

          {/* Center: Logo + Navigation */}
          <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-3">
            {/* Logo */}
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center">
                <span className="text-white text-xs font-bold">FW</span>
              </div>
              <span className="hidden sm:inline text-sm font-bold text-stone-900">FlipWhizz</span>
            </div>

            {/* Desktop: Step pills */}
            <div className="hidden md:flex items-center gap-2 bg-white/90 backdrop-blur-xl border border-stone-200 px-3 py-2 rounded-2xl shadow-lg ml-4">
              {STEPS.map((step) => {
                const Icon = step.icon;
                const state = getStepState(step);
                const locked = state === "locked";

                return (
                  <motion.button
                    key={step.key}
                    whileHover={!locked ? { scale: 1.05 } : undefined}
                    whileTap={!locked ? { scale: 0.96 } : undefined}
                    onClick={() => !locked && router.push(step.href(storyId))}
                    className={`
                      relative flex items-center gap-2 px-3 py-1.5 rounded-xl
                      text-xs font-bold transition-all
                      ${state === "active"
                        ? "bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-md"
                        : state === "completed"
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        : locked
                        ? "bg-stone-100 text-stone-400 cursor-not-allowed"
                        : "bg-stone-100 text-stone-700 hover:bg-stone-200"
                      }
                    `}
                  >
                    {state === "completed" ? (
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                    ) : locked ? (
                      <Lock className="w-3.5 h-3.5 opacity-60" />
                    ) : (
                      <Icon className="w-3.5 h-3.5" />
                    )}
                    <span className="hidden lg:inline">{step.label}</span>
                  </motion.button>
                );
              })}
            </div>
          </div>

          {/* Right: Optional action button */}
          <div className="flex items-center gap-2">
            {showGenerateAll && onGenerateAll && (
              <button
                onClick={onGenerateAll}
                disabled={isGenerating}
                className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 transition-all disabled:opacity-40 shadow-lg active:scale-95"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Generating</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Generate All</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Mobile: Step navigation pills */}
        <div className="md:hidden pb-3 overflow-x-auto scrollbar-hide">
          <div className="flex items-center gap-2 min-w-max">
            {STEPS.map((step) => {
              const Icon = step.icon;
              const state = getStepState(step);
              const locked = state === "locked";

              return (
                <button
                  key={step.key}
                  onClick={() => !locked && router.push(step.href(storyId))}
                  disabled={locked}
                  className={`
                    flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap
                    ${state === "active"
                      ? "bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-md"
                      : state === "completed"
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                      : locked
                      ? "bg-stone-100 text-stone-400 cursor-not-allowed"
                      : "bg-stone-100 text-stone-700 active:bg-stone-200"
                    }
                  `}
                >
                  {state === "completed" ? (
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                  ) : locked ? (
                    <Lock className="w-3.5 h-3.5 opacity-60" />
                  ) : (
                    <Icon className="w-3.5 h-3.5" />
                  )}
                  <span>{step.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Optional progress bar */}
        {showProgress && progressTotal && progressTotal > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="pb-3"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-stone-500">
                {progressCurrent} of {progressTotal} locked
              </span>
              <span className="text-xs font-bold text-violet-600">
                {Math.round(progressPercent)}%
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-stone-100 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progressPercent}%` }}
                transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
                className="h-full bg-gradient-to-r from-violet-600 to-fuchsia-600 rounded-full"
                style={{
                  boxShadow: progressPercent > 0 ? '0 0 12px rgba(139, 92, 246, 0.4)' : 'none'
                }}
              />
            </div>
          </motion.div>
        )}
      </div>
    </header>
  );
}