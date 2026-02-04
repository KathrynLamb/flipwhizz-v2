'use client';

import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, Users, Sparkles, Loader2 } from 'lucide-react';
import { useState } from 'react';

export default function CharactersHeader({
  storyId,
  lockedCount,
  totalCount,
  showProgress = true,
  showGenerateAll = false,
  onGenerateAll,
  isGenerating = false,
}: {
  storyId: string;
  lockedCount: number;
  totalCount: number;
  showProgress?: boolean;
  showGenerateAll?: boolean;
  onGenerateAll?: () => void;
  isGenerating?: boolean;
}) {
  const router = useRouter();
  const progressPercent = totalCount > 0 ? (lockedCount / totalCount) * 100 : 0;

  return (
    <header 
      className="sticky top-0 z-50 backdrop-blur-xl border-b border-white/[0.06]" 
      style={{ background: 'rgba(10,10,15,0.85)' }}
    >
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        {/* Main header row */}
        <div className="flex items-center justify-between h-14 sm:h-16">
          {/* Back button */}
          <button
            onClick={() => router.push(`/stories/${storyId}/hub`)}
            className="flex items-center gap-2 text-sm font-medium text-white/60 hover:text-white transition-colors -ml-2 px-2 py-1.5 rounded-lg hover:bg-white/[0.04] active:scale-95"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Hub</span>
          </button>

          {/* Title - centered */}
          <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-500/20 border border-violet-500/30 flex items-center justify-center">
              <Users className="w-4 h-4 text-violet-400" />
            </div>
            <h1 className="text-base sm:text-lg font-bold text-white">
              Characters
            </h1>
          </div>

          {/* Desktop: Generate All button */}
          {showGenerateAll && onGenerateAll && (
            <button
              onClick={onGenerateAll}
              disabled={isGenerating}
              className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600 transition-all disabled:opacity-40 shadow-lg shadow-violet-500/25 active:scale-95"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Generating</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Generate All</span>
                </>
              )}
            </button>
          )}

          {/* Spacer for mobile layout balance */}
          {!showGenerateAll && <div className="w-16 sm:hidden" />}
        </div>

        {/* Progress bar - only show when needed */}
        {showProgress && totalCount > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="pb-3 sm:pb-4"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-white/40">
                {lockedCount} of {totalCount} locked
              </span>
              <span className="text-xs font-bold text-violet-400">
                {Math.round(progressPercent)}%
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progressPercent}%` }}
                transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
                className="h-full bg-gradient-to-r from-violet-500 to-purple-500 rounded-full"
                style={{
                  boxShadow: progressPercent > 0 ? '0 0 12px rgba(139, 92, 246, 0.5)' : 'none'
                }}
              />
            </div>
          </motion.div>
        )}
      </div>
    </header>
  );
}