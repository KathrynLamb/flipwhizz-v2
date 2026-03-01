'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle,
  Lock,
  Users,
  ChevronRight,
  Loader2,
  Zap,
} from 'lucide-react';
import { MobileCharacterStack } from '@/app/stories/[id]/characters/components/MobileCharacterCard';
import type { StepKey } from '@/lib/storySteps';
import UnifiedStoryHeader from '@/app/stories/components/StoryHeader';
import CharactersCard from '@/app/stories/[id]/characters/components/CharacterCard';

/* ------------------------------------------------------------------ */
/* TYPES                                                               */
/* ------------------------------------------------------------------ */

export type CharacterOutfit = {
  id: string;
  outfitKey: string;
  outfitDescription: string;
  triggerConditions: string | null;
};

export type Character = {
  id: string;
  name: string;
  description: string | null;
  appearance: string | null;
  personalityTraits: string | null;
  portraitImageUrl: string | null;
  referenceImageUrl: string | null;
  locked: boolean;
  role?: string | null;
  age?: string | null;
  outfits?: CharacterOutfit[];
  visualDetails?: Record<string, any> | null;
};

/* ------------------------------------------------------------------ */
/* FONT LOADER                                                         */
/* ------------------------------------------------------------------ */

function FontLoader() {
  return (
    // eslint-disable-next-line @next/next/no-page-custom-font
    <link
      href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,300;12..96,400;12..96,600;12..96,700;12..96,800&family=Lora:ital,wght@0,400;0,500;0,600;1,400;1,500&display=swap"
      rel="stylesheet"
    />
  );
}

/* ------------------------------------------------------------------ */
/* PAGE                                                                */
/* ------------------------------------------------------------------ */

