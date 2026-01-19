'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CheckCircle, 
  Sparkles, 
  Lock, 
  Plus,
  Users,
  ChevronRight,
  Loader2,
  Info
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
      if (!cancelled) {
        setIsPurchased(data.purchased);
      }
    }
  
    checkPurchase();
  
    return () => {
      cancelled = true;
    };
  }, [storyId]);
  

  function handleDelete(id: string) {
    setCharactersLocal(prev => prev.filter(c => c.id !== id));
  }

  useEffect(() => {
    setCharactersLocal(characters);
  }, [characters]);

  async function generateAIAvatars() {
    if (!confirm('Generate AI portraits for all characters? This will use AI credits.')) return;
    
    setGeneratingAvatars(true);
    try {
      const res = await fetch(`/api/stories/${storyId}/generate-all-avatars`, {
        method: 'POST',
      });
      
      if (res.ok) {
        router.refresh();
      } else {
        alert('Failed to generate avatars. Please try again.');
      }
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
  const hasImages = charactersLocal.some(c => c.portraitImageUrl || c.referenceImageUrl);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      
      {/* HEADER */}
      <motion.header 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="sticky top-0 z-40 backdrop-blur-xl bg-white/80 border-b border-slate-200"
      >
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between gap-6 flex-wrap">
            
            {/* Left: Title & Status */}
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                <Users className="w-6 h-6 text-white" />
              </div>
              
              <div>
                <h1 className="text-2xl font-bold text-slate-900">
                  Character Gallery
                </h1>
                <p className="text-sm text-slate-500 flex items-center gap-2 mt-0.5">
                  <span>{totalCount} characters</span>
                  {lockedCount > 0 && (
                    <>
                      <span className="text-slate-300">•</span>
                      <span className="text-violet-600 font-medium">
                        {lockedCount} locked
                      </span>
                    </>
                  )}
                </p>
              </div>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-3">
              {isPurchased && !allLocked && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  onClick={generateAIAvatars}
                  disabled={generatingAvatars}
                  className="
                    px-4 py-2.5 rounded-xl
                    bg-gradient-to-r from-violet-500 to-purple-600
                    text-white font-semibold text-sm
                    hover:shadow-lg hover:scale-105
                    active:scale-95
                    transition-all
                    disabled:opacity-50 disabled:cursor-not-allowed
                    flex items-center gap-2
                  "
                >
                  {generatingAvatars ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Generate All Portraits
                    </>
                  )}
                </motion.button>
              )}

              {!storyConfirmed && allLocked && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="
                    px-4 py-2 rounded-xl
                    bg-amber-50 border border-amber-200
                    text-amber-800 text-sm font-medium
                    flex items-center gap-2
                  "
                >
                  <Info className="w-4 h-4" />
                  Ready to confirm
                </motion.div>
              )}
            </div>
          </div>
        </div>
      </motion.header>

      {/* MAIN CONTENT */}
      <main className="max-w-7xl mx-auto px-6 py-10">
        
        {/* Progress Banner */}
        {!storyConfirmed && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="
              mb-8 p-6 rounded-2xl
              bg-gradient-to-r from-violet-50 to-purple-50
              border border-violet-100
            "
          >
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-violet-500 flex items-center justify-center flex-shrink-0">
                <Lock className="w-5 h-5 text-white" />
              </div>
              
              <div className="flex-1">
                <h3 className="font-bold text-slate-900 mb-1">
                  Lock Your Characters
                </h3>
                <p className="text-sm text-slate-600 mb-3">
                  Once locked, these characters will maintain visual consistency across all illustrations. 
                  Add portraits, refine descriptions, then lock each character when ready.
                </p>
                
                {/* Progress Bar */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(lockedCount / totalCount) * 100}%` }}
                      transition={{ duration: 0.5, ease: 'easeOut' }}
                      className="h-full bg-gradient-to-r from-violet-500 to-purple-600"
                    />
                  </div>
                  <span className="text-sm font-semibold text-slate-700 min-w-[60px]">
                    {lockedCount}/{totalCount}
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* CHARACTER GRID */}
        <AnimatePresence mode="popLayout">
          <motion.div 
            layout
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
          >
            {charactersLocal.map((char, idx) => (
              <motion.div
                key={char.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ 
                  duration: 0.3,
                  delay: idx * 0.05,
                  layout: { duration: 0.3 }
                }}
              >
                <CharacterCard
                  character={char}
                  index={idx}
                  onDelete={handleDelete}
                  storyId={storyId}
                />
              </motion.div>
            ))}
          </motion.div>
        </AnimatePresence>

        {/* EMPTY STATE */}
        {charactersLocal.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-20"
          >
            <div className="w-20 h-20 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
              <Users className="w-10 h-10 text-slate-400" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">
              No Characters Yet
            </h3>
            <p className="text-slate-500 mb-6 max-w-md mx-auto">
              Characters will appear here after extraction. 
              Return to your story hub to run character extraction.
            </p>
            <button
              onClick={() => router.push(`/stories/${storyId}/hub`)}
              className="
                px-6 py-3 rounded-xl
                bg-slate-900 text-white font-semibold
                hover:scale-105 transition-transform
              "
            >
              Back to Hub
            </button>
          </motion.div>
        )}

        {/* CONFIRMATION SECTION */}
        {!storyConfirmed && charactersLocal.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-12"
          >
            <div className={`
              rounded-2xl p-8
              ${allLocked 
                ? 'bg-gradient-to-r from-emerald-50 to-teal-50 border-2 border-emerald-200' 
                : 'bg-slate-50 border-2 border-slate-200'
              }
              transition-all duration-500
            `}>
              <div className="max-w-2xl mx-auto text-center">
                
                {allLocked ? (
                  <>
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', delay: 0.2 }}
                      className="w-16 h-16 rounded-2xl bg-emerald-500 flex items-center justify-center mx-auto mb-4"
                    >
                      <CheckCircle className="w-8 h-8 text-white" />
                    </motion.div>
                    
                    <h2 className="text-3xl font-bold text-slate-900 mb-3">
                      All Characters Locked
                    </h2>
                    
                    <p className="text-slate-600 mb-8 text-lg">
                      Perfect! Your characters are ready. Lock them in to maintain visual consistency 
                      across all illustrations in your story.
                    </p>
                    
                    <button
                      disabled={confirming}
                      onClick={async () => {
                        setConfirming(true);
                        await fetch(
                          `/api/stories/${storyId}/confirm-characters`,
                          { method: 'POST' }
                        );
                        router.refresh();
                      }}
                      className="
                        px-8 py-4 rounded-xl
                        bg-gradient-to-r from-emerald-500 to-teal-600
                        text-white text-lg font-bold
                        hover:shadow-xl hover:scale-105
                        active:scale-95
                        transition-all
                        disabled:opacity-50 disabled:cursor-not-allowed
                        inline-flex items-center gap-3
                      "
                    >
                      {confirming ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          Confirming...
                        </>
                      ) : (
                        <>
                          <Lock className="w-5 h-5" />
                          Confirm Character Cast
                        </>
                      )}
                    </button>
                  </>
                ) : (
                  <>
                    <div className="w-16 h-16 rounded-2xl bg-slate-200 flex items-center justify-center mx-auto mb-4">
                      <Lock className="w-8 h-8 text-slate-400" />
                    </div>
                    
                    <h2 className="text-2xl font-bold text-slate-900 mb-3">
                      Lock All Characters to Continue
                    </h2>
                    
                    <p className="text-slate-600 mb-4">
                      Each character must be locked before you can proceed. 
                      Review their portraits and descriptions, then lock each one individually.
                    </p>
                    
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-slate-200">
                      <span className="text-sm font-semibold text-slate-700">
                        {lockedCount} of {totalCount} locked
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* CONFIRMED STATE */}
        {storyConfirmed && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-12"
          >
            <div className="
              rounded-2xl p-8
              bg-gradient-to-r from-violet-50 to-purple-50
              border-2 border-violet-200
            ">
              <div className="max-w-2xl mx-auto text-center">
                <div className="w-16 h-16 rounded-2xl bg-violet-500 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-white" />
                </div>
                
                <h2 className="text-3xl font-bold text-slate-900 mb-3">
                  Character Cast Confirmed
                </h2>
                
                <p className="text-slate-600 mb-8 text-lg">
                  Your characters are locked and ready. All illustrations will maintain visual consistency.
                </p>
                
                <button
                  onClick={() => router.push(`/stories/${storyId}/locations`)}
                  className="
                    px-8 py-4 rounded-xl
                    bg-slate-900 text-white text-lg font-bold
                    hover:scale-105
                    active:scale-95
                    transition-all
                    inline-flex items-center gap-3
                  "
                >
                  Continue to locations
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </main>
    </div>
  );
}