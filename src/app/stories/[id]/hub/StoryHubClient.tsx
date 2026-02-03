'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Sparkles,
  Check,
  Wand2,
  BookOpen,
  Image as ImageIcon,
  Lock,
  ChevronRight,
  Palette,
  X,
  Menu,
  ArrowRight,
} from 'lucide-react';

/* ======================================================
   TYPES
====================================================== */

type StoryHubClientProps = {
  story: {
    id: string;
    title: string;
  };
  hub: {
    progressPercent: number;
    steps: {
      write: { complete: boolean; pageCount: number };
      extract: { characters: number; locations: number; scenes: number };
      design: {
        charactersConfirmed: number;
        charactersTotal: number;
        locationsConfirmed: number;
        locationsTotal: number;
        unlocked: boolean;
        styleReady: boolean;
        complete: boolean;
      };
    };
  };
};

type Step = {
  number: number;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
  subtitle: string;
  complete: boolean;
  locked: boolean;
  active: boolean;
  path: string;
};

/* ======================================================
   DERIVE STEPS + NEXT STEP
====================================================== */

function deriveSteps(story: StoryHubClientProps['story'], hub: StoryHubClientProps['hub'], pathname: string): Step[] {
  const steps: Step[] = [
    {
      number: 1,
      icon: BookOpen,
      title: 'Story',
      subtitle: `${hub.steps.write.pageCount} pages`,
      complete: hub.steps.write.complete,
      locked: false,
      active: pathname.includes('/pages') || pathname.includes('/edit'),
      path: `/stories/${story.id}/pages`,
    },
    {
      number: 2,
      icon: Wand2,
      title: 'World',
      subtitle: `${hub.steps.extract.characters} chars, ${hub.steps.extract.locations} places`,
      complete: hub.steps.extract.characters > 0 && hub.steps.extract.locations > 0,
      locked: !hub.steps.write.complete,
      active: pathname.includes('/extract') || pathname.includes('/characters'),
      path: `/stories/${story.id}/characters`,
    },
    {
      number: 3,
      icon: Palette,
      title: 'Design',
      subtitle: `${hub.steps.design.charactersConfirmed}/${hub.steps.design.charactersTotal} confirmed`,
      complete: hub.steps.design.complete,
      locked: !hub.steps.design.unlocked,
      active: pathname.includes('/design'),
      path: `/stories/${story.id}/design`,
    },
    {
      number: 4,
      icon: ImageIcon,
      title: 'Illustrate',
      subtitle: 'Generate art',
      complete: false,
      locked: !hub.steps.design.complete,
      active: pathname.includes('/studio') || pathname.includes('/art'),
      path: `/stories/${story.id}/studio`,
    },
    {
      number: 5,
      icon: BookOpen,
      title: 'Print',
      subtitle: 'Order your book',
      complete: false,
      locked: true, // unlocks after illustrations
      active: pathname.includes('/cover') || pathname.includes('/checkout'),
      path: `/stories/${story.id}/cover`,
    },
  ];
  return steps;
}

function getNextStep(steps: Step[]): Step | null {
  // First incomplete, unlocked step
  return steps.find(s => !s.complete && !s.locked) ?? null;
}

/* ======================================================
   MAIN COMPONENT
====================================================== */

