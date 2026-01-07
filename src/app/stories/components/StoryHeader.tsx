// src/app/stories/components/StoryHeader.tsx
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

function highestReachedIndex(currentStep: StepKey, completedSteps: StepKey[]) {
  return Math.max(stepIndex(currentStep), ...completedSteps.map(stepIndex));
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
    href: id => `/stories/${id}/pages`,
    match: (p, id) =>
      p === `/stories/${id}` || p.startsWith(`/stories/${id}/hub`),
  },
  {
    key: "extract",
    label: "Characters",
    icon: Users,
    href: id => `/stories/${id}/characters`,
    match: (p, id) => p.startsWith(`/stories/${id}/characters`),
  },
  {
    key: "locations",
    label: "Locations",
    icon: Map,
    href: id => `/stories/${id}/locations`,
    match: (p, id) => p.startsWith(`/stories/${id}/locations`),
  },
  {
    key: "design",
    label: "Design",
    icon: Palette,
    href: id => `/stories/${id}/design`,
    match: (p, id) => p.startsWith(`/stories/${id}/design`),
  },
  {
    key: "studio",
    label: "Studio",
    icon: Layers,
    href: id => `/stories/${id}/studio`,
    match: (p, id) => p.startsWith(`/stories/${id}/studio`),
  },
  {
    key: "print",
    label: "Print",
    icon: Printer,
    href: id => `/stories/${id}/checkout`,
    match: (p, id) => p.startsWith(`/stories/${id}/checkout`),
  },
];

/* ======================================================
   COMPONENT
====================================================== */

export default function StoryHeader({
  storyId,
  title,
  currentStep,
  completedSteps,
}: {
  storyId: string;
  title: string;
  currentStep: StepKey;
  completedSteps: StepKey[];
}) {
  const router = useRouter();
  const pathname = usePathname();

  /** 🔑 hydration fix */
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const reached = highestReachedIndex(currentStep, completedSteps);
  const canEnterStudio = reached >= stepIndex("design");
  const canEnterPrint = reached >= stepIndex("studio");

  function isLocked(step: StepKey) {
    if (step === "studio") return !canEnterStudio;
    if (step === "print") return !canEnterPrint;
    return false;
  }

  return (
    <div className="sticky top-0 z-50 bg-white/80 border-b border-white">
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between gap-4">

          {/* BACK */}
          <button
            onClick={() => router.push("/projects")}
            className="flex items-center gap-2 text-stone-600 hover:text-black font-medium"
          >
            <ArrowLeft className="w-5 h-5" />
            Library
          </button>

          {/* STEP TABS */}
          <div
            className={`
              bg-white/90
              border border-white
              px-4 py-3
              flex flex-wrap gap-2
              rounded-2xl shadow-lg
              ${mounted ? "backdrop-blur-xl" : ""}
            `}
          >
            {STEPS.map(step => {
              const Icon = step.icon;
              const locked = isLocked(step.key);

              // 🔒 IMPORTANT: active is only calculated AFTER mount
              const active = mounted && step.match(pathname, storyId);

              return (
                <motion.button
                  key={step.key}
                  whileHover={!locked ? { scale: 1.05 } : undefined}
                  whileTap={!locked ? { scale: 0.96 } : undefined}
                  onClick={() => !locked && router.push(step.href(storyId))}
                  className={`
                    flex items-center gap-2
                    px-4 py-2 rounded-full
                    text-sm font-bold
                    transition-all
                    ${
                      active
                        ? "bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-md"
                        : locked
                        ? "bg-stone-100 text-stone-400 cursor-not-allowed"
                        : "bg-stone-100 text-stone-700 hover:bg-stone-200"
                    }
                  `}
                >
                  {locked ? (
                    <Lock className="w-4 h-4 opacity-60" />
                  ) : (
                    <Icon className="w-4 h-4" />
                  )}
                  {step.label}
                </motion.button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