export default function CharactersClient({
  storyId,
  storyTitle = 'Characters',
  storyConfirmed,
  characters,
  currentStep = 'characters',
  completedSteps = [],
}: {
  storyId: string;
  storyTitle?: string;
  storyConfirmed: boolean;
  characters: Character[];
  currentStep?: StepKey;
  completedSteps?: StepKey[];
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [charactersLocal, setCharactersLocal] = useState(characters);
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
    setCharactersLocal(characters);
  }, [characters]);

  function handleDelete(id: string) {
    setCharactersLocal((prev) => prev.filter((c) => c.id !== id));
  }

  async function generateAIAvatars() {
    if (!confirm('Generate AI portraits for all characters? This will use AI credits.')) return;
    setGeneratingAvatars(true);
    try {
      const res = await fetch(`/api/stories/${storyId}/generate-all-avatars`, { method: 'POST' });
      if (res.ok) router.refresh();
      else alert('Failed to generate avatars. Please try again.');
    } catch (err) {
      console.error(err);
      alert('Error generating avatars');
    } finally {
      setGeneratingAvatars(false);
    }
  }

  const lockedCount = charactersLocal.filter((c) => c.locked).length;
  const totalCount = charactersLocal.length;
  const allLocked = lockedCount === totalCount && totalCount > 0;

  return (
    <>
      <FontLoader />

      <div
        className="min-h-screen relative"
        style={{ fontFamily: "'Bricolage Grotesque', system-ui, sans-serif" }}
      >
        {/* Background */}
        <div
          className="fixed inset-0 -z-10"
          style={{
            background: `
              radial-gradient(ellipse 80% 60% at 20% 10%, rgba(232,190,255,0.3) 0%, transparent 60%),
              radial-gradient(ellipse 70% 50% at 85% 80%, rgba(255,182,210,0.25) 0%, transparent 55%),
              radial-gradient(ellipse 50% 40% at 50% 50%, rgba(200,210,255,0.15) 0%, transparent 50%),
              #F9F5FF
            `,
          }}
        >
          <div
            className="absolute inset-0 opacity-50"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23c4b5d4' fill-opacity='0.04'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            }}
          />
        </div>

        {/* Scrollbar hide */}
        <style jsx global>{`
          .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
          .scrollbar-hide::-webkit-scrollbar { display: none; }
        `}</style>

        {/* Header */}
        <UnifiedStoryHeader
          storyId={storyId}
          title={storyTitle}
          currentStep={currentStep}
          completedSteps={completedSteps}
          showProgress={!storyConfirmed && totalCount > 0}
          progressCurrent={lockedCount}
          progressTotal={totalCount}
          showGenerateAll={isPurchased === true && !allLocked && !storyConfirmed}
          onGenerateAll={generateAIAvatars}
          isGenerating={generatingAvatars}
        />

        {/* Body */}
        <main className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          {/* Intro */}
          {totalCount > 0 && !storyConfirmed && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center mb-8"
            >
              <div
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold mb-3"
                style={{ background: 'rgba(199,125,255,0.1)', color: '#9B59D0' }}
              >
                ✨ Auto-extracted from your story
              </div>
              <h2
                className="text-2xl sm:text-3xl font-extrabold mb-2"
                style={{ color: '#2D2235', letterSpacing: '-0.03em' }}
              >
                Meet the Cast
              </h2>
              <p
                className="text-sm sm:text-base max-w-lg mx-auto leading-relaxed"
                style={{ color: '#7B6E90' }}
              >
                Review each character's details and lock them in — they'll guide the
                illustrations throughout your book.
              </p>

              {/* Lock counter */}
              <div className="flex items-center justify-center gap-3 mt-5">
                <span className="text-xs font-semibold" style={{ color: '#8B7BA0' }}>
                  {lockedCount} of {totalCount} locked
                </span>
                <div
                  className="w-40 h-1.5 rounded-full overflow-hidden"
                  style={{ background: 'rgba(180,150,210,0.15)' }}
                >
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: 'linear-gradient(90deg, #43B89C, #2FA482)' }}
                    initial={{ width: 0 }}
                    animate={{ width: `${(lockedCount / totalCount) * 100}%` }}
                    transition={{ duration: 0.6, ease: [0.34, 1.56, 0.64, 1] }}
                  />
                </div>
                {allLocked && (
                  <span className="text-xs font-bold" style={{ color: '#2FA482' }}>
                    ✓ All ready!
                  </span>
                )}
              </div>
            </motion.div>
          )}

          {/* Mobile: Generate All */}
          {isPurchased && !allLocked && !storyConfirmed && (
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={generateAIAvatars}
              disabled={generatingAvatars}
              className="md:hidden w-full flex items-center justify-center gap-2.5 px-5 py-3.5 rounded-2xl text-sm font-bold text-white mb-6 active:scale-[0.98] transition-all disabled:opacity-40"
              style={{
                background: 'linear-gradient(135deg, #B05CE6, #D45DA0)',
                boxShadow: '0 4px 16px rgba(176,92,230,0.25)',
                border: 'none',
                fontFamily: 'inherit',
              }}
            >
              {generatingAvatars ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> Generating Portraits…</>
              ) : (
                <><Zap className="w-5 h-5" /> Generate All Portraits</>
              )}
            </motion.button>
          )}

          {/* Mobile stack */}
          <div className="md:hidden">
            {charactersLocal.length > 0 ? (
              <MobileCharacterStack
                storyId={storyId}
                characters={charactersLocal}
                onDelete={handleDelete}
                onLockToggle={(id, locked) => {
                  setCharactersLocal((prev) =>
                    prev.map((c) => (c.id === id ? { ...c, locked } : c))
                  );
                }}
              />
            ) : (
              <EmptyState storyId={storyId} router={router} />
            )}
          </div>

          {/* Desktop grid */}
          {charactersLocal.length > 0 && (
            <AnimatePresence mode="popLayout">
              <div className="hidden md:grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {charactersLocal.map((char, idx) => (
                  <motion.div
                    key={char.id}
                    layout
                    initial={{ opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -10 }}
                    transition={{
                      duration: 0.4,
                      delay: idx * 0.08,
                      ease: [0.25, 0.46, 0.45, 0.94],
                    }}
                  >
                    <CharactersCard
                      character={char}
                      storyId={storyId}
                      index={idx}
                      onUpdate={() => router.refresh()}
                    />
                  </motion.div>
                ))}
              </div>
            </AnimatePresence>
          )}

          {/* Desktop empty */}
          {charactersLocal.length === 0 && (
            <div className="hidden md:block">
              <EmptyState storyId={storyId} router={router} />
            </div>
          )}

          {/* Bottom CTA */}
          <AnimatePresence mode="wait">
            {!storyConfirmed && charactersLocal.length > 0 && (
              <motion.div
                key="cta-lock"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="mt-10"
              >
                <div
                  className="rounded-[22px] p-7 sm:p-10 text-center relative overflow-hidden"
                  style={{
                    background: allLocked ? 'white' : 'white',
                    border: allLocked
                      ? '2px solid rgba(67,184,156,0.3)'
                      : '1px solid rgba(180,150,210,0.12)',
                    boxShadow: allLocked
                      ? '0 4px 24px rgba(67,184,156,0.1)'
                      : '0 2px 8px rgba(100,60,140,0.05)',
                  }}
                >
                  {allLocked ? (
                    <>
                      <motion.div
                        initial={{ scale: 0, rotate: -180 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ type: 'spring', stiffness: 200, delay: 0.1 }}
                        className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5"
                        style={{
                          background: 'linear-gradient(135deg, #43B89C, #2FA482)',
                          boxShadow: '0 4px 16px rgba(67,184,156,0.25)',
                        }}
                      >
                        <CheckCircle className="w-7 h-7 text-white" />
                      </motion.div>
                      <h2
                        className="text-xl sm:text-2xl font-extrabold mb-2"
                        style={{ color: '#2D2235' }}
                      >
                        Ready to Confirm
                      </h2>
                      <p className="text-sm mb-8 max-w-md mx-auto" style={{ color: '#7B6E90' }}>
                        All characters are locked. Confirm to ensure visual consistency
                        throughout your story.
                      </p>
                      <button
                        disabled={confirming}
                        onClick={async () => {
                          setConfirming(true);
                          await fetch(`/api/stories/${storyId}/confirm-characters`, {
                            method: 'POST',
                          });
                          await fetch(`/api/stories/${storyId}/complete-step`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ step: 'characters' }),
                          });
                          router.push(`/stories/${storyId}/locations`);
                        }}
                        className="inline-flex items-center gap-3 px-8 py-4 rounded-2xl text-base font-bold text-white transition-all disabled:opacity-40 active:scale-[0.98]"
                        style={{
                          background: 'linear-gradient(135deg, #43B89C, #2FA482)',
                          boxShadow: '0 6px 24px rgba(67,184,156,0.25)',
                          border: 'none',
                          fontFamily: 'inherit',
                        }}
                      >
                        {confirming ? (
                          <><Loader2 className="w-5 h-5 animate-spin" /> Confirming…</>
                        ) : (
                          <><Lock className="w-5 h-5" /> Confirm Character Cast</>
                        )}
                      </button>
                    </>
                  ) : (
                    <>
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4"
                        style={{ background: 'rgba(180,150,210,0.1)' }}
                      >
                        <Lock className="w-6 h-6" style={{ color: '#A897BD' }} />
                      </div>
                      <h2
                        className="text-lg sm:text-xl font-bold mb-2"
                        style={{ color: '#2D2235' }}
                      >
                        Lock All Characters to Continue
                      </h2>
                      <p className="text-sm max-w-md mx-auto" style={{ color: '#7B6E90' }}>
                        Review each character's details, then tap{' '}
                        <span className="font-semibold" style={{ color: '#2D2235' }}>
                          Lock In
                        </span>{' '}
                        on each card.
                      </p>
                    </>
                  )}
                </div>
              </motion.div>
            )}

            {storyConfirmed && (
              <motion.div
                key="cta-confirmed"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-10"
              >
                <div
                  className="rounded-[22px] p-7 sm:p-10 text-center relative overflow-hidden"
                  style={{
                    background: 'white',
                    border: '2px solid rgba(176,92,230,0.2)',
                    boxShadow: '0 4px 24px rgba(176,92,230,0.08)',
                  }}
                >
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5"
                    style={{
                      background: 'linear-gradient(135deg, #B05CE6, #D45DA0)',
                      boxShadow: '0 4px 16px rgba(176,92,230,0.25)',
                    }}
                  >
                    <CheckCircle className="w-7 h-7 text-white" />
                  </div>
                  <h2
                    className="text-xl sm:text-2xl font-extrabold mb-2"
                    style={{ color: '#2D2235' }}
                  >
                    Character Cast Confirmed
                  </h2>
                  <p className="text-sm mb-8 max-w-md mx-auto" style={{ color: '#7B6E90' }}>
                    Your characters are locked in. All illustrations will maintain perfect
                    visual consistency.
                  </p>
                  <button
                    onClick={() => router.push(`/stories/${storyId}/locations`)}
                    className="inline-flex items-center gap-3 px-8 py-4 rounded-2xl text-base font-bold text-white transition-all active:scale-[0.98]"
                    style={{
                      background: 'linear-gradient(135deg, #B05CE6, #D45DA0)',
                      boxShadow: '0 6px 24px rgba(176,92,230,0.2)',
                      border: 'none',
                      fontFamily: 'inherit',
                    }}
                  >
                    Continue to Locations
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* EMPTY STATE                                                         */
/* ------------------------------------------------------------------ */

function EmptyState({ storyId, router }: { storyId: string; router: any }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-20 sm:py-32"
    >
      <motion.div
        initial={{ scale: 0.8 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
        className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5"
        style={{ background: 'rgba(199,125,255,0.1)' }}
      >
        <Users className="w-8 h-8" style={{ color: '#C77DFF' }} />
      </motion.div>
      <h3 className="text-xl font-bold mb-2" style={{ color: '#2D2235' }}>
        No Characters Yet
      </h3>
      <p className="text-sm text-center max-w-xs mb-8 px-4" style={{ color: '#7B6E90' }}>
        Characters will appear here after extraction.
      </p>
      <button
        onClick={() => router.push(`/stories/${storyId}/hub`)}
        className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all active:scale-95"
        style={{
          color: '#6B5C80',
          background: 'white',
          border: '1.5px solid rgba(180,150,210,0.2)',
          fontFamily: 'inherit',
        }}
      >
        Back to Hub
      </button>
    </motion.div>
  );
}