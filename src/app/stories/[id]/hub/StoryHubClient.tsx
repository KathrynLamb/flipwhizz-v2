'use client';

import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Sparkles,
  Users,
  MapPin,
  Palette,
  Check,
  Wand2,
  BookOpen,
  Image as ImageIcon,
  Lock,
  ChevronRight,
} from 'lucide-react';

/* ======================================================
   ANIMATION TOKENS
====================================================== */

const easeOut: [number, number, number, number] = [0.16, 1, 0.3, 1];

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: easeOut, delay: i * 0.08 },
  }),
};


const colorClasses: Record<StatColor, string> = {
  purple: 'text-purple-600',
  pink: 'text-pink-600',
  blue: 'text-blue-600',
  fuchsia: 'text-fuchsia-600',
};

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

/* ======================================================
   MAIN COMPONENT - RESPONSIVE
====================================================== */

export default function StoryHubClient({ story, hub }: StoryHubClientProps) {
  const router = useRouter();

  const steps = [
    {
      number: 1,
      icon: BookOpen,
      title: 'Write Story',
      subtitle: `${hub.steps.write.pageCount} pages`,
      complete: hub.steps.write.complete,
      locked: false,
      path: `/stories/${story.id}/write`,
    },
    {
      number: 2,
      icon: Wand2,
      title: 'Extract World',
      subtitle: `${hub.steps.extract.characters} characters, ${hub.steps.extract.locations} places`,
      complete:
        hub.steps.extract.characters > 0 && hub.steps.extract.locations > 0,
      locked: !hub.steps.write.complete,
      path: `/stories/${story.id}/extract`,
    },
    {
      number: 3,
      icon: Palette,
      title: 'Design Characters',
      subtitle: `${hub.steps.design.charactersConfirmed}/${hub.steps.design.charactersTotal} confirmed`,
      complete: hub.steps.design.complete,
      locked: !hub.steps.design.unlocked,
      path: `/stories/${story.id}/characters`,
    },
    {
      number: 4,
      icon: ImageIcon,
      title: 'Create Art',
      subtitle: 'Generate illustrations',
      complete: false,
      locked: !hub.steps.design.complete,
      path: `/stories/${story.id}/art`,
    },
  ];

  return (
    <>
      {/* DESKTOP VERSION - Track Layout */}
      <div className="hidden md:block h-screen overflow-hidden bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50">
        <DesktopLayout story={story} hub={hub} steps={steps} router={router} />
      </div>

      {/* MOBILE VERSION - Stacked Cards */}
      <div className="md:hidden min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50">
        <MobileLayout story={story} hub={hub} steps={steps} router={router} />
      </div>
    </>
  );
}

/* ======================================================
   DESKTOP LAYOUT
====================================================== */

