'use client';

import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Sparkles,
  Users,
  MapPin,
  Palette,
  Lock,
  Check,
  Wand2,
  BookOpen,
  Image as ImageIcon,
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

  const writeComplete = hub.steps.write.complete;
  const extractComplete =
    hub.steps.extract.characters > 0 && hub.steps.extract.locations > 0;
  const designComplete = hub.steps.design.complete;

  const currentStep = !writeComplete
    ? 1
    : !extractComplete
    ? 2
    : !designComplete
    ? 3
    : 4;

  return (
    <div className="h-screen overflow-hidden bg-gradient-to-br from-violet-50 via-fuchsia-50 to-blue-50 flex flex-col">
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
            className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 shadow-lg"
          >
            <Sparkles className="w-4 h-4 text-white" />
            <span className="text-sm font-black text-white">
              {hub.progressPercent}% Complete
            </span>
          </motion.div>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="flex-1 overflow-hidden px-6 py-6 md:py-10">
        <div className="max-w-7xl mx-auto h-full flex flex-col">
          {/* TITLE */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: easeOut }}
            className="text-center mb-8 md:mb-10 flex-shrink-0"
          >
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-black mb-3 bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 bg-clip-text text-transparent leading-tight">
              {story.title}
            </h1>
            <p className="text-sm md:text-base lg:text-lg text-stone-600 font-semibold">
              Your story's journey from words to wonderful
            </p>
          </motion.div>

          {/* FLOW DIAGRAM */}
          <div className="flex-1 flex items-center justify-center min-h-0 mb-6">
            {/* DESKTOP & TABLET: 2x2 GRID */}
            <div className="hidden sm:block w-full max-w-6xl">
              <div className="grid grid-cols-2 gap-x-8 gap-y-6">
                {/* ROW 1 */}
                <div className="relative">
                  <FlowCard
                    step={1}
                    currentStep={currentStep}
                    icon={BookOpen}
                    title="Write Story"
                    description={`${hub.steps.write.pageCount} pages`}
                    complete={writeComplete}
                    onClick={() => router.push(`/stories/${story.id}/write`)}
                    index={0}
                  />
                  <HorizontalArrow complete={writeComplete} />
                </div>

                <FlowCard
                  step={2}
                  currentStep={currentStep}
                  icon={Wand2}
                  title="Extract World"
                  description={`${hub.steps.extract.characters} characters, ${hub.steps.extract.locations} places`}
                  complete={extractComplete}
                  locked={!writeComplete}
                  onClick={() =>
                    writeComplete && router.push(`/stories/${story.id}/extract`)
                  }
                  index={1}
                />

                {/* ROW 2 */}
                <div className="relative">
                  <FlowCard
                    step={3}
                    currentStep={currentStep}
                    icon={Palette}
                    title="Design Characters"
                    description={`${hub.steps.design.charactersConfirmed}/${hub.steps.design.charactersTotal} confirmed`}
                    complete={designComplete}
                    locked={!hub.steps.design.unlocked}
                    onClick={() =>
                      hub.steps.design.unlocked &&
                      router.push(`/stories/${story.id}/characters`)
                    }
                    index={2}
                  />
                  <HorizontalArrow complete={designComplete} />
                </div>

                <FlowCard
                  step={4}
                  currentStep={currentStep}
                  icon={ImageIcon}
                  title="Create Art"
                  description="Generate illustrations"
                  complete={false}
                  locked={!designComplete}
                  onClick={() =>
                    designComplete && router.push(`/stories/${story.id}/art`)
                  }
                  index={3}
                />
              </div>

              {/* VERTICAL CONNECTOR */}
              <VerticalConnector complete={extractComplete} />
            </div>

            {/* MOBILE: VERTICAL FLOW */}
            <div className="sm:hidden w-full max-w-sm space-y-3">
              <FlowCard
                step={1}
                currentStep={currentStep}
                icon={BookOpen}
                title="Write Story"
                description={`${hub.steps.write.pageCount} pages`}
                complete={writeComplete}
                onClick={() => router.push(`/stories/${story.id}/write`)}
                index={0}
                mobile
              />

              <MobileArrow complete={writeComplete} />

              <FlowCard
                step={2}
                currentStep={currentStep}
                icon={Wand2}
                title="Extract World"
                description={`${hub.steps.extract.characters} characters, ${hub.steps.extract.locations} places`}
                complete={extractComplete}
                locked={!writeComplete}
                onClick={() =>
                  writeComplete && router.push(`/stories/${story.id}/extract`)
                }
                index={1}
                mobile
              />

              <MobileArrow complete={extractComplete} />

              <FlowCard
                step={3}
                currentStep={currentStep}
                icon={Palette}
                title="Design Characters"
                description={`${hub.steps.design.charactersConfirmed}/${hub.steps.design.charactersTotal} confirmed`}
                complete={designComplete}
                locked={!hub.steps.design.unlocked}
                onClick={() =>
                  hub.steps.design.unlocked &&
                  router.push(`/stories/${story.id}/characters`)
                }
                index={2}
                mobile
              />

              <MobileArrow complete={designComplete} />

              <FlowCard
                step={4}
                currentStep={currentStep}
                icon={ImageIcon}
                title="Create Art"
                description="Generate illustrations"
                complete={false}
                locked={!designComplete}
                onClick={() =>
                  designComplete && router.push(`/stories/${story.id}/art`)
                }
                index={3}
                mobile
              />
            </div>
          </div>

          {/* BOTTOM STATS */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.5 }}
            className="flex-shrink-0"
          >
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-5xl mx-auto">
              <QuickStat
                icon={Users}
                value={hub.steps.design.charactersTotal}
                label="Characters"
                color="text-purple-600"
                onClick={() => router.push(`/stories/${story.id}/characters`)}
              />
              <QuickStat
                icon={MapPin}
                value={hub.steps.design.locationsTotal}
                label="Locations"
                color="text-pink-600"
                onClick={() => router.push(`/stories/${story.id}/locations`)}
              />
              <QuickStat
                icon={BookOpen}
                value={hub.steps.write.pageCount}
                label="Pages"
                color="text-blue-600"
                onClick={() => router.push(`/stories/${story.id}/write`)}
              />
              <QuickStat
                icon={Palette}
                value={hub.steps.design.styleReady ? '✓' : '—'}
                label="Style"
                color="text-fuchsia-600"
                onClick={() => router.push(`/stories/${story.id}/design`)}
              />
            </div>
          </motion.div>
        </div>
      </main>
    </div>
  );
}

