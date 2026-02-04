'use client';

import { usePathname, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  BookOpen,
  PenLine,
  Users,
  Palette,
  Layers,
  Printer,
  Lock,
} from 'lucide-react';
import type { StepKey } from '@/lib/storySteps';
import StoryHeader from '@/app/stories/components/StoryHeader';

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
    key: 'write',
    label: 'Write',
    icon: PenLine,
    href: id => `/stories/${id}/hub`,
    match: (p, id) =>
      p === `/stories/${id}` || p.startsWith(`/stories/${id}/hub`),
  },
  {
    key: 'extract',
    label: 'Review',
    icon: Users,
    href: id => `/stories/${id}/characters`,
    match: (p, id) =>
      p.startsWith(`/stories/${id}/characters`) ||
      p.startsWith(`/stories/${id}/locations`),
  },
  {
    key: 'design',
    label: 'Design',
    icon: Palette,
    href: id => `/stories/${id}/design`,
    match: (p, id) =>
      p.startsWith(`/stories/${id}/design`) ||
      p.startsWith(`/stories/${id}/pages`),
  },
  {
    key: 'studio',
    label: 'Studio',
    icon: Layers,
    href: id => `/stories/${id}/studio`,
    match: (p, id) => p.startsWith(`/stories/${id}/studio`),
  },
  {
    key: 'print',
    label: 'Print',
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
  currentStep,
  completedSteps,
  children,
}: {
  storyId: string;
  title: string;
  currentStep: StepKey;
  completedSteps: StepKey[];
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-white">
      {/* ==================================================
          HEADER
      ================================================== */}
      {/* <StoryHeader
        storyId={storyId}
        title={title}
        currentStep={currentStep}
        completedSteps={completedSteps}
      /> */}

      {/* ==================================================
          PAGE CONTENT
      ================================================== */}
      <motion.main
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="pb-20"
      >
        {children}
      </motion.main>
    </div>
  );
}
