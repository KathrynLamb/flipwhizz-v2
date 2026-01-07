'use client';

import { motion } from 'framer-motion';
import { Feather, ChevronDown, Sparkles, ArrowRight } from 'lucide-react';
import { useState } from 'react';

export type AuthorLetterData = {
  opening: string;
  intention: string[];
  optionalTweaks: string[];
  invitation: string;
};


export default function AuthorLetter({
  data,
  onRespond,
  onContinue,
}: {
  data: AuthorLetterData;
  onRespond?: () => void;
  onContinue?: () => void;
}) {
  const [showTweaks, setShowTweaks] = useState(false);

  return (
    <motion.section
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="
        bg-white
        rounded-[2.25rem]
        shadow-[0_30px_80px_-40px_rgba(0,0,0,0.25)]
        px-7 py-8
      "
    >
      {/* Header */}
      <header className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 rounded-full bg-violet-100 flex items-center justify-center">
          <Feather className="w-4 h-4 text-violet-700" />
        </div>
        <div>
          <p className="text-xs uppercase tracking-widest text-stone-400">
            From your co-author
          </p>
          <h3 className="text-sm font-bold text-stone-900">
            A note on the first draft
          </h3>
        </div>
      </header>

      {/* Opening */}
      <p className="text-[15px] leading-relaxed text-stone-700 mb-5">
        {data.opening}
      </p>

      {/* Intention */}
      <div className="mb-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-stone-500 mb-2">
          What I focused on
        </p>
        <ul className="space-y-2">
          {data.intention.map((item, i) => (
            <li key={i} className="flex gap-3 text-stone-700 text-sm">
              <span className="mt-1 w-1.5 h-1.5 rounded-full bg-violet-500" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Optional tweaks (collapsed) */}
      {data.optionalTweaks.length > 0 && (
        <div className="mb-6">
          <button
            onClick={() => setShowTweaks(v => !v)}
            className="flex items-center gap-2 text-sm text-stone-600 font-medium hover:text-stone-900 transition"
          >
            <ChevronDown
              className={`w-4 h-4 transition ${showTweaks ? 'rotate-180' : ''}`}
            />
            Optional ideas to explore
          </button>

          {showTweaks && (
            <ul className="mt-3 space-y-2 pl-1">
              {data.optionalTweaks.map((item, i) => (
                <li key={i} className="flex gap-3 text-stone-600 text-sm">
                  <span className="mt-1 w-1.5 h-1.5 rounded-full bg-amber-400" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Invitation */}
      <p className="italic text-sm text-stone-600 mb-6">
        {data.invitation}
      </p>

      {/* Actions */}
      <footer className="flex flex-col gap-3">
        {onContinue && (
          <button
            onClick={onContinue}
            className="
              w-full py-3 rounded-full
              bg-gradient-to-r from-violet-600 to-fuchsia-600
              text-white font-bold
              flex items-center justify-center gap-2
              hover:scale-[1.02] transition
              shadow-md
            "
          >
            Continue as-is
            <ArrowRight className="w-4 h-4" />
          </button>
        )}

        {onRespond && (
          <button
            onClick={onRespond}
            className="
              w-full py-3 rounded-full
              border border-stone-200
              text-stone-700 font-semibold
              hover:bg-stone-50
              flex items-center justify-center gap-2
              transition
            "
          >
            <Sparkles className="w-4 h-4" />
            Suggest a change
          </button>
        )}
      </footer>
    </motion.section>
  );
}
