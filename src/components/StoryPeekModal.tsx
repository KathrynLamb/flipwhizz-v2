// src/components/StoryPeekModal.tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";

interface PageData {
  id: string;
  imageUrl: string;
  text: string | null;
}

interface StoryPeekModalProps {
  storyId: string;
  storyTitle: string;
  coverImage: string;
  onClose: () => void;
}

export default function StoryPeekModal({
  storyId,
  storyTitle,
  coverImage,
  onClose,
}: StoryPeekModalProps) {
  const [pages, setPages] = useState<PageData[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [direction, setDirection] = useState<"left" | "right" | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);

  // Touch handling
  const touchStartX = useRef(0);
  const touchDeltaX = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch spreads
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/public/stories/${storyId}/spreads`);
        if (!res.ok) throw new Error("Failed");
        const data = await res.json();
        if (!cancelled) {
          // Prepend the cover as the first "page"
          const coverPage: PageData = {
            id: "cover",
            imageUrl: coverImage,
            text: null,
          };
          setPages([coverPage, ...data.pages]);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [storyId, coverImage]);

  // Lock body scroll when modal is open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const totalPages = pages.length;
  const isLastPage = currentPage === totalPages; // totalPages = CTA screen

  const goTo = useCallback(
    (dir: "next" | "prev") => {
      if (isAnimating) return;
      const maxPage = totalPages; // includes CTA screen at the end
      if (dir === "next" && currentPage < maxPage) {
        setDirection("left");
        setIsAnimating(true);
        setTimeout(() => {
          setCurrentPage((p) => p + 1);
          setIsAnimating(false);
        }, 250);
      }
      if (dir === "prev" && currentPage > 0) {
        setDirection("right");
        setIsAnimating(true);
        setTimeout(() => {
          setCurrentPage((p) => p - 1);
          setIsAnimating(false);
        }, 250);
      }
    },
    [currentPage, totalPages, isAnimating]
  );

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        goTo("next");
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goTo("prev");
      }
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [goTo, onClose]);

  // Touch handlers
  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchDeltaX.current = 0;
  };

  const onTouchMove = (e: React.TouchEvent) => {
    touchDeltaX.current = e.touches[0].clientX - touchStartX.current;
  };

  const onTouchEnd = () => {
    if (Math.abs(touchDeltaX.current) > 50) {
      if (touchDeltaX.current < 0) goTo("next");
      else goTo("prev");
    }
  };

  // Current page data
  const page = pages[currentPage] ?? null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label={`Peek inside: ${storyTitle}`}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/85 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal container */}
      <div
        ref={containerRef}
        className="relative z-10 w-full max-w-4xl mx-4 flex flex-col items-center"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute -top-12 right-0 md:right-0 text-white/70 hover:text-white transition-colors z-20"
          aria-label="Close"
        >
          <svg
            className="w-8 h-8"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>

        {/* Title bar */}
        <div className="w-full flex items-center justify-between mb-4 px-1">
          <h3 className="text-white/90 font-serif text-lg font-bold truncate pr-4">
            {storyTitle}
          </h3>
          {!loading && !error && (
            <span className="text-white/50 text-sm whitespace-nowrap">
              {isLastPage
                ? ""
                : `${currentPage + 1} / ${totalPages}`}
            </span>
          )}
        </div>

        {/* Page area */}
        <div className="relative w-full aspect-[4/3] md:aspect-[16/10] rounded-xl overflow-hidden bg-[#1a1a1a] shadow-2xl">
          {loading ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
              <div className="w-10 h-10 border-3 border-white/20 border-t-white/80 rounded-full animate-spin" />
              <p className="text-white/50 text-sm">Loading pages…</p>
            </div>
          ) : error ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="text-white/50 text-sm">
                Couldn&apos;t load this story. Try again later.
              </p>
            </div>
          ) : isLastPage ? (
            /* ── End CTA screen ── */
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-[#FDF8F0] to-[#f3e8d5] p-8 text-center">
              <p className="font-serif text-3xl md:text-4xl text-[#261C15] font-bold leading-tight mb-4">
                Imagine their name on every page
              </p>
              <p className="text-[#6B5D52] text-base max-w-md mb-8">
                This was Sophia&apos;s story. Yours will be completely
                different — written and illustrated just for your child.
              </p>
              <a
                href="/projects"
                className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold px-8 py-3.5 rounded-full transition-colors duration-200 shadow-lg hover:shadow-xl"
              >
                Make their story
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M17 8l4 4m0 0l-4 4m4-4H3"
                  />
                </svg>
              </a>
            </div>
          ) : page ? (
            /* ── Page image ── */
            <div
              className={`absolute inset-0 transition-all duration-250 ease-out ${
                isAnimating
                  ? direction === "left"
                    ? "opacity-0 -translate-x-6"
                    : "opacity-0 translate-x-6"
                  : "opacity-100 translate-x-0"
              }`}
            >
              <Image
                src={page.imageUrl}
                alt={page.text || `Page ${currentPage + 1}`}
                fill
                className="object-contain"
                sizes="(max-width: 768px) 95vw, 900px"
                priority={currentPage < 2}
              />

              {/* Optional text overlay for spread narrative */}
              {/* {page.text && currentPage > 0 && (
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-6 pt-12">
                  <p className="text-white/90 text-sm md:text-base leading-relaxed max-w-2xl mx-auto text-center font-serif">
                    {page.text}
                  </p>
                </div>
              )} */}
            </div>
          ) : null}

          {/* Navigation arrows — desktop */}
          {!loading && !error && !isLastPage && (
            <>
              {currentPage > 0 && (
                <button
                  onClick={() => goTo("prev")}
                  className="hidden md:flex absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/40 hover:bg-black/60 text-white/80 hover:text-white items-center justify-center transition-all duration-200 backdrop-blur-sm"
                  aria-label="Previous page"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15 19l-7-7 7-7"
                    />
                  </svg>
                </button>
              )}
              <button
                onClick={() => goTo("next")}
                className="hidden md:flex absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/40 hover:bg-black/60 text-white/80 hover:text-white items-center justify-center transition-all duration-200 backdrop-blur-sm"
                aria-label="Next page"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </button>
            </>
          )}
        </div>

        {/* Progress bar */}
        {!loading && !error && totalPages > 1 && (
          <div className="w-full mt-4 flex gap-1">
            {Array.from({ length: totalPages + 1 }).map((_, i) => (
              <div
                key={i}
                className={`h-1 rounded-full flex-1 transition-all duration-300 ${
                  i <= currentPage
                    ? "bg-purple-400"
                    : "bg-white/15"
                }`}
              />
            ))}
          </div>
        )}

        {/* Mobile hint */}
        {!loading && !error && currentPage === 0 && (
          <p className="md:hidden text-white/40 text-xs mt-4 animate-pulse">
            Swipe to flip through pages →
          </p>
        )}
      </div>
    </div>
  );
}