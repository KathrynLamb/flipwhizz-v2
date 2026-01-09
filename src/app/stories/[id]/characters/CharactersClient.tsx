'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle, Sparkles, Heart, Zap } from 'lucide-react';
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

  return (
    <div>
      {/* CONTENT */}
      <div className="px-6 pb-16">

        <div className="max-w-6xl mx-auto space-y-10">

          {/* COMPACT HEADER */}
          <div className="
              flex items-end justify-between
              gap-6
              flex-wrap
            ">
              <h1 className="
                text-3xl md:text-4xl font-black
                bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500
                bg-clip-text text-transparent
              ">
                Characters
              </h1>

              <p className="text-sm md:text-base text-gray-600 font-medium">
                {characters.length} ready ✨
              </p>
            </div>


          {/* GRID */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mt-2">
            {characters.map((char, idx) => (
              <CharacterCard
                key={char.id}
                character={char}
                index={idx}
              />
            ))}
          </div>

          {/* CONFIRMATION */}
          {!storyConfirmed ? (
            <div className="mt-12 bg-stone-50 rounded-3xl p-8 text-center">
              <div className="flex justify-center gap-3 mb-4">
                <Sparkles className="w-7 h-7 text-pink-500" />
                <Heart className="w-7 h-7 text-purple-500" />
                <Zap className="w-7 h-7 text-blue-500" />
              </div>

              <h2 className="text-3xl font-black mb-3">
                Lock in your cast?
              </h2>

              <p className="text-gray-600 mb-6 max-w-xl mx-auto font-medium">
                This keeps characters visually consistent in every illustration.
                You can still edit the story text later.
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
                  bg-black text-white
                  text-lg font-black
                  px-10 py-4 rounded-2xl
                  hover:scale-105 transition-transform
                  active:scale-95
                  shadow-lg
                  disabled:opacity-60
                "
              >
                {confirming ? 'Locking…' : 'Lock Characters 🔒'}
              </button>
            </div>
          ) : (
            <div className="mt-12 bg-emerald-500 rounded-3xl p-8 text-center text-white">
              <CheckCircle className="w-12 h-12 mx-auto mb-4" />
              <h2 className="text-3xl font-black mb-2">
                Characters Locked
              </h2>
              <p className="font-medium mb-6">
                Your illustrations will stay perfectly consistent.
              </p>
              <button
                onClick={() => router.push(`/stories/${storyId}/design`)}
                className="
                  bg-white text-black
                  font-black
                  px-8 py-4 rounded-xl
                  hover:scale-105 transition-transform
                "
              >
                Continue to Design →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
