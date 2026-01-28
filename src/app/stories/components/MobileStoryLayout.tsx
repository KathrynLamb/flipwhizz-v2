// // src/app/stories/components/MobileStoryLayout.tsx
// 'use client';

// import { motion, AnimatePresence } from 'framer-motion';
// import { ChevronUp, Check, Sparkles } from 'lucide-react';
// import { useState } from 'react';
// import AuthorLetter from './AuthorLetter';

// type Mode = 'read' | 'collab' | 'confirm';

// export default function MobileStoryLayout({
//   page,
//   authorLetter,
//   onAccept,
//   onEdit,
// }: {
//   page: React.ReactNode;
//   authorLetter?: any;
//   onAccept: () => void;
//   onEdit: () => void;
// }) {
//   const [mode, setMode] = useState<Mode>('read');

//   return (
//     <div className="relative min-h-screen bg-white">
//       {/* READING AREA */}
//       <div className="px-5 pt-6 pb-32">
//         {page}
//       </div>

//       {/* FLOATING ACTION BAR */}
//       <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-stone-200 px-4 py-3 z-50">
//         {mode === 'read' && (
//           <button
//             onClick={() => setMode('collab')}
//             className="w-full rounded-full py-3 font-semibold text-stone-700 bg-stone-100 flex items-center justify-center gap-2"
//           >
//             <ChevronUp className="w-4 h-4" />
//             Note from your co-author
//           </button>
//         )}

//         {mode === 'confirm' && (
//           <button
//             onClick={onAccept}
//             className="w-full rounded-full py-3 font-bold bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white"
//           >
//             <Check className="w-4 h-4 inline mr-2" />
//             Confirm & continue
//           </button>
//         )}
//       </div>

//       {/* BOTTOM SHEET */}
//       <AnimatePresence>
//         {mode === 'collab' && authorLetter && (
//           <motion.div
//             initial={{ y: '100%' }}
//             animate={{ y: 0 }}
//             exit={{ y: '100%' }}
//             transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
//             className="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-[2rem] shadow-2xl max-h-[85vh] overflow-y-auto"
//           >
//             <div className="p-6">
//               <AuthorLetter
//                 data={authorLetter}
//                 onContinue={() => setMode('confirm')}
//                 onRespond={() => {
//                   setMode('read');
//                   onEdit();
//                 }}
//               />
//             </div>

//             <button
//               onClick={() => setMode('read')}
//               className="w-full py-4 text-sm text-stone-500"
//             >
//               Close
//             </button>
//           </motion.div>
//         )}
//       </AnimatePresence>
//     </div>
//   );
// }


"use client";

import { motion, useMotionValue, animate, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronUp, Check, MessageSquare, X } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

type Page = {
  pageNumber: number;
  text: string;
};

type AuthorNote = {
  summary?: string;
  focusedOn?: string[];
  optionalIdeas?: string[];
};

