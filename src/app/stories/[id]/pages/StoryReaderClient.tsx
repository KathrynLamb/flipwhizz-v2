'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight, BookOpen } from 'lucide-react';
import { useRouter } from 'next/navigation';

/* ======================================================
   TYPES
====================================================== */

type StoryPage = {
  id: string;
  pageNumber: number;
  text: string;
};

export default function StoryReaderClient({
  title,
  pages,
}: {
  title: string;
  pages: StoryPage[];
}) {
  const router = useRouter();
  const spreads = chunkIntoSpreads(pages);

  const [index, setIndex] = useState(0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-fuchsia-50 to-amber-50">
      {/* TOP BAR */}
      <div className="fixed top-0 inset-x-0 z-50 bg-white/80 backdrop-blur border-b border-white">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-stone-600 hover:text-black font-medium"
          >
            <ArrowLeft className="w-5 h-5" />
            Back
          </button>

          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-violet-100">
            <BookOpen className="w-4 h-4 text-violet-600" />
            <span className="text-sm font-bold text-violet-900">
              Spread {index + 1} / {spreads.length}
            </span>
          </div>
        </div>
      </div>

      {/* CONTENT */}
      <div className="pt-28 pb-20 px-6">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-center mb-12 text-5xl md:text-6xl font-black bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 bg-clip-text text-transparent">
            {title}
          </h1>

          <AnimatePresence mode="wait">
            <motion.div
              key={index}
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ duration: 0.4 }}
              className="grid md:grid-cols-2 gap-6 bg-white/80 backdrop-blur-xl border border-white rounded-[2.5rem] shadow-2xl p-8 md:p-12"
            >
              <PageCard page={spreads[index][0]} />
              <PageCard page={spreads[index][1]} />
            </motion.div>
          </AnimatePresence>

          {/* NAV */}
          <div className="flex justify-between mt-10">
            <button
              disabled={index === 0}
              onClick={() => setIndex(i => i - 1)}
              className="px-6 py-3 rounded-full bg-white shadow font-bold disabled:opacity-40"
            >
              Previous
            </button>

            <button
              disabled={index === spreads.length - 1}
              onClick={() => setIndex(i => i + 1)}
              className="px-6 py-3 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white font-bold shadow-xl disabled:opacity-40"
            >
              Next
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
