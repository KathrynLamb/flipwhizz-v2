"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  X,
  Maximize,
  Minimize,
  Volume2,
  VolumeX,
  Loader2,
  Pause,
  Play,
} from "lucide-react";

// ─── Types ───
interface ReaderPage {
  type: "cover" | "spread";
  imageUrl: string | null;
  leftText: string | null;
  rightText: string | null;
  spreadIndex: number;
}

interface Props {
  story: {
    id: string;
    title: string;
    coverSpreadUrl: string | null;
  };
  pages: ReaderPage[];
}

// ─── Audio state per page ───
type AudioState = "idle" | "loading" | "playing" | "paused" | "error";

export default function StoryReader({ story, pages }: Props) {
  const router = useRouter();
  const [currentPage, setCurrentPage] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const controlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Audio state
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [audioState, setAudioState] = useState<AudioState>("idle");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioCache = useRef<Map<number, string>>(new Map());

  const totalPages = pages.length;
  const page = pages[currentPage];
  const isCover = page?.type === "cover";

  // ─── Navigation ───
  const goNext = useCallback(() => {
    if (currentPage < totalPages - 1) {
      setCurrentPage((p) => p + 1);
    }
  }, [currentPage, totalPages]);

  const goPrev = useCallback(() => {
    if (currentPage > 0) {
      setCurrentPage((p) => p - 1);
    }
  }, [currentPage]);

  // Keep a ref to audioEnabled so the page-change effect always has the latest value
  const audioEnabledRef = useRef(audioEnabled);
  useEffect(() => {
    audioEnabledRef.current = audioEnabled;
  }, [audioEnabled]);

  // ─── Stop audio on page change, auto-play if enabled ───
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setAudioState("idle");

    // Auto-play if audio is enabled and page has text
    const currentPageData = pages[currentPage];
    const isCoverPage = currentPageData?.type === "cover";

    if (audioEnabledRef.current && currentPageData && !isCoverPage) {
      const text = [currentPageData.leftText, currentPageData.rightText]
        .filter(Boolean)
        .join(" ");
      if (text) {
        // Small delay to let the page transition render
        const timer = setTimeout(() => {
          playAudioForPage(currentPage, text);
        }, 300);
        return () => clearTimeout(timer);
      }
    }
  }, [currentPage]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Audio: fetch from API and play ───
  async function playAudioForPage(pageIndex: number, text: string) {
    // Check cache first
    if (audioCache.current.has(pageIndex)) {
      const cachedUrl = audioCache.current.get(pageIndex)!;
      playAudioUrl(cachedUrl);
      return;
    }

    setAudioState("loading");

    try {
      const res = await fetch(`/api/stories/${story.id}/narrate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          pageIndex,
        }),
      });

      if (!res.ok) throw new Error("Narration failed");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      audioCache.current.set(pageIndex, url);
      playAudioUrl(url);
    } catch (err) {
      console.error("Audio narration failed:", err);
      setAudioState("error");
    }
  }

  function playAudioUrl(url: string) {
    if (audioRef.current) {
      audioRef.current.pause();
    }

    const audio = new Audio(url);
    audioRef.current = audio;

    audio.onplay = () => setAudioState("playing");
    audio.onpause = () => {
      if (!audio.ended) setAudioState("paused");
    };
    audio.onended = () => {
      setAudioState("idle");
      // Auto-advance to next page when narration finishes
      if (currentPage < totalPages - 1) {
        setTimeout(goNext, 800);
      }
    };
    audio.onerror = () => setAudioState("error");

    audio.play().catch(() => setAudioState("error"));
  }

  function togglePlayPause() {
    if (!audioEnabled) {
      setAudioEnabled(true);

      if (isCover) {
        // On cover, advance to first story page and play
        if (currentPage < totalPages - 1) {
          setCurrentPage(currentPage + 1);
          // Audio will auto-play via the useEffect on currentPage change
          // because audioEnabled will be true by then
        }
      } else {
        const text = [page?.leftText, page?.rightText].filter(Boolean).join(" ");
        if (text) {
          playAudioForPage(currentPage, text);
        }
      }
      return;
    }

    if (audioState === "playing" && audioRef.current) {
      audioRef.current.pause();
    } else if (audioState === "paused" && audioRef.current) {
      audioRef.current.play();
    } else if (audioState === "idle") {
      if (isCover) {
        if (currentPage < totalPages - 1) {
          setCurrentPage(currentPage + 1);
        }
      } else {
        const text = [page?.leftText, page?.rightText].filter(Boolean).join(" ");
        if (text) {
          playAudioForPage(currentPage, text);
        }
      }
    }
  }

  function toggleAudioOff() {
    setAudioEnabled(false);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setAudioState("idle");
  }

  // ─── Preload next image ───
  useEffect(() => {
    if (currentPage < totalPages - 1) {
      const nextPage = pages[currentPage + 1];
      if (nextPage?.imageUrl) {
        const img = new Image();
        img.src = nextPage.imageUrl;
      }
    }
  }, [currentPage, pages, totalPages]);

  // ─── Keyboard ───
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        goNext();
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPrev();
      }
      if (e.key === "Escape") {
        if (isFullscreen) toggleFullscreen();
        else router.push(`/stories/${story.id}/book`);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [goNext, goPrev, isFullscreen, router, story.id]);

  // ─── Touch/Swipe ───
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50) {
      if (dx < 0) goNext();
      else goPrev();
    }
  };

  // ─── Auto-hide controls ───
  const showControlsBriefly = useCallback(() => {
    setShowControls(true);
    if (controlsTimer.current) clearTimeout(controlsTimer.current);
    controlsTimer.current = setTimeout(() => setShowControls(false), 3500);
  }, []);

  useEffect(() => {
    showControlsBriefly();
  }, [currentPage, showControlsBriefly]);

  // ─── Fullscreen ───
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  // ─── Cleanup audio on unmount ───
  useEffect(() => {
    return () => {
      if (audioRef.current) audioRef.current.pause();
      audioCache.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  // ─── Audio button rendering ───
  function AudioButton() {
    if (!audioEnabled) {
      return (
        <button
          onClick={(e) => {
            e.stopPropagation();
            togglePlayPause();
          }}
          className="h-9 px-3 rounded-full bg-white/10 backdrop-blur-md flex items-center gap-1.5 text-white/70 hover:bg-white/20 transition text-[11px] font-medium"
          title="Read aloud"
        >
          <Volume2 size={15} />
          <span className="hidden sm:inline">Read to me</span>
        </button>
      );
    }

    return (
      <div className="flex items-center gap-1">
        <button
          onClick={(e) => {
            e.stopPropagation();
            togglePlayPause();
          }}
          className="w-9 h-9 rounded-full bg-white/15 backdrop-blur-md flex items-center justify-center text-white/90 hover:bg-white/25 transition"
        >
          {audioState === "loading" ? (
            <Loader2 size={15} className="animate-spin" />
          ) : audioState === "playing" ? (
            <Pause size={15} />
          ) : (
            <Play size={15} />
          )}
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleAudioOff();
          }}
          className="w-9 h-9 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center text-white/50 hover:bg-white/20 transition"
          title="Turn off narration"
        >
          <VolumeX size={14} />
        </button>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 bg-[#1a1520] select-none overflow-hidden"
      onClick={showControlsBriefly}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <link
        href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,600;0,700;1,400&display=swap"
        rel="stylesheet"
      />

      {/* ─── Illustration (full screen) ─── */}
      <div key={currentPage} className="absolute inset-0 animate-in fade-in duration-400">
        {page?.imageUrl ? (
          <>
            <img
              src={page.imageUrl}
              alt={isCover ? story.title : `Page ${page.spreadIndex}`}
              className="absolute inset-0 w-full h-full object-contain"
              draggable={false}
            />
            {/* Subtle vignette */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  "radial-gradient(ellipse at center, transparent 65%, rgba(26,21,32,0.35) 100%)",
              }}
            />
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-white/30 text-sm">No illustration</p>
          </div>
        )}

        {/* Cover prompt */}
        {isCover && (
          <div className="absolute bottom-0 left-0 right-0 p-8 text-center bg-gradient-to-t from-[#1a1520] via-[#1a1520]/70 to-transparent">
            <p className="text-sm" style={{ color: "#a898b8" }}>
              Tap or swipe to begin
            </p>
          </div>
        )}
      </div>

      {/* ─── Controls ─── */}
      <div
        className={`absolute inset-0 pointer-events-none z-20 transition-opacity duration-500 ${
          showControls ? "opacity-100" : "opacity-0"
        }`}
      >
        {/* Top bar */}
        <div className="pointer-events-auto absolute top-0 left-0 right-0 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/50 to-transparent">
          <button
            onClick={() => router.push(`/stories/${story.id}/book`)}
            className="w-9 h-9 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center text-white/80 hover:bg-white/20 transition"
          >
            <X size={18} />
          </button>

          <div className="flex items-center gap-2">
            <AudioButton />
            <button
              onClick={toggleFullscreen}
              className="w-9 h-9 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center text-white/80 hover:bg-white/20 transition"
            >
              {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
            </button>
          </div>
        </div>

        {/* Side arrows (desktop) */}
        {currentPage > 0 && (
          <button
            onClick={goPrev}
            className="pointer-events-auto absolute left-3 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 backdrop-blur-md items-center justify-center text-white/70 hover:bg-white/20 transition hidden sm:flex"
          >
            <ChevronLeft size={24} />
          </button>
        )}
        {currentPage < totalPages - 1 && (
          <button
            onClick={goNext}
            className="pointer-events-auto absolute right-3 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 backdrop-blur-md items-center justify-center text-white/70 hover:bg-white/20 transition hidden sm:flex"
          >
            <ChevronRight size={24} />
          </button>
        )}

        {/* Bottom — progress dots */}
        <div className="pointer-events-auto absolute bottom-0 left-0 right-0 flex items-center justify-center px-4 py-4 bg-gradient-to-t from-black/40 to-transparent">
          <div className="flex items-center gap-1.5">
            {pages.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentPage(i)}
                className="transition-all duration-300"
                style={{
                  width: i === currentPage ? 20 : 6,
                  height: 6,
                  borderRadius: 3,
                  background:
                    i === currentPage
                      ? "#e8e0f0"
                      : i < currentPage
                      ? "rgba(232,224,240,0.4)"
                      : "rgba(232,224,240,0.15)",
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* ─── Audio playing indicator (always visible when audio active) ─── */}
      {audioEnabled && audioState === "playing" && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/40 backdrop-blur-md">
            <div className="flex items-end gap-[2px] h-3">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="w-[3px] bg-green-400 rounded-full"
                  style={{
                    animation: `audioBar 0.8s ease-in-out ${i * 0.15}s infinite alternate`,
                  }}
                />
              ))}
            </div>
            <span className="text-[11px] text-white/70 font-medium">
              Reading aloud
            </span>
          </div>
        </div>
      )}

      <style>{`
        @keyframes audioBar {
          0% { height: 4px; }
          100% { height: 12px; }
        }
      `}</style>

      {/* ─── Last page: The End ─── */}
      {currentPage === totalPages - 1 && !isCover && (
        <div className="absolute inset-0 flex items-end justify-center z-10 pb-20 pointer-events-none">
          <div className="pointer-events-auto text-center px-8 py-6 rounded-2xl bg-black/40 backdrop-blur-md">
            <p className="text-3xl mb-3">✨</p>
            <h2 className="text-lg font-bold mb-1" style={{ color: "#f0e8f8" }}>
              The End
            </h2>
            <p className="text-xs mb-5" style={{ color: "#a898b8" }}>
              We hope you enjoyed reading together
            </p>
            <div className="flex gap-2.5 justify-center">
              <button
                onClick={() => setCurrentPage(0)}
                className="px-5 py-2 rounded-xl text-[13px] font-semibold transition"
                style={{
                  background: "rgba(255,255,255,0.12)",
                  color: "#e8e0f0",
                  border: "1px solid rgba(255,255,255,0.15)",
                }}
              >
                Read Again
              </button>
              <button
                onClick={() => router.push(`/stories/${story.id}/book`)}
                className="px-5 py-2 rounded-xl text-[13px] font-semibold transition"
                style={{
                  background: "linear-gradient(135deg, #10b981, #059669)",
                  color: "white",
                }}
              >
                Back to Book
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}