// src/app/stories/components/MobileStoryLayout.tsx
'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { ChevronUp, Check, Sparkles } from 'lucide-react';
import { useState } from 'react';
import AuthorLetter from './AuthorLetter';

type Mode = 'read' | 'collab' | 'confirm';

export default function MobileStoryLayout({
  page,
  authorLetter,
  onAccept,
  onEdit,
}: {
  page: React.ReactNode;
  authorLetter?: any;
  onAccept: () => void;
  onEdit: () => void;
}) {
  const [mode, setMode] = useState<Mode>('read');

  return (
    <div className="relative min-h-screen bg-white">
      {/* READING AREA */}
      <div className="px-5 pt-6 pb-32">
        {page}
      </div>

      {/* FLOATING ACTION BAR */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-stone-200 px-4 py-3 z-50">
        {mode === 'read' && (
          <button
            onClick={() => setMode('collab')}
            className="w-full rounded-full py-3 font-semibold text-stone-700 bg-stone-100 flex items-center justify-center gap-2"
          >
            <ChevronUp className="w-4 h-4" />
            Note from your co-author
          </button>
        )}

        {mode === 'confirm' && (
          <button
            onClick={onAccept}
            className="w-full rounded-full py-3 font-bold bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white"
          >
            <Check className="w-4 h-4 inline mr-2" />
            Confirm & continue
          </button>
        )}
      </div>

      {/* BOTTOM SHEET */}
      <AnimatePresence>
        {mode === 'collab' && authorLetter && (
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-[2rem] shadow-2xl max-h-[85vh] overflow-y-auto"
          >
            <div className="p-6">
              <AuthorLetter
                data={authorLetter}
                onContinue={() => setMode('confirm')}
                onRespond={() => {
                  setMode('read');
                  onEdit();
                }}
              />
            </div>

            <button
              onClick={() => setMode('read')}
              className="w-full py-4 text-sm text-stone-500"
            >
              Close
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
