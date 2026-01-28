// src/app/stories/components/StoryFooter.tsx
"use client";

import { motion } from "framer-motion";

export default function StoryFooter({
  currentStep,
  totalSteps,
  primaryAction,
  secondaryAction,
  showProgress = true,
}: {
  currentStep?: number;
  totalSteps?: number;
  primaryAction?: {
    label: string;
    onClick: () => void;
    disabled?: boolean;
    loading?: boolean;
    icon?: React.ReactNode;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
    disabled?: boolean;
  };
  showProgress?: boolean;
}) {
  return (
    <footer className="sticky bottom-0 z-40 bg-white/95 backdrop-blur-xl border-t border-gray-200/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
        {/* Progress Bar */}
        {showProgress && currentStep !== undefined && totalSteps !== undefined && (
          <div className="mb-4">
            <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
              <span>
                Step {currentStep} of {totalSteps}
              </span>
              <span>{Math.round((currentStep / totalSteps) * 100)}%</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500"
                initial={{ width: "0%" }}
                animate={{ width: `${(currentStep / totalSteps) * 100}%` }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              />
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3">
          {/* Secondary Action (Optional) */}
          {secondaryAction && (
            <button
              onClick={secondaryAction.onClick}
              disabled={secondaryAction.disabled}
              className="flex-1 sm:flex-initial px-6 py-3 rounded-full font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {secondaryAction.label}
            </button>
          )}

          {/* Primary Action */}
          {primaryAction && (
            <button
              onClick={primaryAction.onClick}
              disabled={primaryAction.disabled || primaryAction.loading}
              className="flex-1 sm:flex-initial px-6 py-3 rounded-full font-bold text-white bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
            >
              {primaryAction.loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Loading...</span>
                </>
              ) : (
                <>
                  {primaryAction.icon}
                  <span>{primaryAction.label}</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </footer>
  );
}