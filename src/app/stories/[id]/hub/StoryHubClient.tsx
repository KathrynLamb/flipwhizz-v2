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
  Zap,
} from 'lucide-react';
import { StatCard } from '@/app/stories/[id]/hub/components/StatCard';

/* ======================================================
   ANIMATION TOKENS
====================================================== */

const easeOut: [number, number, number, number] = [0.16, 1, 0.3, 1];

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: easeOut },
  },
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.45, ease: easeOut },
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
  const hasCast =
    hub.steps.extract.characters > 0 ||
    hub.steps.extract.locations > 0;

  const designUnlocked = hub.steps.design.unlocked;

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
              {hub.progressPercent}% complete
            </span>
          </div>
        </div>
      </div>

      {/* CONTENT */}
      <div className="pt-28 pb-24 px-6">
        <div className="max-w-5xl mx-auto space-y-16">

          {/* HERO */}
          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            className="text-center"
          >
            <h1 className="text-6xl md:text-7xl font-black mb-6 bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 bg-clip-text text-transparent">
              {story.title}
            </h1>

            <p className="text-xl text-stone-600 font-medium max-w-2xl mx-auto">
              You’re building this one step at a time.  
              Everything you need is already here — just follow the flow.
            </p>
          </motion.div>

          {/* SECTION: WHERE YOU ARE */}
          <GlassSection
            title="You’re off to a strong start"
            subtitle="Here’s what we’ve got so far"
          >
            <p className="text-stone-700 font-semibold">
              Your story text is written and saved safely.
            </p>

            <p className="text-stone-600 mt-2">
              You can always come back and tweak wording later — nothing here is final yet.
            </p>

            <p className="mt-4 font-bold text-stone-800">
              {hub.steps.write.pageCount} pages written ✨
            </p>
          </GlassSection>

          {/* SECTION: CAST & WORLD */}
          <GlassSection
            title="Meet your characters and places"
            subtitle="We’ve pulled these directly from your story"
          >
            {!hasCast && (
              <p className="text-stone-600 font-medium">
                We’re still identifying characters and locations from your text.
              </p>
            )}

            {hasCast && (
              <>
                <p className="text-stone-600 max-w-xl mb-6">
                  Before illustrations begin, we’ll gently lock in how key characters
                  and locations look — so everything stays consistent throughout the book.
                </p>

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
              </>
            )}
          </GlassSection>

          {/* SECTION: DESIGN */}
          <GlassSection
            title="Choose how your book looks"
            subtitle="This sets the visual style for everything"
          >
            <p className="text-stone-600 max-w-xl">
              Once your characters and locations are locked, we’ll generate a
              real sample spread so you can see exactly what the finished book
              will feel like.
            </p>

            <div className="mt-6">
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
                  Open Design Studio
                  <Palette className="w-5 h-5" />
                </motion.button>
              ) : (
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-100 text-amber-900 font-bold">
                  <Lock className="w-4 h-4" />
                  Lock characters & locations to continue
                </div>
              )}
            </div>
          </GlassSection>

          {/* SECTION: WHAT COMES NEXT */}
          <GlassSection
            title="What happens next?"
            subtitle="No rush — this unlocks when you’re ready"
            muted
          >
            <p className="text-stone-500 font-medium max-w-xl">
              After design is confirmed, you’ll move into the Art Studio —
              where full illustrations are generated and your book truly comes alive.
            </p>

            <div className="flex items-center gap-3 mt-4 text-stone-400 font-bold">
              <Zap className="w-4 h-4" />
              Art Studio unlocks automatically
            </div>
          </GlassSection>
        </div>
      </div>
    </div>
  );
}

/* ======================================================
   GLASS SECTION
====================================================== */

function GlassSection({
  title,
  subtitle,
  muted,
  children,
}: {
  title: string;
  subtitle: string;
  muted?: boolean;
  children: React.ReactNode;
}) {
  return (
    <motion.section
      variants={scaleIn}
      initial="hidden"
      animate="visible"
      className={`
        bg-white/90 backdrop-blur-xl
        rounded-3xl p-8 md:p-10
        shadow-2xl border border-white
        ${muted ? 'opacity-60' : ''}
      `}
    >
      <h2 className="text-3xl font-black text-stone-800 mb-2">
        {title}
      </h2>
      <p className="text-stone-500 font-medium mb-6">
        {subtitle}
      </p>

      {children}
    </motion.section>
  );
}
