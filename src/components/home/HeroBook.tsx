// src/components/home/HeroBook.tsx
"use client";

// The hero's open book. It turns to a different real FlipWhizz book every few
// seconds with a 3D page turn, and pauses while someone is looking at it
// (hover or keyboard focus). Under reduced motion it stays on the first book.

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { HERO_BOOKS } from "@/content/homeBooks";

const TURN_MS = 950;
const STAY_MS = 5200;

export default function HeroBook() {
  const [cur, setCur] = useState(0);
  const [next, setNext] = useState(0);
  const [turning, setTurning] = useState(false);
  const [peek, setPeek] = useState(false);
  const paused = useRef(false);
  const curRef = useRef(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // Warm the browser cache so a turn never shows a half-loaded page.
    HERO_BOOKS.forEach((b) => { const img = new window.Image(); img.src = b.src; });
    let turnTimer: ReturnType<typeof setTimeout> | undefined;
    const tick = setInterval(() => {
      if (paused.current || document.hidden) return;
      const n = (curRef.current + 1) % HERO_BOOKS.length;
      setNext(n);
      setTurning(true);
      turnTimer = setTimeout(() => {
        curRef.current = n;
        setCur(n);
        setTurning(false);
      }, TURN_MS);
    }, STAY_MS);
    return () => {
      clearInterval(tick);
      if (turnTimer) clearTimeout(turnTimer);
    };
  }, []);

  const current = HERO_BOOKS[cur];
  const upcoming = HERO_BOOKS[next];
  // While turning, the page underneath already shows the next book's right
  // half, and the turning leaf carries current-right on its front and
  // next-left on its back.
  const baseLeft = current.src;
  const baseRight = turning ? upcoming.src : current.src;

  return (
    <figure
      className="relative m-0"
      onMouseEnter={() => { paused.current = true; setPeek(true); }}
      onMouseLeave={() => { paused.current = false; setPeek(false); }}
      onFocus={() => { paused.current = true; }}
      onBlur={() => { paused.current = false; }}
    >
      {/* Ribbon colours sampled directly from Flipwhizz_logo_NEW.png. */}
      <svg
        aria-hidden="true"
        focusable="false"
        viewBox="0 0 600 600"
        className="pointer-events-none absolute -right-[6%] -top-[12%] aspect-square w-[78%] opacity-60"
      >
        <path d="M 300 300 C 225.44 406.49 63.35 236.59 151.00 41.92 A 298 298 0 0 1 377.13 12.15 C 177.50 87.82 171.97 322.57 300 300 Z" fill="#F3807B" />
        <path d="M 300 300 C 171.97 322.57 177.50 87.82 377.13 12.15 A 298 298 0 0 1 558.08 151.00 C 363.41 63.35 193.51 225.44 300 300 Z" fill="#F18B5A" />
        <path d="M 300 300 C 193.51 225.44 363.41 63.35 558.08 151.00 A 298 298 0 0 1 587.85 377.13 C 512.18 177.50 277.43 171.97 300 300 Z" fill="#FAD15D" />
        <path d="M 300 300 C 277.43 171.97 512.18 177.50 587.85 377.13 A 298 298 0 0 1 449.00 558.08 C 536.65 363.41 374.56 193.51 300 300 Z" fill="#BCD570" />
        <path d="M 300 300 C 374.56 193.51 536.65 363.41 449.00 558.08 A 298 298 0 0 1 222.87 587.85 C 422.50 512.18 428.03 277.43 300 300 Z" fill="#7AD3C1" />
        <path d="M 300 300 C 428.03 277.43 422.50 512.18 222.87 587.85 A 298 298 0 0 1 41.92 449.00 C 236.59 536.65 406.49 374.56 300 300 Z" fill="#83AAD3" />
        <path d="M 300 300 C 406.49 374.56 236.59 536.65 41.92 449.00 A 298 298 0 0 1 12.15 222.87 C 87.82 422.50 322.57 428.03 300 300 Z" fill="#9693CC" />
        <path d="M 300 300 C 322.57 428.03 87.82 422.50 12.15 222.87 A 298 298 0 0 1 151.00 41.92 C 63.35 236.59 225.44 406.49 300 300 Z" fill="#C878BF" />
      </svg>

      <div className={`relative z-[2] ml-auto max-w-[640px] rotate-[-1.5deg] ${peek ? "fw-peek" : ""}`}>
        <div aria-hidden="true" className="absolute inset-x-[1%] -bottom-[10px] top-[10px] rounded-[14px] bg-[#EFE7F5]" />
        <div aria-hidden="true" className="absolute inset-x-[0.5%] -bottom-[5px] top-[5px] rounded-[14px] bg-[#F7F2FA]" />

        <div
          role="img"
          aria-label={`An open FlipWhizz book: ${current.alt}`}
          className="relative grid aspect-[1600/893] grid-cols-2 rounded-[12px] shadow-[0_30px_60px_-20px_rgba(36,24,47,0.35)]"
        >
          <Half src={baseLeft} side="left" priority />
          <div className="fw-page-r relative overflow-hidden rounded-r-[12px]">
            <HalfImg src={baseRight} side="right" priority />
          </div>
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-[12px]" style={{ background: "linear-gradient(90deg, rgba(0,0,0,0) 44%, rgba(36,24,47,.16) 50%, rgba(0,0,0,0) 56%)" }} />

          {turning && (
            <div className="fw-leaf absolute bottom-0 left-1/2 top-0 z-[3] w-1/2" aria-hidden="true">
              <div className="fw-face rounded-r-[12px]">
                <HalfImg src={current.src} side="right" />
                <div className="fw-shade absolute inset-0" style={{ background: "linear-gradient(90deg, rgba(36,24,47,.5), rgba(36,24,47,0))" }} />
              </div>
              <div className="fw-face fw-face-back rounded-l-[12px]">
                <HalfImg src={upcoming.src} side="left" />
              </div>
            </div>
          )}
        </div>
      </div>

      <figcaption className="relative z-[2] mt-5 flex flex-wrap items-center justify-end gap-x-2 text-right text-[14px] text-[#6A5E73] sm:text-[15px]">
        <span className="font-semibold text-[#24182F]">{current.title}</span>
        <span aria-hidden="true">·</span>
        <span>a real FlipWhizz book</span>
      </figcaption>
    </figure>
  );
}

function Half({ src, side, priority }: { src: string; side: "left" | "right"; priority?: boolean }) {
  return (
    <div className={`relative overflow-hidden ${side === "left" ? "rounded-l-[12px]" : "rounded-r-[12px]"}`}>
      <HalfImg src={src} side={side} priority={priority} />
    </div>
  );
}

// Each page shows one half of the full spread image.
function HalfImg({ src, side, priority }: { src: string; side: "left" | "right"; priority?: boolean }) {
  return (
    <Image
      src={src}
      alt=""
      width={1600}
      height={893}
      priority={priority}
      unoptimized
      className="absolute top-0 h-full w-[200%] max-w-none object-cover"
      style={{ left: side === "left" ? 0 : "-100%" }}
    />
  );
}