/* ======================================================
   FLOW CARD
====================================================== */

function FlowCard({
  step,
  currentStep,
  icon: Icon,
  title,
  description,
  complete,
  locked,
  onClick,
  index,
  mobile,
}: {
  step: number;
  currentStep: number;
  icon: any;
  title: string;
  description: string;
  complete?: boolean;
  locked?: boolean;
  onClick: () => void;
  index: number;
  mobile?: boolean;
}) {
  const isActive = step === currentStep;

  return (
    <motion.button
      custom={index}
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      onClick={onClick}
      disabled={locked}
      whileHover={!locked ? { scale: 1.02, y: -2 } : {}}
      whileTap={!locked ? { scale: 0.98 } : {}}
      className={`
        relative text-left w-full
        rounded-3xl p-6
        border-4 transition-all duration-300
        ${
          locked
            ? 'bg-white/50 border-gray-300 cursor-not-allowed'
            : complete
            ? 'bg-white border-emerald-400 shadow-xl'
            : isActive
            ? 'bg-white border-purple-400 shadow-2xl'
            : 'bg-white border-gray-300 hover:border-purple-300 shadow-lg'
        }
      `}
    >
      {/* CORNER BADGE */}
      <div
        className={`
          absolute -top-3 -left-3 w-10 h-10 rounded-full flex items-center justify-center text-white font-black shadow-lg
          ${
            complete
              ? 'bg-gradient-to-br from-emerald-400 to-emerald-600'
              : 'bg-gradient-to-br from-purple-500 to-pink-500'
          }
        `}
      >
        {complete ? <Check className="w-6 h-6" strokeWidth={3} /> : step}
      </div>

      {/* LOCK */}
      {locked && (
        <div className="absolute -top-3 -right-3 w-10 h-10 rounded-full bg-gray-400 flex items-center justify-center shadow-lg">
          <Lock className="w-5 h-5 text-white" />
        </div>
      )}

      {/* ACTIVE GLOW */}
      {isActive && !complete && !locked && (
        <>
          <motion.div
            className="absolute inset-0 rounded-3xl bg-purple-400/20"
            animate={{
              scale: [1, 1.02, 1],
              opacity: [0.3, 0.5, 0.3],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
          <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-purple-400 to-pink-400 opacity-30 blur-xl" />
        </>
      )}

      {/* ICON */}
      <div
        className={`
          relative w-16 h-16 rounded-2xl flex items-center justify-center mb-4
          ${
            complete
              ? 'bg-gradient-to-br from-emerald-400 to-emerald-600'
              : isActive
              ? 'bg-gradient-to-br from-purple-500 to-pink-500'
              : locked
              ? 'bg-gray-300'
              : 'bg-gradient-to-br from-violet-400 to-fuchsia-500'
          }
        `}
      >
        <Icon
          className={`w-8 h-8 ${locked ? 'text-gray-500' : 'text-white'}`}
          strokeWidth={2.5}
        />
      </div>

      {/* CONTENT */}
      <div className="relative">
        <h3
          className={`text-xl md:text-2xl font-black mb-1 ${
            locked ? 'text-gray-400' : 'text-gray-900'
          }`}
        >
          {title}
        </h3>
        <p
          className={`text-sm md:text-base font-semibold ${
            locked ? 'text-gray-400' : 'text-gray-600'
          }`}
        >
          {description}
        </p>

        {/* STATUS */}
        <div className="mt-3">
          {complete && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-100 text-emerald-700 font-bold text-sm">
              <Check className="w-4 h-4" strokeWidth={3} />
              Complete
            </div>
          )}
          {isActive && !complete && !locked && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-purple-100 text-purple-700 font-bold text-sm">
              <Sparkles className="w-4 h-4" />
              In Progress
            </div>
          )}
          {locked && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-200 text-gray-500 font-bold text-sm">
              <Lock className="w-3.5 h-3.5" />
              Locked
            </div>
          )}
        </div>
      </div>
    </motion.button>
  );
}

