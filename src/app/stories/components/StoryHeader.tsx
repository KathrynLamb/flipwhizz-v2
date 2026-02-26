"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  PenLine,
  Users,
  Palette,
  Printer,
  Layers,
  Lock,
  MapPin,
  Check,
  Sparkles,
  Loader2,
  ChevronDown,
} from "lucide-react";
import type { StepKey } from "@/lib/storySteps";

/* ======================================================
   STEP ORDER
====================================================== */

const STEP_ORDER: StepKey[] = [
  "write",
  "characters",
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
  shortLabel: string;
  icon: React.ComponentType<{ className?: string }>;
  href: (id: string) => string;
  match: (pathname: string, id: string) => boolean;
};

const STEPS: Step[] = [
  {
    key: "write",
    label: "Write",
    shortLabel: "Write",
    icon: PenLine,
    href: (id) => `/stories/${id}/pages`,
    match: (p, id) =>
      p === `/stories/${id}` ||
      p.startsWith(`/stories/${id}/pages`) ||
      p.startsWith(`/stories/${id}/hub`),
  },
  {
    key: "design",
    label: "Design",
    shortLabel: "Style",
    icon: Palette,
    // href: (id) => `/stories/${id}/design`,
    // match: (p, id) => p.startsWith(`/stories/${id}/design`),
    href: (id) => `/stories/${id}/illustration-style`,
    match: (p, id) => p.startsWith(`/stories/${id}/illustration-style`),
  },
  {
    key: "characters",
    label: "Characters",
    shortLabel: "Cast",
    icon: Users,
    href: (id) => `/stories/${id}/characters`,
    match: (p, id) => p.startsWith(`/stories/${id}/characters`),
  },
  {
    key: "locations",
    label: "Locations",
    shortLabel: "Places",
    icon: MapPin,
    href: (id) => `/stories/${id}/locations`,
    match: (p, id) => p.startsWith(`/stories/${id}/locations`),
  },

  {
    key: "studio",
    label: "Studio",
    shortLabel: "Studio",
    icon: Layers,
    href: (id) => `/stories/${id}/studio`,
    match: (p, id) => p.startsWith(`/stories/${id}/studio`),
  },
  {
    key: "print",
    label: "Print",
    shortLabel: "Print",
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
  showProgress,
  progressCurrent,
  progressTotal,
  showGenerateAll,
  onGenerateAll,
  isGenerating,
  designUnlocked,
}: {
  storyId: string;
  title: string;
  currentStep: StepKey | number;
  completedSteps: StepKey[] | number;
  showProgress?: boolean;
  progressCurrent?: number;
  progressTotal?: number;
  showGenerateAll?: boolean;
  onGenerateAll?: () => void;
  isGenerating?: boolean;
  designUnlocked?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const [mounted, setMounted] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  useEffect(() => setMounted(true), []);

  // Defensive types
  const safeCurrentStep =
    typeof currentStep === "string" ? currentStep : STEP_ORDER[0];
  const safeCompletedSteps = Array.isArray(completedSteps)
    ? completedSteps
    : [];

  const highestReached = Math.max(
    stepIndex(safeCurrentStep),
    ...safeCompletedSteps.map(stepIndex)
  );

  function getStepState(
    step: Step
  ): "completed" | "active" | "locked" | "idle" {
    const idx = stepIndex(step.key);
    if (mounted && step.match(pathname, storyId)) return "active";
    if (safeCompletedSteps.includes(step.key)) return "completed";
    if (step.key === "design" && designUnlocked) return "idle";
    if (idx > highestReached) return "locked";
    return "idle";
  }

  // Find the active step for mobile display
  const activeStep = STEPS.find(
    (s) => mounted && s.match(pathname, storyId)
  ) || STEPS[0];
  const activeStepIndex = stepIndex(activeStep.key);

  return (
    <>
      {/* Font loader */}
      <link
        href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,300;12..96,400;12..96,600;12..96,700;12..96,800&family=Lora:ital,wght@0,400;0,500;0,600;1,400;1,500&display=swap"
        rel="stylesheet"
      />

      <header
        className="sticky top-0 z-50"
        style={{
          fontFamily: "'Bricolage Grotesque', system-ui, sans-serif",
          background: "rgba(253,251,255,0.88)",
          backdropFilter: "blur(20px) saturate(1.4)",
          borderBottom: "1px solid rgba(180,150,210,0.1)",
        }}
      >
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8">
          {/* ─── DESKTOP ─── */}
          <div className="hidden md:block">
            {/* Top row: back + title + action */}
            <div className="flex items-center justify-between py-3">
              {/* Left: Back + Title */}
              <div className="flex items-center gap-4 min-w-0">
                <button
                  onClick={() => router.push("/projects")}
                  className="flex items-center justify-center w-8 h-8 rounded-xl transition-all hover:scale-105 active:scale-95 flex-shrink-0"
                  style={{
                    background: "rgba(180,150,210,0.08)",
                    border: "none",
                    cursor: "pointer",
                    color: "#8B7BA0",
                  }}
                  title="Back to my books"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>

                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0"
                      style={{
                        background:
                          "linear-gradient(135deg, #B05CE6, #D45DA0)",
                      }}
                    >
                      <span
                        className="text-[9px] font-extrabold text-white"
                        style={{ lineHeight: 1 }}
                      >
                        FW
                      </span>
                    </div>
                    <h1
                      className="text-[15px] font-bold truncate"
                      style={{ color: "#2D2235", letterSpacing: "-0.02em" }}
                    >
                      {title || "Untitled Story"}
                    </h1>
                  </div>
                </div>
              </div>

              {/* Right: Action button */}
              <div className="flex items-center gap-3 flex-shrink-0">
                {showProgress &&
                  progressTotal !== undefined &&
                  progressTotal > 0 && (
                    <div className="flex items-center gap-2.5">
                      <span
                        className="text-[11px] font-semibold"
                        style={{ color: "#8B7BA0" }}
                      >
                        {progressCurrent} of {progressTotal} locked
                      </span>
                      <div
                        className="w-24 h-[5px] rounded-full overflow-hidden"
                        style={{ background: "rgba(180,150,210,0.12)" }}
                      >
                        <motion.div
                          className="h-full rounded-full"
                          style={{
                            background:
                              progressCurrent === progressTotal
                                ? "linear-gradient(90deg, #43B89C, #2FA482)"
                                : "linear-gradient(90deg, #C77DFF, #E07ABA)",
                          }}
                          initial={{ width: 0 }}
                          animate={{
                            width: `${
                              ((progressCurrent || 0) / progressTotal) * 100
                            }%`,
                          }}
                          transition={{
                            duration: 0.6,
                            ease: [0.34, 1.56, 0.64, 1],
                          }}
                        />
                      </div>
                    </div>
                  )}

                {showGenerateAll && onGenerateAll && (
                  <button
                    onClick={onGenerateAll}
                    disabled={isGenerating}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-[12px] font-bold text-white transition-all disabled:opacity-40 active:scale-[0.97]"
                    style={{
                      background: "linear-gradient(135deg, #B05CE6, #D45DA0)",
                      boxShadow: "0 3px 12px rgba(176,92,230,0.2)",
                      border: "none",
                      fontFamily: "inherit",
                      cursor: "pointer",
                    }}
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />{" "}
                        Generating…
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" /> Generate All
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* Journey line */}
            <div className="pb-3 pt-0.5">
              <div className="flex items-center">
                {STEPS.map((step, i) => {
                  const Icon = step.icon;
                  const state = getStepState(step);
                  const isLocked = state === "locked";
                  const isActive = state === "active";
                  const isCompleted = state === "completed";
                  const isLast = i === STEPS.length - 1;

                  return (
                    <div key={step.key} className="flex items-center" style={{ flex: isLast ? "0 0 auto" : 1 }}>
                      {/* Step node */}
                      <motion.button
                        whileHover={!isLocked ? { scale: 1.06 } : undefined}
                        whileTap={!isLocked ? { scale: 0.95 } : undefined}
                        onClick={() =>
                          !isLocked && router.push(step.href(storyId))
                        }
                        className="flex items-center gap-2 relative"
                        style={{
                          background: "none",
                          border: "none",
                          cursor: isLocked ? "not-allowed" : "pointer",
                          fontFamily: "inherit",
                          padding: 0,
                        }}
                      >
                        {/* Dot */}
                        <div
                          className="w-8 h-8 rounded-xl flex items-center justify-center transition-all flex-shrink-0"
                          style={{
                            background: isActive
                              ? "linear-gradient(135deg, #B05CE6, #D45DA0)"
                              : isCompleted
                              ? "linear-gradient(135deg, #43B89C, #2FA482)"
                              : isLocked
                              ? "rgba(180,150,210,0.06)"
                              : "rgba(180,150,210,0.1)",
                            boxShadow: isActive
                              ? "0 3px 12px rgba(176,92,230,0.25)"
                              : isCompleted
                              ? "0 3px 12px rgba(67,184,156,0.2)"
                              : "none",
                          }}
                        >
                          {isCompleted ? (
                            <Check className="w-3.5 h-3.5 text-white" />
                          ) : isLocked ? (
                            <Lock
                              className="w-3 h-3"
                              style={{ color: "#C4B5D4" }}
                            />
                          ) : (
                            <Icon
                              className="w-3.5 h-3.5"
                              style={{
                                color: isActive ? "white" : "#8B7BA0",
                              }}
                            />
                          )}
                        </div>

                        {/* Label */}
                        <span
                          className="text-[11px] font-bold whitespace-nowrap hidden lg:inline"
                          style={{
                            color: isActive
                              ? "#2D2235"
                              : isCompleted
                              ? "#2FA482"
                              : isLocked
                              ? "#C4B5D4"
                              : "#8B7BA0",
                          }}
                        >
                          {step.label}
                        </span>
                      </motion.button>

                      {/* Connector line */}
                      {!isLast && (
                        <div
                          className="flex-1 mx-2"
                          style={{
                            height: 2,
                            borderRadius: 1,
                            background:
                              i < activeStepIndex
                                ? "linear-gradient(90deg, #43B89C, #2FA482)"
                                : i === activeStepIndex
                                ? "linear-gradient(90deg, rgba(176,92,230,0.4), rgba(180,150,210,0.1))"
                                : "rgba(180,150,210,0.1)",
                            minWidth: 16,
                          }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ─── MOBILE ─── */}
          <div className="md:hidden">
            {/* Compact row */}
            <div className="flex items-center justify-between h-14">
              {/* Back */}
              <button
                onClick={() => router.push("/projects")}
                className="flex items-center justify-center w-8 h-8 rounded-xl"
                style={{
                  background: "rgba(180,150,210,0.08)",
                  border: "none",
                  cursor: "pointer",
                  color: "#8B7BA0",
                }}
              >
                <ArrowLeft className="w-4 h-4" />
              </button>

              {/* Center: Current step + title */}
              <button
                onClick={() => setMobileNavOpen(!mobileNavOpen)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl max-w-[60%]"
                style={{
                  background: "rgba(180,150,210,0.06)",
                  border: "1px solid rgba(180,150,210,0.1)",
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                <div
                  className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{
                    background: "linear-gradient(135deg, #B05CE6, #D45DA0)",
                  }}
                >
                  {(() => {
                    const Icon = activeStep.icon;
                    return <Icon className="w-3 h-3 text-white" />;
                  })()}
                </div>
                <span
                  className="text-[13px] font-bold truncate"
                  style={{ color: "#2D2235" }}
                >
                  {activeStep.label}
                </span>
                <ChevronDown
                  className="w-3.5 h-3.5 flex-shrink-0 transition-transform"
                  style={{
                    color: "#A897BD",
                    transform: mobileNavOpen ? "rotate(180deg)" : "none",
                  }}
                />
              </button>

              {/* Right: action or step dots */}
              <div className="flex items-center gap-1.5">
                {showGenerateAll && onGenerateAll ? (
                  <button
                    onClick={onGenerateAll}
                    disabled={isGenerating}
                    className="w-8 h-8 rounded-xl flex items-center justify-center"
                    style={{
                      background: "linear-gradient(135deg, #B05CE6, #D45DA0)",
                      border: "none",
                      cursor: "pointer",
                    }}
                  >
                    {isGenerating ? (
                      <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5 text-white" />
                    )}
                  </button>
                ) : (
                  /* Mini step dots */
                  <div className="flex items-center gap-1">
                    {STEPS.map((step, i) => {
                      const state = getStepState(step);
                      return (
                        <div
                          key={step.key}
                          className="rounded-full transition-all"
                          style={{
                            width: state === "active" ? 16 : 6,
                            height: 6,
                            background:
                              state === "active"
                                ? "linear-gradient(90deg, #B05CE6, #D45DA0)"
                                : state === "completed"
                                ? "#43B89C"
                                : "rgba(180,150,210,0.15)",
                            borderRadius: 3,
                          }}
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Mobile progress bar (inline, compact) */}
            {showProgress &&
              progressTotal !== undefined &&
              progressTotal > 0 && (
                <div className="pb-2.5 -mt-1">
                  <div className="flex items-center gap-2">
                    <div
                      className="flex-1 h-[4px] rounded-full overflow-hidden"
                      style={{ background: "rgba(180,150,210,0.1)" }}
                    >
                      <motion.div
                        className="h-full rounded-full"
                        style={{
                          background:
                            progressCurrent === progressTotal
                              ? "linear-gradient(90deg, #43B89C, #2FA482)"
                              : "linear-gradient(90deg, #C77DFF, #E07ABA)",
                        }}
                        initial={{ width: 0 }}
                        animate={{
                          width: `${
                            ((progressCurrent || 0) / progressTotal) * 100
                          }%`,
                        }}
                        transition={{
                          duration: 0.6,
                          ease: [0.34, 1.56, 0.64, 1],
                        }}
                      />
                    </div>
                    <span
                      className="text-[10px] font-semibold flex-shrink-0"
                      style={{ color: "#A897BD" }}
                    >
                      {progressCurrent}/{progressTotal}
                    </span>
                  </div>
                </div>
              )}

            {/* Mobile nav dropdown */}
            <AnimatePresence>
              {mobileNavOpen && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                  className="overflow-hidden"
                >
                  <div
                    className="pb-4 space-y-1"
                    style={{
                      borderTop: "1px solid rgba(180,150,210,0.08)",
                      paddingTop: 8,
                    }}
                  >
                    {/* Story title */}
                    <div className="px-2 pb-2">
                      <div className="flex items-center gap-2 mb-1">
                        <div
                          className="w-4 h-4 rounded flex items-center justify-center"
                          style={{
                            background:
                              "linear-gradient(135deg, #B05CE6, #D45DA0)",
                          }}
                        >
                          <span
                            className="text-[7px] font-extrabold text-white"
                            style={{ lineHeight: 1 }}
                          >
                            FW
                          </span>
                        </div>
                        <span
                          className="text-[11px] font-medium"
                          style={{ color: "#A897BD" }}
                        >
                          FlipWhizz
                        </span>
                      </div>
                      <p
                        className="text-[13px] font-bold"
                        style={{
                          color: "#2D2235",
                          fontFamily: "'Lora', serif",
                          fontStyle: "italic",
                        }}
                      >
                        {title || "Untitled Story"}
                      </p>
                    </div>

                    {STEPS.map((step, i) => {
                      const Icon = step.icon;
                      const state = getStepState(step);
                      const isLocked = state === "locked";
                      const isActive = state === "active";
                      const isCompleted = state === "completed";

                      return (
                        <button
                          key={step.key}
                          onClick={() => {
                            if (!isLocked) {
                              router.push(step.href(storyId));
                              setMobileNavOpen(false);
                            }
                          }}
                          disabled={isLocked}
                          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all"
                          style={{
                            background: isActive
                              ? "linear-gradient(135deg, rgba(176,92,230,0.08), rgba(212,93,160,0.06))"
                              : "transparent",
                            border: isActive
                              ? "1px solid rgba(176,92,230,0.12)"
                              : "1px solid transparent",
                            cursor: isLocked ? "not-allowed" : "pointer",
                            fontFamily: "inherit",
                            opacity: isLocked ? 0.5 : 1,
                          }}
                        >
                          <div
                            className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{
                              background: isActive
                                ? "linear-gradient(135deg, #B05CE6, #D45DA0)"
                                : isCompleted
                                ? "linear-gradient(135deg, #43B89C, #2FA482)"
                                : "rgba(180,150,210,0.08)",
                            }}
                          >
                            {isCompleted ? (
                              <Check className="w-3.5 h-3.5 text-white" />
                            ) : isLocked ? (
                              <Lock
                                className="w-3 h-3"
                                style={{ color: "#C4B5D4" }}
                              />
                            ) : (
                              <Icon
                                className="w-3.5 h-3.5"
                                style={{
                                  color: isActive ? "white" : "#8B7BA0",
                                }}
                              />
                            )}
                          </div>
                          <span
                            className="text-[13px] font-semibold"
                            style={{
                              color: isActive
                                ? "#2D2235"
                                : isCompleted
                                ? "#2FA482"
                                : "#8B7BA0",
                            }}
                          >
                            {step.label}
                          </span>
                          {isCompleted && (
                            <span
                              className="text-[10px] font-medium ml-auto"
                              style={{ color: "#43B89C" }}
                            >
                              Done
                            </span>
                          )}
                          {isActive && (
                            <span
                              className="text-[10px] font-medium ml-auto"
                              style={{ color: "#B05CE6" }}
                            >
                              Current
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>
    </>
  );
}