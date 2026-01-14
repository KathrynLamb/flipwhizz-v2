'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Stars, Wand2, Check } from 'lucide-react';
import { useRouter } from 'next/navigation';
import AuthorLetter from '@/app/stories/components/AuthorLetter';
import MobileStoryLayout from '@/app/stories/components/MobileStoryLayout';

/* ======================================================
   TYPES
====================================================== */

type StoryPage = {
  pageNumber: number;
  text: string;
};

export type AuthorLetterApiResponse = {
  letter: string;
  whatICenteredOn: string[];
  thingsYouMightTweak: string[];
  invitation: string;
};

export type AuthorLetterUI = {
  opening: string;
  intention: string[];
  optionalTweaks: string[];
  invitation: string;
};




type EditMode = 'undecided' | 'accepted' | 'editing';

/* ======================================================
   COMPONENT
====================================================== */

export default function StoryReaderClient({
  title,
  pages,
  id,
}: {
  title: string;
  pages: StoryPage[];
  id: string;
}) {
  const router = useRouter();
  const spreads = chunkIntoSpreads(pages);


  const [index, setIndex] = useState(0);
  const [rewriteInstruction, setRewriteInstruction] = useState('');
  const [editMode, setEditMode] = useState<EditMode>('undecided');

  /** 🔑 hydration safety */
  const [mounted, setMounted] = useState(false);
  const [authorLetter, setAuthorLetter] = useState<AuthorLetterApiResponse | null>(null);
 
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

useEffect(() => {
  fetch(`/api/stories/${id}/author-letter`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title,
      pages,
      // optionally: conversation history
    }),
  })
    .then(res => res.json())
    .then((res) => {
      if (
        res &&
        typeof res.letter === "string" &&
        Array.isArray(res.whatICenteredOn) &&
        Array.isArray(res.thingsYouMightTweak) &&
        typeof res.invitation === "string"
      ) {
        setAuthorLetter(res);
      } else {
        console.warn("Invalid author letter payload", res);
      }
    })
    
    .catch(console.error);
}, [title, pages]);

const adaptedAuthorLetter = authorLetter && {
  opening: authorLetter.letter,
  intention: authorLetter.whatICenteredOn ?? [],
  optionalTweaks: authorLetter.thingsYouMightTweak ?? [],
  invitation: authorLetter.invitation,
};



useEffect(() => {
  setMounted(true);
}, []);

if (!mounted) {
  return null;
}

