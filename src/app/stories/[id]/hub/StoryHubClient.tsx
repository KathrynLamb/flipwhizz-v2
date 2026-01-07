'use client';

import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  CheckCircle,
  Sparkles,
  Users,
  MapPin,
  Palette,
  Lock,
  Zap,
} from 'lucide-react';
import { StatCard } from '@/app/stories/[id]/hub/components/StatCard';

/* ======================================================
   ANIMATIONS (MATCH DESIGN PAGE)
====================================================== */

const easeOut: [number, number, number, number] = [0.16, 1, 0.3, 1];

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: easeOut },
  },
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.94 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.5, ease: easeOut },
  },
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
    hub.steps.extract.characters > 0 ||
    hub.steps.extract.locations > 0;

  const designUnlocked = hub.steps.design.unlocked;
  const designComplete = hub.steps.design.complete;

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-fuchsia-50 to-amber-50">
      {/* TOP BAR */}
      <div className="fixed top-0 inset-x-0 z-50 bg-white/80 backdrop-blur border-b border-white">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <button
            onClick={() => router.push('/projects')}
            className="flex items-center gap-2 text-stone-600 hover:text-black font-medium"
          >
            <ArrowLeft className="w-5 h-5" />
            Library
          </button>

          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-violet-100">
            <div className="w-2 h-2 rounded-full bg-violet-500" />
            <span className="text-sm font-bold text-violet-900">
              {hub.progressPercent}% Complete
            </span>
          </div>
        </div>
      </div>

      {/* CONTENT */}
      <div className="pt-28 pb-20 px-6">
        <div className="max-w-6xl mx-auto space-y-14">
          {/* HERO */}
          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            className="text-center"
          >
            <h1 className="text-6xl md:text-7xl font-black mb-4 bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 bg-clip-text text-transparent">
              {story.title}
            </h1>
            <p className="text-xl text-stone-600 font-medium">
              Your story is coming to life ✨
            </p>
          </motion.div>

          {/* STEP 1 */}
          <GlassStep
            icon={CheckCircle}
            title="Write Your Story"
            subtitle="The foundation of your book"
            complete={writeComplete}
          >
            <p className="font-semibold text-stone-700">
              {hub.steps.write.pageCount} pages written
            </p>
          </GlassStep>

          {/* STEP 2 */}
          <GlassStep
            icon={Sparkles}
            title="Review What We Found"
            subtitle="Meet your cast and world"
            complete={extractComplete}
          >
            <motion.div
              variants={scaleIn}
              initial="hidden"
              animate="visible"
              className="grid grid-cols-1 md:grid-cols-2 gap-6"
            >
              <StatCard
                icon={<Users className="w-6 h-6" />}
                label="Characters"
                total={hub.steps.design.charactersTotal}
                confirmed={hub.steps.design.charactersConfirmed}
                onClick={() =>
                  router.push(`/stories/${story.id}/characters`)
                }
              />

              <StatCard
                icon={<MapPin className="w-6 h-6" />}
                label="Locations"
                total={hub.steps.design.locationsTotal}
                confirmed={hub.steps.design.locationsConfirmed}
                onClick={() =>
                  router.push(`/stories/${story.id}/locations`)
                }
              />
            </motion.div>
          </GlassStep>

          {/* STEP 3 */}
          <GlassStep
            icon={Palette}
            title="Design Your Book"
            subtitle="Lock in the visual style"
            complete={designComplete}
          >
            <div className="space-y-4">
              <p className="font-semibold text-stone-700">
                Characters locked:{' '}
                {hub.steps.design.charactersConfirmed} /{' '}
                {hub.steps.design.charactersTotal}
              </p>

              <p className="font-semibold text-stone-700">
                Locations locked:{' '}
                {hub.steps.design.locationsConfirmed} /{' '}
                {hub.steps.design.locationsTotal}
              </p>

              {designUnlocked ? (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() =>
                    router.push(`/stories/${story.id}/design`)
                  }
                  className="
                    inline-flex items-center gap-3
                    px-8 py-4 rounded-full
                    bg-gradient-to-r from-violet-600 to-fuchsia-600
                    text-white font-black text-lg
                    shadow-xl
                  "
                >
                  Enter Design Studio
                  <Sparkles className="w-5 h-5" />
                </motion.button>
              ) : (
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-100 text-amber-900 font-bold">
                  <Lock className="w-4 h-4" />
                  Lock characters & locations first
                </div>
              )}
            </div>
          </GlassStep>

          {/* STEP 4 */}
          <GlassStep
            icon={Zap}
            title="Art Studio"
            subtitle="Generate illustrations"
            muted
          >
            <p className="text-stone-500 font-medium">
              Available after design is locked
            </p>
          </GlassStep>
        </div>
      </div>
    </div>
  );
}

/* ======================================================
   GLASS STEP
====================================================== */

function GlassStep({
  icon: Icon,
  title,
  subtitle,
  complete,
  muted,
  children,
}: any) {
  return (
    <motion.div
      variants={scaleIn}
      initial="hidden"
      animate="visible"
      className={`
        bg-white/90 backdrop-blur-xl
        rounded-3xl p-8 shadow-2xl
        border border-white
        ${muted ? 'opacity-60' : ''}
      `}
    >
      <div className="flex items-center gap-4 mb-6">
        <div
          className={`
            w-14 h-14 rounded-2xl flex items-center justify-center
            ${
              complete
                ? 'bg-emerald-500 text-white'
                : 'bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white'
            }
          `}
        >
          <Icon className="w-7 h-7" />
        </div>

        <div>
          <h2 className="text-3xl font-black text-stone-800">
            {title}
          </h2>
          <p className="text-stone-600 font-medium">
            {subtitle}
          </p>
        </div>
      </div>

      <div className="ml-[72px]">{children}</div>
    </motion.div>
  );
}