function DesktopLayout({ story, hub, steps, router }: any) {
  return (
    <div className="h-full flex flex-col">
      {/* HEADER */}
      <header className="flex-shrink-0 bg-white/80 backdrop-blur-xl border-b border-gray-200/50 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <button
            onClick={() => router.push('/dashboard')}
            className="flex items-center gap-2 text-gray-600 hover:text-black transition-colors font-semibold"
          >
            <ArrowLeft className="w-4 h-4" />
            All Stories
          </button>

          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 shadow-lg"
          >
            <Sparkles className="w-4 h-4 text-white" />
            <span className="text-sm font-black text-white">
              {hub.progressPercent}% Complete
            </span>
          </motion.div>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="flex-1 overflow-hidden px-6 py-8">
        <div className="max-w-6xl mx-auto h-full flex flex-col">
          {/* TITLE */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-10 flex-shrink-0"
          >
            <h1 className="text-4xl md:text-6xl font-black mb-3 bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 bg-clip-text text-transparent leading-tight">
              {story.title}
            </h1>
            <p className="text-sm md:text-base text-stone-600 font-medium">
              Follow your story's journey to completion
            </p>
          </motion.div>

          {/* JOURNEY TRACK */}
          <div className="flex-1 flex items-center justify-center">
            <div className="w-full relative">
              {/* Progress Track */}
              <div className="absolute top-20 left-0 right-0 h-1 bg-gray-200 rounded-full">
                <motion.div
                  className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full"
                  initial={{ width: '0%' }}
                  animate={{ width: `${hub.progressPercent}%` }}
                  transition={{ duration: 1, ease: easeOut, delay: 0.5 }}
                />
              </div>

              {/* Steps */}
              <div className="relative grid grid-cols-4 gap-8">
                {steps.map((step: any, index: number) => (
                  <DesktopStepCard
                    key={step.number}
                    {...step}
                    index={index}
                    onClick={() => !step.locked && router.push(step.path)}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* QUICK STATS */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="flex-shrink-0 mt-8"
          >
            <div className="grid grid-cols-4 gap-3">
              <QuickStat icon={Users} value={hub.steps.design.charactersTotal} label="Characters" />
              <QuickStat icon={MapPin} value={hub.steps.design.locationsTotal} label="Locations" />
              <QuickStat icon={BookOpen} value={hub.steps.write.pageCount} label="Pages" />
              <QuickStat
                icon={Palette}
                value={hub.steps.design.styleReady ? '✓' : '—'}
                label="Style"
              />
            </div>
          </motion.div>
        </div>
      </main>
    </div>
  );
}

/* ======================================================
   MOBILE LAYOUT
====================================================== */

function MobileLayout({ story, hub, steps, router }: any) {
  return (
    <>
      {/* HEADER */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-200/50 px-4 py-3">
        <div className="flex items-center justify-between">
          <button
            onClick={() => router.push('/dashboard')}
            className="flex items-center gap-2 text-gray-600 hover:text-black transition-colors font-semibold text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            All Stories
          </button>

          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 shadow-lg"
          >
            <Sparkles className="w-3.5 h-3.5 text-white" />
            <span className="text-xs font-black text-white">
              {hub.progressPercent}%
            </span>
          </motion.div>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="px-4 py-6">
        <div className="max-w-2xl mx-auto">
          {/* TITLE */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-6"
          >
            <h1 className="text-3xl font-black mb-2 bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 bg-clip-text text-transparent leading-tight">
              {story.title}
            </h1>
            <p className="text-sm text-stone-600 font-medium">
              Follow your story's journey to completion
            </p>
          </motion.div>

          {/* PROGRESS BAR */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-6 bg-white/90 backdrop-blur-xl rounded-2xl p-5 border-2 border-white shadow-lg"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-bold text-gray-700">Overall Progress</span>
              <span className="text-2xl font-black bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                {hub.progressPercent}%
              </span>
            </div>
            <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-purple-500 via-pink-500 to-blue-500 rounded-full"
                initial={{ width: '0%' }}
                animate={{ width: `${hub.progressPercent}%` }}
                transition={{ duration: 1, ease: easeOut, delay: 0.3 }}
              />
            </div>
          </motion.div>

          {/* STEPS */}
          <div className="space-y-3 mb-6">
            {steps.map((step: any, index: number) => (
              <MobileStepCard
                key={step.number}
                {...step}
                index={index}
                onClick={() => !step.locked && router.push(step.path)}
              />
            ))}
          </div>

          {/* QUICK STATS */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <div className="grid grid-cols-2 gap-3">
              <QuickStatMobile
                icon={Users}
                value={hub.steps.design.charactersTotal}
                label="Characters"
                color="purple"
              />
              <QuickStatMobile
                icon={MapPin}
                value={hub.steps.design.locationsTotal}
                label="Locations"
                color="pink"
              />
              <QuickStatMobile
                icon={BookOpen}
                value={hub.steps.write.pageCount}
                label="Pages"
                color="blue"
              />
              <QuickStatMobile
                icon={Palette}
                value={hub.steps.design.styleReady ? '✓' : '—'}
                label="Style"
                color="fuchsia"
              />
            </div>
          </motion.div>
        </div>
      </main>
    </>
  );
}

/* ======================================================
   DESKTOP STEP CARD
====================================================== */

function DesktopStepCard({
  number,
  icon: Icon,
  title,
  subtitle,
  complete,
  locked,
  index,
  onClick,
}: any) {
  return (
    <motion.button
      custom={index}
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      onClick={onClick}
      disabled={locked}
      whileHover={!locked ? { y: -8, scale: 1.02 } : {}}
      whileTap={!locked ? { scale: 0.98 } : {}}
      className={`
        relative text-center
        bg-white rounded-3xl p-6
        border-4 transition-all duration-300
        ${
          locked
            ? 'border-gray-200 cursor-not-allowed opacity-60'
            : complete
            ? 'border-emerald-400 shadow-xl shadow-emerald-500/20'
            : 'border-purple-300 shadow-xl hover:shadow-2xl hover:border-purple-400'
        }
      `}
    >
      {/* Icon on Track */}
      <div className="absolute -top-16 left-1/2 -translate-x-1/2">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{
            type: 'spring',
            stiffness: 200,
            damping: 15,
            delay: 0.3 + index * 0.1,
          }}
          className={`
            w-20 h-20 rounded-full flex items-center justify-center shadow-2xl
            ${
              complete
                ? 'bg-gradient-to-br from-emerald-400 to-emerald-600'
                : locked
                ? 'bg-gray-300'
                : 'bg-gradient-to-br from-purple-500 to-pink-500'
            }
          `}
        >
          {complete ? (
            <Check className="w-10 h-10 text-white" strokeWidth={3} />
          ) : locked ? (
            <Lock className="w-8 h-8 text-gray-500" />
          ) : (
            <Icon className="w-9 h-9 text-white" strokeWidth={2.5} />
          )}
        </motion.div>

        <div
          className={`
            absolute -top-1 -right-1 w-7 h-7 rounded-full flex items-center justify-center font-black text-xs shadow-lg
            ${
              complete
                ? 'bg-emerald-600 text-white'
                : 'bg-gradient-to-br from-purple-600 to-pink-600 text-white'
            }
          `}
        >
          {number}
        </div>
      </div>

      <div className="mt-8">
        <h3
          className={`text-xl font-black mb-2 ${
            locked ? 'text-gray-400' : 'text-gray-900'
          }`}
        >
          {title}
        </h3>
        <p
          className={`text-sm font-semibold ${
            locked ? 'text-gray-400' : 'text-gray-600'
          }`}
        >
          {subtitle}
        </p>

        <div className="mt-4">
          {complete ? (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-100 text-emerald-700 font-bold text-sm">
              <Check className="w-4 h-4" />
              Complete
            </div>
          ) : locked ? (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-200 text-gray-500 font-bold text-sm">
              <Lock className="w-3.5 h-3.5" />
              Locked
            </div>
          ) : (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-purple-100 text-purple-700 font-bold text-sm">
              <Sparkles className="w-4 h-4" />
              Ready
            </div>
          )}
        </div>
      </div>
    </motion.button>
  );
}

/* ======================================================
   MOBILE STEP CARD
====================================================== */

function MobileStepCard({ number, icon: Icon, title, subtitle, complete, locked, index, onClick }: any) {
  return (
    <motion.button
      custom={index}
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      onClick={onClick}
      disabled={locked}
      whileTap={!locked ? { scale: 0.98 } : {}}
      className={`
        relative w-full text-left
        bg-white/90 backdrop-blur-xl rounded-3xl p-4
        border-4 transition-all
        ${
          locked
            ? 'border-gray-200 cursor-not-allowed opacity-60'
            : complete
            ? 'border-emerald-400 shadow-lg'
            : 'border-purple-300 shadow-lg active:shadow-md'
        }
      `}
    >
      <div className="absolute -top-2 -left-2 w-7 h-7 rounded-full flex items-center justify-center font-black text-xs shadow-lg z-10 bg-gradient-to-br from-purple-500 to-pink-500 text-white">
        {number}
      </div>

      <div className="flex items-start gap-3">
        <div
          className={`
            flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center
            ${
              complete
                ? 'bg-gradient-to-br from-emerald-400 to-emerald-600'
                : locked
                ? 'bg-gray-300'
                : 'bg-gradient-to-br from-purple-500 to-pink-500'
            }
          `}
        >
          {complete ? (
            <Check className="w-6 h-6 text-white" strokeWidth={3} />
          ) : locked ? (
            <Lock className="w-5 h-5 text-gray-500" />
          ) : (
            <Icon className="w-6 h-6 text-white" strokeWidth={2.5} />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h3 className={`text-lg font-black mb-0.5 ${locked ? 'text-gray-400' : 'text-gray-900'}`}>
            {title}
          </h3>
          <p className={`text-xs font-semibold mb-2 ${locked ? 'text-gray-400' : 'text-gray-600'}`}>
            {subtitle}
          </p>

          {complete ? (
            <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 font-bold text-xs">
              <Check className="w-3 h-3" strokeWidth={3} />
              Complete
            </div>
          ) : locked ? (
            <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-gray-200 text-gray-500 font-bold text-xs">
              <Lock className="w-2.5 h-2.5" />
              Locked
            </div>
          ) : (
            <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-purple-100 text-purple-700 font-bold text-xs">
              <Sparkles className="w-3 h-3" />
              Ready
            </div>
          )}
        </div>

        {!locked && <ChevronRight className="flex-shrink-0 w-5 h-5 text-purple-400 mt-2" />}
      </div>
    </motion.button>
  );
}

/* ======================================================
   QUICK STATS
====================================================== */

function QuickStat({ icon: Icon, value, label }: any) {
  return (
    <div className="bg-white/90 backdrop-blur-xl rounded-2xl p-4 border-2 border-white shadow-lg text-center">
      <Icon className="w-5 h-5 text-purple-600 mx-auto mb-2" strokeWidth={2.5} />
      <div className="text-2xl md:text-3xl font-black text-gray-900">{value}</div>
      <div className="text-xs font-bold text-gray-600 uppercase tracking-wide">{label}</div>
    </div>
  );
}

type StatColor = 'purple' | 'pink' | 'blue' | 'fuchsia';


function QuickStatMobile({
  icon: Icon,
  value,
  label,
  color,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  value: React.ReactNode;
  label: string;
  color: StatColor;
}) {


  return (
    <div className="bg-white/90 backdrop-blur-xl rounded-2xl p-4 border-2 border-white shadow-lg text-center">
      <Icon className={`w-5 h-5 ${colorClasses[color]} mx-auto mb-2`} strokeWidth={2.5} />
      <div className="text-2xl font-black text-gray-900">{value}</div>
      <div className="text-xs font-bold text-gray-600 uppercase tracking-wide">{label}</div>
    </div>
  );
}