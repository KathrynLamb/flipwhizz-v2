// src/app/stories/components/StoryHeader.tsx
"use client";

import { ChevronLeft, Home, MoreVertical } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function StoryHeader({
  title,
  subtitle,
  showBackButton = true,
  backHref,
  actions,
}: {
  title: string;
  subtitle?: string;
  showBackButton?: boolean;
  backHref?: string;
  actions?: React.ReactNode;
}) {
  const router = useRouter();

  const handleBack = () => {
    if (backHref) {
      router.push(backHref);
    } else {
      router.back();
    }
  };

  return (
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-200/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          {/* Left: Back Button */}
          {showBackButton && (
            <button
              onClick={handleBack}
              className="flex items-center gap-2 text-gray-600 hover:text-black font-semibold transition-colors group"
            >
              <div className="w-8 h-8 rounded-full bg-gray-100 group-hover:bg-gray-200 flex items-center justify-center transition-colors">
                <ChevronLeft className="w-4 h-4" />
              </div>
              <span className="hidden sm:inline">Back</span>
            </button>
          )}

          {/* Center: Title */}
          <div className="flex-1 text-center min-w-0">
            <h1 className="text-lg sm:text-xl font-bold text-gray-900 truncate">
              {title}
            </h1>
            {subtitle && (
              <p className="text-xs sm:text-sm text-gray-500 truncate">
                {subtitle}
              </p>
            )}
          </div>

          {/* Right: Actions or Home */}
          <div className="flex items-center gap-2">
            {actions || (
              <button
                onClick={() => router.push("/projects")}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
              >
                <Home className="w-4 h-4 text-gray-600" />
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}