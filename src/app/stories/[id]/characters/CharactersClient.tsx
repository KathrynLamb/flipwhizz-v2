'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle,
  Sparkles,
  Lock,
  Users,
  ChevronRight,
  Loader2,
  ArrowLeft,
} from 'lucide-react';
import { CharacterCard } from '@/app/stories/[id]/characters/components/CharacterCard';

/* ------------------------------------------------------------------ */
/* TYPES                                                               */
/* ------------------------------------------------------------------ */

type Character = {
  id: string;
  name: string;
  description: string | null;
  appearance: string | null;
  personalityTraits: string | null;
  portraitImageUrl: string | null;
  referenceImageUrl: string | null;
  locked: boolean;
};

/* ------------------------------------------------------------------ */
/* PAGE                                                                */
/* ------------------------------------------------------------------ */

export default function CharactersClient({
  storyId,
  storyConfirmed,
  characters,
}: {
  storyId: string;
  storyConfirmed: boolean;
  characters: Character[];
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
    setCharactersLocal(prev => prev.filter(c => c.id !== id));
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

  const lockedCount = charactersLocal.filter(c => c.locked).length;
  const totalCount = charactersLocal.length;
  const allLocked = lockedCount === totalCount && totalCount > 0;
  const progressPercent = totalCount > 0 ? (lockedCount / totalCount) * 100 : 0;

  /* -------------------------------------------------------- */
  /* RENDER                                                    */
  /* -------------------------------------------------------- */
  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(150deg, #0f0e17 0%, #1a1625 40%, #16141f 100%)' }}>

      {/* ── BODY ── */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12">

    

        {/* ── MOBILE: generate all btn ── */}
        {isPurchased && !allLocked && !storyConfirmed && (
          <button
            onClick={generateAIAvatars}
            disabled={generatingAvatars}
            className="sm:hidden w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold text-white mb-6 transition-all disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg, #7c5cfc, #c25ef0)' }}
          >
            {generatingAvatars ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</>
            ) : (
              <><Sparkles className="w-4 h-4" /> Generate All Portraits</>
            )}
          </button>
        )}

        {/* ── CHARACTER GRID ── */}
        <AnimatePresence mode="popLayout">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {charactersLocal.map((char, idx) => (
              <motion.div
                key={char.id}
                layout
                initial={{ opacity: 0, translateY: 24 }}
                animate={{ opacity: 1, translateY: 0 }}
                exit={{ opacity: 0, scale: 0.94 }}
                transition={{ duration: 0.35, delay: idx * 0.07, ease: [0.4, 0, 0.2, 1] }}
              >
                <CharacterCard
                  character={char}
                  index={idx}
                  onDelete={handleDelete}
                  storyId={storyId}
                />
              </motion.div>
            ))}
          </div>
        </AnimatePresence>

        {/* ── EMPTY STATE ── */}
        {charactersLocal.length === 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-24">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5" style={{ background: 'rgba(255,255,255,0.06)' }}>
              <Users className="w-8 h-8" style={{ color: 'rgba(255,255,255,0.25)' }} />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">No Characters Yet</h3>
            <p className="text-sm mb-6 max-w-md mx-auto" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Characters appear here after extraction. Return to your story hub to run character extraction.
            </p>
            <button
              onClick={() => router.push(`/stories/${storyId}/hub`)}
              className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition-all"
              style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)' }}
            >
              Back to Hub
            </button>
          </motion.div>
        )}

        {/* ── BOTTOM CTA: lock / confirm / confirmed ── */}
        <AnimatePresence mode="wait">

          {/* A) Not yet confirmed + characters exist */}
          {!storyConfirmed && charactersLocal.length > 0 && (
            <motion.div
              key="cta-lock"
              initial={{ opacity: 0, translateY: 20 }}
              animate={{ opacity: 1, translateY: 0 }}
              exit={{ opacity: 0, translateY: 12 }}
              transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
              className="mt-10 sm:mt-14"
            >
              <div
                className="rounded-2xl p-6 sm:p-8 text-center"
                style={{
                  background: allLocked
                    ? 'linear-gradient(135deg, rgba(52,211,153,0.1) 0%, rgba(16,185,129,0.06) 100%)'
                    : 'rgba(255,255,255,0.04)',
                  border: '1px solid ' + (allLocked ? 'rgba(52,211,153,0.25)' : 'rgba(255,255,255,0.08)'),
                }}
              >
                {allLocked ? (
                  <>
                    {/* ✓ icon */}
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 200, delay: 0.15 }}
                      className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
                      style={{ background: 'linear-gradient(135deg, #34d399, #10b981)' }}
                    >
                      <CheckCircle className="w-7 h-7 text-white" />
                    </motion.div>

                    <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">All Characters Locked</h2>
                    <p className="text-sm mb-6 max-w-md mx-auto" style={{ color: 'rgba(255,255,255,0.5)' }}>
                      Your cast is ready. Confirm to lock visual consistency across every illustration in your story.
                    </p>

                    <button
                      disabled={confirming}
                      onClick={async () => {
                        setConfirming(true);
                        await fetch(`/api/stories/${storyId}/confirm-characters`, { method: 'POST' });
                        router.refresh();
                      }}
                      className="inline-flex items-center gap-2.5 px-7 py-3.5 rounded-xl text-base font-bold text-white transition-all disabled:opacity-40"
                      style={{ background: 'linear-gradient(135deg, #34d399, #10b981)', boxShadow: '0 4px 24px rgba(52,211,153,0.3)' }}
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
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(255,255,255,0.07)' }}>
                      <Lock className="w-6 h-6" style={{ color: 'rgba(255,255,255,0.35)' }} />
                    </div>
                    <h2 className="text-lg sm:text-xl font-bold text-white mb-2">Lock All Characters to Continue</h2>
                    <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
                      Review each character's portrait and description, then tap <strong className="text-white">Lock</strong> on each card.
                    </p>
                  </>
                )}
              </div>
            </motion.div>
          )}

          {/* B) Confirmed */}
          {storyConfirmed && (
            <motion.div
              key="cta-confirmed"
              initial={{ opacity: 0, translateY: 20 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ duration: 0.45, ease: [0.4, 0, 0.2, 1] }}
              className="mt-10 sm:mt-14"
            >
              <div
                className="rounded-2xl p-6 sm:p-8 text-center"
                style={{
                  background: 'linear-gradient(135deg, rgba(124,92,252,0.1) 0%, rgba(194,94,240,0.06) 100%)',
                  border: '1px solid rgba(124,92,252,0.2)',
                }}
              >
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: 'linear-gradient(135deg, #7c5cfc, #c25ef0)' }}>
                  <CheckCircle className="w-7 h-7 text-white" />
                </div>

                <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">Character Cast Confirmed</h2>
                <p className="text-sm mb-6 max-w-md mx-auto" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  Your characters are locked in. All illustrations will maintain visual consistency throughout the story.
                </p>

                <button
                  onClick={() => router.push(`/stories/${storyId}/locations`)}
                  className="inline-flex items-center gap-2.5 px-7 py-3.5 rounded-xl text-base font-bold text-white transition-all"
                  style={{ background: 'linear-gradient(135deg, #7c5cfc, #c25ef0)', boxShadow: '0 4px 24px rgba(124,92,252,0.35)' }}
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
  );
}