/* ======================================================
   HORIZONTAL ARROW (for 2x2 grid)
====================================================== */

function HorizontalArrow({ complete }: { complete?: boolean }) {
  return (
    <div className="absolute top-1/2 -right-4 translate-x-full -translate-y-1/2 w-8 z-10">
      <svg width="32" height="80" viewBox="0 0 32 80" className="overflow-visible">
        <motion.path
          d="M 4 40 L 28 40"
          stroke={complete ? '#10b981' : '#d1d5db'}
          strokeWidth="4"
          strokeLinecap="round"
          fill="none"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        />
        <motion.path
          d="M 22 34 L 28 40 L 22 46"
          stroke={complete ? '#10b981' : '#d1d5db'}
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.3, delay: 0.6 }}
        />
      </svg>
    </div>
  );
}

/* ======================================================
   VERTICAL CONNECTOR (between rows)
====================================================== */

function VerticalConnector({ complete }: { complete?: boolean }) {
  return (
    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 w-1 h-6 -my-3">
      <svg width="4" height="24" viewBox="0 0 4 24" className="mx-auto">
        <motion.line
          x1="2"
          y1="0"
          x2="2"
          y2="24"
          stroke={complete ? '#10b981' : '#d1d5db'}
          strokeWidth="4"
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.4, delay: 0.4 }}
        />
      </svg>
    </div>
  );
}

/* ======================================================
   MOBILE ARROW
====================================================== */

function MobileArrow({ complete }: { complete?: boolean }) {
  return (
    <div className="flex justify-center py-1">
      <svg width="24" height="32" viewBox="0 0 24 32">
        <motion.path
          d="M 12 4 L 12 28"
          stroke={complete ? '#10b981' : '#d1d5db'}
          strokeWidth="4"
          strokeLinecap="round"
          fill="none"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.3, delay: 0.2 }}
        />
        <motion.path
          d="M 6 22 L 12 28 L 18 22"
          stroke={complete ? '#10b981' : '#d1d5db'}
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.2, delay: 0.4 }}
        />
      </svg>
    </div>
  );
}

/* ======================================================
   QUICK STAT
====================================================== */

function QuickStat({
  icon: Icon,
  value,
  label,
  color,
  onClick,
}: {
  icon: any;
  value: number | string;
  label: string;
  color: string;
  onClick?: () => void;
}) {
  return (
    <motion.button
      whileHover={{ scale: 1.03, y: -2 }}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className="bg-white/90 backdrop-blur-xl rounded-2xl p-4 border-2 border-white shadow-lg hover:shadow-xl transition-all text-center"
    >
      <Icon className={`w-6 h-6 ${color} mx-auto mb-2`} strokeWidth={2.5} />
      <div className="text-3xl font-black text-gray-900 mb-1">{value}</div>
      <div className="text-xs font-bold text-gray-600 uppercase tracking-wide">
        {label}
      </div>
    </motion.button>
  );
}