export default function MobileStoryLayout({
  story,
  pages,
  authorNote,
  onConfirm,
  onEdit,
}: {
  story: any;
  pages: Page[];
  authorNote?: AuthorNote;
  onConfirm: () => void;
  onEdit: () => void;
}) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);

  const [index, setIndex] = useState(0);
  const [showNote, setShowNote] = useState(false);
  const [showConfirmBar, setShowConfirmBar] = useState(false);
  const [viewportWidth, setViewportWidth] = useState<number | null>(null);

  const x = useMotionValue(0);

  /* ------------------------------ Measure width ---------------------------- */

  useEffect(() => {
    const measure = () => {
      const el = containerRef.current;
      const w = el?.getBoundingClientRect().width ?? window.innerWidth;
      setViewportWidth(w);
      animate(x, -index * w, { duration: 0 });
    };

    measure();

    const ro =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(measure)
        : null;

    if (ro && containerRef.current) ro.observe(containerRef.current);

    window.addEventListener("resize", measure);
    window.addEventListener("orientationchange", measure);

    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("orientationchange", measure);
      ro?.disconnect();
    };
  }, [index, x]);

  /* ------------------------------ Navigation -------------------------------- */

  function clamp(i: number) {
    return Math.max(0, Math.min(i, pages.length - 1));
  }

  function snapTo(i: number) {
    if (viewportWidth == null) return;

    const next = clamp(i);
    setIndex(next);

    animate(x, -next * viewportWidth, {
      type: "spring",
      stiffness: 280,
      damping: 34,
    });
  }

  function onDragEnd(_: any, info: any) {
    if (viewportWidth == null) return;

    const offset = info.offset.x;
    const velocity = info.velocity.x;

    if (offset < -viewportWidth * 0.15 || velocity < -500) {
      snapTo(index + 1);
    } else if (offset > viewportWidth * 0.15 || velocity > 500) {
      snapTo(index - 1);
    } else {
      snapTo(index);
    }
  }

  /* -------------------------------- Actions -------------------------------- */

  function handleViewedNote() {
    setShowNote(false);
    setShowConfirmBar(true);
  }

  if (viewportWidth == null) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 flex items-center justify-center">
        <div className="animate-pulse text-purple-600">Loading...</div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 overflow-hidden"
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      {/* ============================== HEADER ============================== */}
      <div className="absolute top-0 inset-x-0 z-40 bg-white/80 backdrop-blur-md border-b border-gray-200">
        <div className="px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => router.push("/dashboard")}
            className="p-2 -ml-2 hover:bg-gray-100 active:bg-gray-200 rounded-full transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-gray-700" />
          </button>

          <div className="flex-1 text-center">
            <h1 className="text-sm font-bold text-gray-900 truncate px-4">
              {story.title}
            </h1>
            <p className="text-xs text-gray-500">
              Page {index + 1} of {pages.length}
            </p>
          </div>

          <div className="w-9" /> {/* Spacer for centering */}
        </div>
      </div>

      {/* ============================ SWIPE TRACK ============================ */}
      <motion.div
        className="flex h-full pt-16 pb-20"
        style={{ x }}
        drag={showNote ? false : "x"}
        dragConstraints={{
          left: -((pages.length - 1) * viewportWidth),
          right: 0,
        }}
        dragElastic={0.08}
        onDragEnd={onDragEnd}
      >
        {pages.map((page, i) => (
          <div
            key={i}
            className="flex-none shrink-0 h-full flex items-center justify-center px-8"
            style={{ width: viewportWidth }}
          >
            {/* Page Card */}
            <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full max-h-[70vh] overflow-y-auto border border-gray-100">
              <div className="flex items-start justify-between mb-4">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                  Page {page.pageNumber}
                </span>
                <div className="flex gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                  <div className="w-1.5 h-1.5 rounded-full bg-pink-400" />
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                </div>
              </div>

              <p className="text-lg leading-relaxed text-gray-800 font-serif">
                {page.text}
              </p>
            </div>
          </div>
        ))}
      </motion.div>

      {/* =========================== BOTTOM ACTION BAR ======================== */}
      <div className="absolute bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-gray-200 px-4 py-3">
        {!showNote && !showConfirmBar && authorNote && (
          <button
            onClick={() => setShowNote(true)}
            className="w-full rounded-2xl py-4 font-semibold text-gray-700 bg-gradient-to-r from-purple-100 to-pink-100 hover:from-purple-200 hover:to-pink-200 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          >
            <MessageSquare className="w-4 h-4" />
            View Note from Co-Author
          </button>
        )}

        {showConfirmBar && (
          <button
            onClick={onConfirm}
            className="w-full rounded-2xl py-4 font-bold bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-lg hover:shadow-xl active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          >
            <Check className="w-5 h-5" />
            Confirm Story & Continue
          </button>
        )}
      </div>

      {/* ============================ PAGE INDICATORS ========================= */}
      {!showNote && (
        <div className="absolute bottom-24 left-0 right-0 flex justify-center gap-1.5 px-4">
          {pages.map((_, i) => (
            <button
              key={i}
              onClick={() => snapTo(i)}
              className={`h-1.5 rounded-full transition-all ${
                i === index
                  ? "w-8 bg-gradient-to-r from-purple-500 to-pink-500"
                  : "w-1.5 bg-gray-300"
              }`}
            />
          ))}
        </div>
      )}

      {/* ========================== AUTHOR NOTE SHEET ========================= */}
      <AnimatePresence>
        {showNote && authorNote && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/40 z-50"
              onClick={() => setShowNote(false)}
            />

            {/* Bottom Sheet */}
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="absolute inset-x-0 bottom-0 z-50 bg-white rounded-t-3xl shadow-2xl max-h-[85vh] overflow-y-auto"
            >
              {/* Handle */}
              <div className="flex justify-center pt-3 pb-2">
                <div className="w-10 h-1 bg-gray-300 rounded-full" />
              </div>

              {/* Header */}
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-sm">
                    ✨
                  </div>
                  <h3 className="font-bold text-gray-900">Your Co-Author's Note</h3>
                </div>
                <button
                  onClick={() => setShowNote(false)}
                  className="p-1.5 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              {/* Content */}
              <div className="px-6 py-6 space-y-6">
                {/* Summary */}
                {authorNote.summary && (
                  <div>
                    <p className="text-base text-gray-700 leading-relaxed">
                      {authorNote.summary}
                    </p>
                  </div>
                )}

                {/* What I Focused On */}
                {authorNote.focusedOn && authorNote.focusedOn.length > 0 && (
                  <div>
                    <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                      <span className="text-purple-500">✓</span>
                      What I focused on:
                    </h4>
                    <ul className="space-y-2">
                      {authorNote.focusedOn.map((item, i) => (
                        <li
                          key={i}
                          className="text-sm text-gray-700 pl-4 border-l-2 border-purple-200"
                        >
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Optional Ideas */}
                {authorNote.optionalIdeas &&
                  authorNote.optionalIdeas.length > 0 && (
                    <div>
                      <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                        <span className="text-pink-500">💡</span>
                        Optional ideas to explore:
                      </h4>
                      <ul className="space-y-2">
                        {authorNote.optionalIdeas.map((item, i) => (
                          <li
                            key={i}
                            className="text-sm text-gray-700 pl-4 border-l-2 border-pink-200"
                          >
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
              </div>

              {/* Actions */}
              <div className="px-6 pb-6 pt-2 space-y-3">
                <button
                  onClick={handleViewedNote}
                  className="w-full rounded-2xl py-4 font-bold bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-lg hover:shadow-xl active:scale-[0.98] transition-all"
                >
                  Looks Great! Continue
                </button>

                <button
                  onClick={() => {
                    setShowNote(false);
                    onEdit();
                  }}
                  className="w-full rounded-2xl py-4 font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 active:scale-[0.98] transition-all"
                >
                  I'd Like to Make Changes
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}