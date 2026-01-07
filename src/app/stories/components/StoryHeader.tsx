'use client';

import { usePathname, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  PenLine,
  Users,
  Palette,
  BookOpen,
  Printer,
  Layers,
  Lock,
} from 'lucide-react';
import { StepKey } from '@/lib/storySteps';

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

  return (
    <div className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-white">
      <div className="max-w-7xl mx-auto px-6 py-4 space-y-4">

        {/* TOP ROW */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => router.push('/projects')}
            className="flex items-center gap-2 text-stone-600 hover:text-black font-medium"
          >
            <ArrowLeft className="w-5 h-5" />
            Library
          </button>

          <div className="
            px-4 py-2 rounded-full
            bg-violet-100 text-violet-900
            font-bold text-sm
            max-w-[60vw] truncate
          ">
            {title}
          </div>
        </div>

        {/* STEP TABS */}
        <div className="
          bg-white/90 backdrop-blur-xl
          rounded-2xl
          shadow-lg
          border border-white
          px-4 py-3
          flex flex-wrap gap-2 justify-between
        ">
          {STEPS.map(step => {
            const Icon = step.icon;
            const isActive = pathname.startsWith(step.href(storyId));
            const isComplete = completedSteps.includes(step.key);
            const isLocked =
              !isComplete && step.key !== currentStep &&
              !completedSteps.includes(step.key);

            return (
              <motion.button
                key={step.key}
                whileHover={!isLocked ? { scale: 1.05 } : undefined}
                whileTap={!isLocked ? { scale: 0.96 } : undefined}
                onClick={() => {
                  if (!isLocked) router.push(step.href(storyId));
                }}
                className={`
                  flex items-center gap-2
                  px-4 py-2 rounded-full
                  text-sm font-bold
                  transition-all
                  ${
                    isActive
                      ? 'bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-md'
                      : isComplete
                      ? 'bg-emerald-100 text-emerald-800'
                      : isLocked
                      ? 'bg-stone-100 text-stone-400 cursor-not-allowed'
                      : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                  }
                `}
              >
                {isLocked ? (
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
  );
}
