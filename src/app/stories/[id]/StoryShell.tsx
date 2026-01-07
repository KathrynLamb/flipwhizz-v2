'use client';

import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  BookOpen,
  PenLine,
  Users,
  Palette,
  Layers,
  Printer,
} from "lucide-react";
import type { StepKey } from "@/lib/storySteps";

/* ======================================================
   STEP CONFIG
====================================================== */

type StepConfig = {
  key: StepKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  href: (id: string) => string;
  match: (pathname: string, id: string) => boolean;
};

const STEPS: StepConfig[] = [
  {
    key: "write",
    label: "Write",
    icon: PenLine,
    href: id => `/stories/${id}/hub`,
    match: (p, id) =>
      p === `/stories/${id}` ||
      p.startsWith(`/stories/${id}/hub`),
  },
  {
    key: "extract",
    label: "Review",
    icon: Users,
    href: id => `/stories/${id}/characters`,
    match: (p, id) =>
      p.startsWith(`/stories/${id}/characters`) ||
      p.startsWith(`/stories/${id}/locations`),
  },
  {
    key: "design",
    label: "Design",
    icon: Palette,
    href: id => `/stories/${id}/design`,
    match: (p, id) =>
      p.startsWith(`/stories/${id}/design`) ||
      p.startsWith(`/stories/${id}/pages`),
  },
  {
    key: "studio",
    label: "Studio",
    icon: Layers,
    href: id => `/stories/${id}/studio`,
    match: (p, id) =>
      p.startsWith(`/stories/${id}/studio`),
  },
  {
    key: "print",
    label: "Print",
    icon: Printer,
    href: id => `/stories/${id}/checkout`,
    match: (p, id) =>
      p.startsWith(`/stories/${id}/checkout`) ||
      p.startsWith(`/stories/${id}/print`),
  },
];

/* ======================================================
   COMPONENT
====================================================== */

export default function StoryJourneyShell({
  storyId,
  title,
  status,
  currentStep,
  completedSteps,
  children,
}: {
  storyId: string;
  title: string;
  status: string;
  currentStep: StepKey;
  completedSteps: StepKey[];
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-fuchsia-50 to-amber-50">
      {/* TOP BAR */}
      <div className="fixed top-0 inset-x-0 z-50 bg-white/80 backdrop-blur border-b border-white">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <button
            onClick={() => router.push("/projects")}
            className="flex items-center gap-2 text-stone-600 hover:text-black font-medium"
          >
            <ArrowLeft className="w-5 h-5" />
            Library
          </button>

          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-violet-100">
            <BookOpen className="w-4 h-4 text-violet-600" />
            <span className="text-sm font-bold text-violet-900">
              {title}
            </span>
          </div>
        </div>
      </div>

      {/* STEP BAR */}
      <div className="pt-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl border border-white px-6 py-4 flex flex-wrap justify-between gap-3">
            {STEPS.map(step => {
              const Icon = step.icon;
              const isActive = step.match(pathname, storyId);
              const isComplete = completedSteps.includes(step.key);

              return (
                <motion.button
                  key={step.key}
                  whileHover={{ scale: 1.05 }}
                  onClick={() => router.push(step.href(storyId))}
                  className={`
                    flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold
                    transition-all
                    ${
                      isActive
                        ? "bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-lg"
                        : isComplete
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-stone-100 text-stone-500"
                    }
                  `}
                >
                  <Icon className="w-4 h-4" />
                  {step.label}
                </motion.button>
              );
            })}
          </div>
        </div>
      </div>

      {/* PAGE CONTENT */}
      <motion.main
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="pt-10 pb-20"
      >
        {children}
      </motion.main>
    </div>
  );
}