// const isMobile =
//   typeof window !== 'undefined' && window.innerWidth < 768;

  return isMobile ? (
    <MobileStoryLayout
      page={<PageCard page={pages[index]} />}
      authorLetter={adaptedAuthorLetter}
      onAccept={() => setEditMode('accepted')}
      onEdit={() => setEditMode('editing')}
    />
  ) : (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-fuchsia-50 to-amber-50">
      <div className="max-w-7xl mx-auto px-6 py-10">
  
        {/* TITLE */}
        <h1
          className={`
            text-center mb-10
            text-4xl md:text-5xl font-black
            ${mounted
              ? 'bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 bg-clip-text text-transparent'
              : 'text-stone-900'}
          `}
        >
          {title}
        </h1>
  
        {/* MAIN GRID */}
        <div className="grid lg:grid-cols-[1fr_420px] gap-8 items-start">
  
          {/* LEFT: BOOK SPREAD */}
          {mounted && (
            <AnimatePresence mode="wait">
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                className="
                  bg-white rounded-[2.75rem]
                  shadow-[0_30px_80px_-30px_rgba(0,0,0,0.25)]
                  px-8 py-10
                "
              >
                <div className="grid gap-8 md:grid-cols-2">
                  <PageCard page={spreads[index][0]} />
                  <PageCard page={spreads[index][1]} />
                </div>
  
                {/* NAV */}
                <div className="mt-10 flex items-center justify-between border-t border-stone-100 pt-6">
                  <button
                    disabled={index === 0}
                    onClick={() => setIndex(i => i - 1)}
                    className="
                      px-5 py-2 rounded-full
                      font-bold text-sm
                      bg-stone-100 text-stone-700
                      hover:bg-stone-200
                      disabled:opacity-30
                    "
                  >
                    ← Previous
                  </button>
  
                  <button
                    disabled={index === spreads.length - 1}
                    onClick={() => setIndex(i => i + 1)}
                    className="
                      px-5 py-2 rounded-full
                      font-bold text-sm
                      bg-gradient-to-r from-violet-600 to-fuchsia-600
                      text-white
                      hover:scale-[1.04]
                      transition
                      disabled:opacity-30
                    "
                  >
                    Next →
                  </button>
                </div>
              </motion.div>
            </AnimatePresence>
          )}
  
          {/* RIGHT: AUTHOR COLLAB PANEL */}
          <div className="sticky top-8 space-y-6">
  
            {adaptedAuthorLetter && (
              <AuthorLetter
                data={adaptedAuthorLetter}
                onRespond={() => setEditMode('editing')}
                onContinue={() => setEditMode('accepted')}
              />
            )}
  
            {editMode === 'undecided' && (
              <div className="bg-white rounded-3xl shadow-lg p-6 space-y-3">
                <button
                  onClick={() => setEditMode('accepted')}
                  className="
                    w-full py-4 rounded-full
                    bg-gradient-to-r from-emerald-500 to-teal-500
                    text-white font-black
                    shadow-md hover:scale-[1.03] transition
                  "
                >
                  Accept this as-is
                </button>
  
                <button
                  onClick={() => setEditMode('editing')}
                  className="
                    w-full py-4 rounded-full
                    border border-stone-300
                    text-stone-700 font-bold
                    hover:bg-stone-50 transition
                  "
                >
                  Make edits with the author
                </button>
              </div>
            )}
  
            {editMode === 'editing' && (
              <div className="bg-white rounded-3xl shadow-xl p-6 space-y-4">
                <h4 className="font-bold text-stone-800">
                  How should this change?
                </h4>
  
                <textarea
                  value={rewriteInstruction}
                  onChange={(e) => setRewriteInstruction(e.target.value)}
                  className="
                    w-full min-h-[120px]
                    rounded-2xl border border-stone-200
                    px-4 py-3 text-sm
                    focus:outline-none focus:ring-2 focus:ring-violet-400
                    resize-none
                    text-slate-700
                  "
                />
  
                <button
                  disabled={!rewriteInstruction.trim()}
                  className="
                    w-full py-3 rounded-full
                    bg-gradient-to-r from-violet-600 to-fuchsia-600
                    text-white font-bold
                    flex items-center justify-center gap-2
                    hover:scale-[1.02] transition
                    disabled:opacity-40
                  "
                >
                  <Wand2 className="w-5 h-5" />
                  Rewrite this spread
                </button>
              </div>
            )}
  
            <button
              onClick={() => router.push(`/stories/${id}/extract`)}
              disabled={editMode === 'editing'}
              className="
                w-full py-4 rounded-full
                bg-[#4635B1]
                text-white font-black
                shadow-xl shadow-[#4635B1]/30
                flex items-center justify-center gap-2
                hover:scale-[1.03] transition
                disabled:opacity-40
              "
            >
              <Check className="w-5 h-5 text-[#AEEA94]" />
              Confirm Story & Continue
            </button>
          </div>
        </div>
      </div>
    </div>
  );
            }  
/* ======================================================
   HELPERS
====================================================== */

function PageCard({ page }: { page?: StoryPage }) {
  return (
    <div className="rounded-3xl bg-white p-8 shadow-inner min-h-[320px]">
      {page ? (
        <>
          <div className="text-xs font-bold text-stone-400 mb-3">
            Page {page.pageNumber}
          </div>
          <p className="text-lg leading-relaxed text-stone-800 whitespace-pre-line">
            {page.text}
          </p>
        </>
      ) : (
        <div className="h-full flex items-center justify-center text-stone-300 italic">
          Blank page
        </div>
      )}
    </div>
  );
}

function chunkIntoSpreads(pages: StoryPage[]) {
  const spreads: [StoryPage?, StoryPage?][] = [];
  for (let i = 0; i < pages.length; i += 2) {
    spreads.push([pages[i], pages[i + 1]]);
  }
  return spreads;
}