export default function StoryHubClient({ story, hub }: StoryHubClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const steps = deriveSteps(story, hub, pathname);
  const nextStep = getNextStep(steps);

  // If we're on /hub itself, show the hub landing. Otherwise just render the nav.
  const isHubLanding = pathname.endsWith('/hub');

  return (
    <>
      {/* ============ DESKTOP NAV ============ */}
      <nav className="hidden md:flex flex-col bg-white border-b border-gray-200 shadow-sm sticky top-0 z-50">
        {/* Top row: back + title + progress */}
        <div className="px-6 py-3 flex items-center justify-between border-b border-gray-100">
          <button
            onClick={() => router.push('/projects')}
            className="flex items-center gap-2 text-gray-500 hover:text-gray-900 transition-colors text-sm font-semibold"
          >
            <ArrowLeft className="w-4 h-4" />
            All Stories
          </button>

          <h1 className="text-base font-black text-gray-900 tracking-tight">
            {story.title}
          </h1>

          <div className="flex items-center gap-3">
            {/* Progress pill */}
            <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 shadow-sm">
              <Sparkles className="w-3.5 h-3.5 text-white" />
              <span className="text-xs font-black text-white">{hub.progressPercent}% Complete</span>
            </div>

            {/* Next Step CTA */}
            {nextStep && (
              <button
                onClick={() => router.push(nextStep.path)}
                className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-gray-900 text-white text-xs font-black shadow-sm hover:bg-gray-700 transition-colors"
              >
                Next: {nextStep.title}
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Step pills row */}
        <div className="px-6 py-2.5 flex items-center gap-2">
          {steps.map((step, i) => {
            const Icon = step.icon;
            return (
              <div key={step.number} className="flex items-center gap-2">
                <button
                  onClick={() => !step.locked && router.push(step.path)}
                  disabled={step.locked}
                  className={`
                    flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all
                    ${step.locked
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : step.complete
                        ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                        : step.active
                          ? 'bg-purple-600 text-white shadow-md'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }
                  `}
                >
                  {step.complete ? (
                    <Check className="w-3 h-3" strokeWidth={3} />
                  ) : step.locked ? (
                    <Lock className="w-3 h-3" />
                  ) : (
                    <Icon className="w-3 h-3" strokeWidth={2.5} />
                  )}
                  {step.title}
                </button>

                {/* Connector line between pills */}
                {i < steps.length - 1 && (
                  <div className={`w-4 h-0.5 rounded-full ${step.complete ? 'bg-emerald-300' : 'bg-gray-200'}`} />
                )}
              </div>
            );
          })}
        </div>
      </nav>

      {/* ============ MOBILE NAV ============ */}
      <nav className="md:hidden sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
        {/* Top bar */}
        <div className="px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => router.push('/projects')}
            className="flex items-center gap-1.5 text-gray-500 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <h1 className="text-sm font-black text-gray-900 tracking-tight truncate mx-2">
            {story.title}
          </h1>

          <div className="flex items-center gap-2">
            {/* Mini progress ring */}
            <ProgressRing percent={hub.progressPercent} />

            {/* Hamburger */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            >
              {mobileMenuOpen ? <X className="w-5 h-5 text-gray-700" /> : <Menu className="w-5 h-5 text-gray-700" />}
            </button>
          </div>
        </div>

        {/* Collapsible step list */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="overflow-hidden border-t border-gray-100 bg-gray-50"
            >
              <div className="px-4 py-3 space-y-2">
                {steps.map((step) => {
                  const Icon = step.icon;
                  return (
                    <button
                      key={step.number}
                      onClick={() => {
                        if (!step.locked) {
                          router.push(step.path);
                          setMobileMenuOpen(false);
                        }
                      }}
                      disabled={step.locked}
                      className={`
                        w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all
                        ${step.locked
                          ? 'opacity-50 cursor-not-allowed'
                          : step.active
                            ? 'bg-purple-600 text-white'
                            : 'bg-white hover:bg-gray-100 text-gray-700'
                        }
                      `}
                    >
                      <div className={`
                        w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0
                        ${step.locked
                          ? 'bg-gray-200'
                          : step.complete
                            ? 'bg-emerald-100'
                            : step.active
                              ? 'bg-white/20'
                              : 'bg-gray-100'
                        }
                      `}>
                        {step.complete ? (
                          <Check className={`w-4 h-4 ${step.active ? 'text-white' : 'text-emerald-600'}`} strokeWidth={3} />
                        ) : step.locked ? (
                          <Lock className="w-4 h-4 text-gray-400" />
                        ) : (
                          <Icon className={`w-4 h-4 ${step.active ? 'text-white' : 'text-gray-600'}`} strokeWidth={2.5} />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className={`text-sm font-bold ${step.active ? 'text-white' : 'text-gray-900'}`}>{step.title}</div>
                        <div className={`text-xs ${step.active ? 'text-white/70' : 'text-gray-500'}`}>{step.subtitle}</div>
                      </div>

                      {step.complete && (
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${step.active ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-700'}`}>
                          Done
                        </span>
                      )}

                      {!step.locked && !step.complete && (
                        <ChevronRight className={`w-4 h-4 flex-shrink-0 ${step.active ? 'text-white' : 'text-gray-400'}`} />
                      )}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* ============ HUB LANDING (only on /hub) ============ */}
      {isHubLanding && (
        <div className="min-h-[calc(100vh-140px)] bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 flex flex-col items-center justify-center px-4 py-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center max-w-md w-full"
          >
            <h2 className="text-2xl md:text-4xl font-black mb-3 bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 bg-clip-text text-transparent leading-tight">
              {story.title}
            </h2>
            <p className="text-sm text-gray-500 font-medium mb-8">
              Use the nav above to move between steps, or tap below to jump to where you left off.
            </p>

            {/* Next Step hero CTA */}
            {nextStep && (
              <button
                onClick={() => router.push(nextStep.path)}
                className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-2xl bg-gradient-to-r from-purple-600 to-pink-500 text-white shadow-lg shadow-purple-300/40 hover:shadow-xl hover:shadow-purple-300/50 transition-all active:scale-95"
              >
                <nextStep.icon className="w-5 h-5" strokeWidth={2.5} />
                <span className="text-base font-black">Continue: {nextStep.title}</span>
                <ArrowRight className="w-5 h-5" />
              </button>
            )}

            {/* Mini step summary */}
            <div className="mt-8 flex justify-center gap-3">
              {steps.map((step) => (
                <div
                  key={step.number}
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black shadow-sm
                    ${step.complete
                      ? 'bg-emerald-500 text-white'
                      : step.locked
                        ? 'bg-gray-200 text-gray-400'
                        : 'bg-purple-500 text-white'
                    }
                  `}
                >
                  {step.complete ? <Check className="w-4 h-4" strokeWidth={3} /> : step.number}
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      )}
    </>
  );
}

/* ======================================================
   PROGRESS RING (mobile)
====================================================== */

function ProgressRing({ percent }: { percent: number }) {
  const radius = 10;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percent / 100) * circumference;

  return (
    <div className="relative w-7 h-7">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r={radius} fill="none" stroke="#e5e7eb" strokeWidth="3" />
        <circle
          cx="12" cy="12" r={radius}
          fill="none"
          stroke="url(#progressGradient)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
        <defs>
          <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#a855f7" />
            <stop offset="100%" stopColor="#ec4899" />
          </linearGradient>
        </defs>
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[8px] font-black text-gray-700">
        {percent}
      </span>
    </div>
  );
}