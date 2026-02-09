'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle,
  Lock,
  MapPin,
  ChevronRight,
  Loader2,
  Zap,
} from 'lucide-react';
import { MobileLocationStack } from '@/app/stories/[id]/locations/components/MobileLocationCard';
import type { StepKey } from '@/lib/storySteps';
import UnifiedStoryHeader from '@/app/stories/components/StoryHeader';
import LocationCard from '@/app/stories/[id]/locations/components/LocationCard';
// import { LocationCard } from '@/app/stories/[id]/locations/components/LocationCard';

/* ------------------------------------------------------------------ */
/* TYPES                                                               */
/* ------------------------------------------------------------------ */

type Location = {
  id: string;
  name: string;
  description: string | null;
  referenceImageUrl: string | null;
  portraitImageUrl: string | null;
  locked: boolean;
};

/* ------------------------------------------------------------------ */
/* PAGE                                                                */
/* ------------------------------------------------------------------ */

export default function LocationsClient({
  storyId,
  storyTitle,
  storyConfirmed,
  locations,
  currentStep,
  completedSteps,
}: {
  storyId: string;
  storyTitle: string;
  storyConfirmed: boolean;
  locations: Location[];
  currentStep: StepKey;
  completedSteps: StepKey[];
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [locationsLocal, setLocationsLocal] = useState(locations);
  const [isPurchased, setIsPurchased] = useState<boolean | null>(null);
  const [generatingAvatars, setGeneratingAvatars] = useState(false);

  useEffect(() => {
    if (!storyId) return;
    let cancelled = false;

    async function checkPurchase() {
      const res = await fetch(`/api/stories/${storyId}/purchase-status`);
      if (!res.ok) return;
      const data = await res.json();
      if (!cancelled) setIsPurchased(data.purchased);
    }

    checkPurchase();
    return () => { cancelled = true; };
  }, [storyId]);

  useEffect(() => {
    setLocationsLocal(locations);
  }, [locations]);

  function handleDelete(id: string) {
    setLocationsLocal(prev => prev.filter(l => l.id !== id));
  }

  async function generateAIAvatars() {
    if (!confirm('Generate AI images for all locations? This will use AI credits.')) return;
    setGeneratingAvatars(true);
    try {
      const res = await fetch(`/api/stories/${storyId}/generate-all-location-images`, { method: 'POST' });
      if (res.ok) router.refresh();
      else alert('Failed to generate images. Please try again.');
    } catch (err) {
      console.error(err);
      alert('Error generating images');
    } finally {
      setGeneratingAvatars(false);
    }
  }

  const lockedCount = locationsLocal.filter(l => l.locked).length;
  const totalCount = locationsLocal.length;
  const allLocked = lockedCount === totalCount && totalCount > 0;

  /* -------------------------------------------------------- */
  /* RENDER                                                    */
  /* -------------------------------------------------------- */
  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 via-white to-stone-50">
      
      {/* Add scrollbar hide styles */}
      <style jsx global>{`
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>
      
      {/* ── UNIFIED HEADER ── */}
      <UnifiedStoryHeader
        storyId={storyId}
        title={storyTitle}
        currentStep={currentStep}
        completedSteps={completedSteps}
        showProgress={!storyConfirmed && totalCount > 0}
        progressCurrent={lockedCount}
        progressTotal={totalCount}
        showGenerateAll={!!isPurchased && !allLocked && !storyConfirmed}
        onGenerateAll={generateAIAvatars}
        isGenerating={generatingAvatars}
        designUnlocked={allLocked}
      />

      {/* ── BODY ── */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">

        {/* Mobile: Generate All button */}
        {isPurchased && !allLocked && !storyConfirmed && (
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={generateAIAvatars}
            disabled={generatingAvatars}
            className="md:hidden w-full flex items-center justify-center gap-2.5 px-5 py-3.5 rounded-2xl text-sm font-bold text-white mb-6 bg-gradient-to-r from-violet-600 to-fuchsia-600 active:scale-[0.98] transition-all disabled:opacity-40 shadow-lg"
          >
            {generatingAvatars ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> Generating Images…</>
            ) : (
              <><Zap className="w-5 h-5" /> Generate All Images</>
            )}
          </motion.button>
        )}

        {/* ── MOBILE: TINDER-STYLE STACK ── */}
        <div className="md:hidden">
          {locationsLocal.length > 0 ? (
            <MobileLocationStack
              locations={locationsLocal}
              onDelete={handleDelete}
              onLockToggle={(id, locked) => {
                setLocationsLocal(prev =>
                  prev.map(l => l.id === id ? { ...l, locked } : l)
                );
              }}
            />
          ) : (
            <motion.div 
              initial={{ opacity: 0, y: 20 }} 
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="flex flex-col items-center justify-center py-20"
            >
              <motion.div 
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                className="w-20 h-20 rounded-3xl bg-gradient-to-br from-violet-100 to-fuchsia-100 border border-violet-200 flex items-center justify-center mb-6"
              >
                <MapPin className="w-10 h-10 text-violet-400" />
              </motion.div>
              <h3 className="text-xl font-bold text-stone-900 mb-2">No Locations Yet</h3>
              <p className="text-sm text-stone-500 text-center max-w-xs mb-8 px-4">
                Locations will appear here after extraction.
              </p>
            </motion.div>
          )}
        </div>

        {/* ── DESKTOP: GRID VIEW ── */}
        {locationsLocal.length > 0 && (
          <AnimatePresence mode="popLayout">
            <div className="hidden md:grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
              {locationsLocal.map((location, idx) => (
                <motion.div
                  key={location.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: -10 }}
                  transition={{ 
                    duration: 0.4, 
                    delay: idx * 0.05, 
                    ease: [0.4, 0, 0.2, 1],
                    layout: { duration: 0.3 }
                  }}
                >
                  <LocationCard
                    location={location}
                    index={idx}
                    onDelete={handleDelete}
                    storyId={storyId}
                  />
                </motion.div>
              ))}
            </div>
          </AnimatePresence>
        )}

        {/* ── DESKTOP EMPTY STATE ── */}
        {locationsLocal.length === 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="hidden md:flex flex-col items-center justify-center py-20 sm:py-32"
          >
            <motion.div 
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
              className="w-20 h-20 rounded-3xl bg-gradient-to-br from-violet-100 to-fuchsia-100 border border-violet-200 flex items-center justify-center mb-6"
            >
              <MapPin className="w-10 h-10 text-violet-400" />
            </motion.div>
            <h3 className="text-xl font-bold text-stone-900 mb-2">No Locations Yet</h3>
            <p className="text-sm text-stone-500 text-center max-w-xs mb-8 px-4">
              Locations will appear here after extraction. Head back to your story hub to get started.
            </p>
            <button
              onClick={() => router.push(`/stories/${storyId}/hub`)}
              className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 border border-stone-200 transition-all active:scale-95"
            >
              Back to Hub
            </button>
          </motion.div>
        )}

        {/* ── BOTTOM CTA ── */}
        <AnimatePresence mode="wait">
          {!storyConfirmed && locationsLocal.length > 0 && (
            <motion.div
              key="cta-lock"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
              className="mt-8 sm:mt-12"
            >
              <div
                className={`rounded-3xl p-6 sm:p-8 text-center relative overflow-hidden ${
                  allLocked 
                    ? 'bg-gradient-to-br from-emerald-50 via-green-50 to-transparent border-2 border-emerald-200' 
                    : 'bg-stone-50 border border-stone-200'
                }`}
              >
                {/* Glow effect for locked state */}
                {allLocked && (
                  <div className="absolute inset-0 bg-gradient-to-br from-emerald-100/30 via-transparent to-transparent opacity-50" />
                )}

                <div className="relative">
                  {allLocked ? (
                    <>
                      {/* Success icon */}
                      <motion.div
                        initial={{ scale: 0, rotate: -180 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ type: 'spring', stiffness: 200, delay: 0.1 }}
                        className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-400 to-green-500 flex items-center justify-center mx-auto mb-5 shadow-lg shadow-emerald-500/25"
                      >
                        <CheckCircle className="w-8 h-8 text-white" />
                      </motion.div>

                      <h2 className="text-xl sm:text-2xl font-bold text-stone-900 mb-3">
                        Ready to Confirm
                      </h2>
                      <p className="text-sm sm:text-base text-stone-600 max-w-md mx-auto mb-8">
                        All locations are locked. Confirm to ensure visual consistency throughout your story.
                      </p>

                      <button
                        disabled={confirming}
                        onClick={async () => {
                          setConfirming(true);
                          await fetch(`/api/stories/${storyId}/confirm-locations`, { method: 'POST' });
                          router.refresh();
                        }}
                        className="inline-flex items-center gap-3 px-8 py-4 rounded-2xl text-base font-bold text-white bg-gradient-to-r from-emerald-400 to-green-500 hover:from-emerald-500 hover:to-green-600 transition-all disabled:opacity-40 shadow-xl shadow-emerald-500/25 active:scale-[0.98]"
                      >
                        {confirming ? (
                          <><Loader2 className="w-5 h-5 animate-spin" /> Confirming…</>
                        ) : (
                          <><Lock className="w-5 h-5" /> Confirm Location Set</>
                        )}
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="w-14 h-14 rounded-2xl bg-stone-100 border border-stone-200 flex items-center justify-center mx-auto mb-5">
                        <Lock className="w-7 h-7 text-stone-400" />
                      </div>
                      <h2 className="text-lg sm:text-xl font-bold text-stone-900 mb-3">
                        Lock All Locations to Continue
                      </h2>
                      <p className="text-sm text-stone-600 max-w-md mx-auto">
                        Review each location's image and details, then tap{' '}
                        <span className="font-semibold text-stone-800">Lock</span> on each card.
                      </p>
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* Confirmed state */}
          {storyConfirmed && (
            <motion.div
              key="cta-confirmed"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
              className="mt-8 sm:mt-12"
            >
              <div className="rounded-3xl p-6 sm:p-8 text-center relative overflow-hidden bg-gradient-to-br from-violet-50 via-fuchsia-50 to-transparent border-2 border-violet-200">
                <div className="absolute inset-0 bg-gradient-to-br from-violet-100/30 via-transparent to-transparent opacity-50" />
                
                <div className="relative">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center mx-auto mb-5 shadow-lg shadow-violet-500/25">
                    <CheckCircle className="w-8 h-8 text-white" />
                  </div>

                  <h2 className="text-xl sm:text-2xl font-bold text-stone-900 mb-3">
                    Location Set Confirmed
                  </h2>
                  <p className="text-sm sm:text-base text-stone-600 max-w-md mx-auto mb-8">
                    Your locations are locked in. All illustrations will maintain perfect visual consistency.
                  </p>

                  <button
                    onClick={() => router.push(`/stories/${storyId}/design`)}
                    className="inline-flex items-center gap-3 px-8 py-4 rounded-2xl text-base font-bold text-white bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 transition-all shadow-xl shadow-violet-500/25 active:scale-[0.98]"
                  >
                    Continue to Design
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}