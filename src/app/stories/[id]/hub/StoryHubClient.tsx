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
    transition: { duration: 0.5, ease: easeOut, delay: i * 0.1 },
  }),
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
   COMPONENT
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
    <div className="h-screen overflow-hidden bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 flex flex-col">
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
            {/* DESKTOP: Horizontal Track */}
            <div className="hidden md:block w-full">
              <div className="relative">
                {/* Progress Track */}
                <div className="absolute top-20 left-0 right-0 h-1 bg-gray-200 rounded-full">
                  <motion.div
                    className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full"
                    initial={{ width: '0%' }}
                    animate={{ width: `${(hub.progressPercent / 100) * 100}%` }}
                    transition={{ duration: 1, ease: easeOut, delay: 0.5 }}
                  />
                </div>

                {/* Steps */}
                <div className="relative grid grid-cols-4 gap-8">
                  {steps.map((step, index) => (
                    <StepCard
                      key={step.number}
                      {...step}
                      index={index}
                      onClick={() =>
                        !step.locked && router.push(step.path)
                      }
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* MOBILE: Vertical Track */}
            <div className="md:hidden w-full max-w-md">
              <div className="relative">
                {/* Progress Track */}
                <div className="absolute top-0 bottom-0 left-12 w-1 bg-gray-200 rounded-full">
                  <motion.div
                    className="w-full bg-gradient-to-b from-emerald-400 to-emerald-600 rounded-full"
                    initial={{ height: '0%' }}
                    animate={{ height: `${(hub.progressPercent / 100) * 100}%` }}
                    transition={{ duration: 1, ease: easeOut, delay: 0.5 }}
                  />
                </div>

                {/* Steps */}
                <div className="relative space-y-8">
                  {steps.map((step, index) => (
                    <StepCardMobile
                      key={step.number}
                      {...step}
                      index={index}
                      onClick={() =>
                        !step.locked && router.push(step.path)
                      }
                    />
                  ))}
                </div>
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
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <QuickStat
                icon={Users}
                value={hub.steps.design.charactersTotal}
                label="Characters"
              />
              <QuickStat
                icon={MapPin}
                value={hub.steps.design.locationsTotal}
                label="Locations"
              />
              <QuickStat
                icon={BookOpen}
                value={hub.steps.write.pageCount}
                label="Pages"
              />
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
   STEP CARD (Desktop)
====================================================== */

function StepCard({
  number,
  icon: Icon,
  title,
  subtitle,
  complete,
  locked,
  index,
  onClick,
}: {
  number: number;
  icon: any;
  title: string;
  subtitle: string;
  complete?: boolean;
  locked?: boolean;
  index: number;
  onClick: () => void;
}) {
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

        {/* Step Number Badge */}
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

      {/* Content */}
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

        {/* Status */}
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
   STEP CARD (Mobile)
====================================================== */

function StepCardMobile({
  number,
  icon: Icon,
  title,
  subtitle,
  complete,
  locked,
  index,
  onClick,
}: {
  number: number;
  icon: any;
  title: string;
  subtitle: string;
  complete?: boolean;
  locked?: boolean;
  index: number;
  onClick: () => void;
}) {
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
        relative text-left w-full
        bg-white rounded-3xl p-5 ml-20
        border-4 transition-all
        ${
          locked
            ? 'border-gray-200 cursor-not-allowed opacity-60'
            : complete
            ? 'border-emerald-400 shadow-lg'
            : 'border-purple-300 shadow-lg'
        }
      `}
    >
      {/* Icon on Track */}
      <div className="absolute -left-24 top-1/2 -translate-y-1/2">
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
            w-16 h-16 rounded-full flex items-center justify-center shadow-xl
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
            <Check className="w-8 h-8 text-white" strokeWidth={3} />
          ) : locked ? (
            <Lock className="w-6 h-6 text-gray-500" />
          ) : (
            <Icon className="w-7 h-7 text-white" strokeWidth={2.5} />
          )}
        </motion.div>

        {/* Step Number */}
        <div
          className={`
            absolute -top-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center font-black text-xs shadow-lg
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

      {/* Content */}
      <h3
        className={`text-lg font-black mb-1 ${
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

      {/* Status */}
      <div className="mt-3">
        {complete ? (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 font-bold text-xs">
            <Check className="w-3.5 h-3.5" />
            Complete
          </div>
        ) : locked ? (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-200 text-gray-500 font-bold text-xs">
            <Lock className="w-3 h-3" />
            Locked
          </div>
        ) : (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-100 text-purple-700 font-bold text-xs">
            <Sparkles className="w-3.5 h-3.5" />
            Ready
          </div>
        )}
      </div>
    </motion.button>
  );
}

/* ======================================================
   QUICK STAT
====================================================== */

function QuickStat({
  icon: Icon,
  value,
  label,
}: {
  icon: any;
  value: number | string;
  label: string;
}) {
  return (
    <div className="bg-white/90 backdrop-blur-xl rounded-2xl p-4 border-2 border-white shadow-lg text-center">
      <Icon className="w-5 h-5 text-purple-600 mx-auto mb-2" strokeWidth={2.5} />
      <div className="text-2xl md:text-3xl font-black text-gray-900">{value}</div>
      <div className="text-xs font-bold text-gray-600 uppercase tracking-wide">
        {label}
      </div>
    </div>
  );
}