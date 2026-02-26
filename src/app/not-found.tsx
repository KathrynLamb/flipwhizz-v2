// src/app/not-found.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { BookOpen, Home, Sparkles } from "lucide-react";

/* -------------------------------------------------------------------------- */
/*  FONT                                                                       */
/* -------------------------------------------------------------------------- */

function FontLoader() {
  return (
    // eslint-disable-next-line @next/next/no-page-custom-font
    <link
      href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,300;12..96,400;12..96,600;12..96,700;12..96,800&family=Lora:ital,wght@0,400;0,500;0,600;1,400;1,500&display=swap"
      rel="stylesheet"
    />
  );
}

/* -------------------------------------------------------------------------- */
/*  FLOATING PAGES                                                             */
/* -------------------------------------------------------------------------- */

const PAGES = [
  { x: "8%", y: "15%", rotate: -18, delay: 0, size: 52 },
  { x: "82%", y: "12%", rotate: 12, delay: 0.4, size: 44 },
  { x: "15%", y: "72%", rotate: -8, delay: 0.8, size: 38 },
  { x: "78%", y: "68%", rotate: 22, delay: 1.2, size: 48 },
  { x: "45%", y: "82%", rotate: -14, delay: 0.6, size: 36 },
  { x: "90%", y: "40%", rotate: 6, delay: 1.0, size: 40 },
  { x: "5%", y: "45%", rotate: -24, delay: 0.2, size: 42 },
];

function FloatingPage({
  x,
  y,
  rotate,
  delay,
  size,
}: {
  x: string;
  y: string;
  rotate: number;
  delay: number;
  size: number;
}) {
  return (
    <motion.div
      className="absolute pointer-events-none select-none"
      style={{ left: x, top: y }}
      initial={{ opacity: 0, scale: 0.6, rotate: rotate - 10 }}
      animate={{
        opacity: [0, 0.35, 0.25],
        scale: [0.6, 1, 1],
        rotate: [rotate - 10, rotate, rotate + 3],
        y: [0, -12, 0],
      }}
      transition={{
        duration: 6,
        delay,
        repeat: Infinity,
        repeatType: "reverse",
        ease: "easeInOut",
      }}
    >
      {/* Stylised book page */}
      <svg
        width={size}
        height={size * 1.35}
        viewBox="0 0 52 70"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Page body */}
        <rect
          x="2"
          y="2"
          width="48"
          height="66"
          rx="4"
          fill="white"
          stroke="#D4C6E6"
          strokeWidth="1.5"
        />
        {/* Fold corner */}
        <path d="M36 2 L50 16 L36 16 Z" fill="#F3EDFC" stroke="#D4C6E6" strokeWidth="1" />
        {/* Text lines */}
        <rect x="10" y="24" width="28" height="2.5" rx="1.25" fill="#E8DEFA" />
        <rect x="10" y="31" width="22" height="2.5" rx="1.25" fill="#E8DEFA" />
        <rect x="10" y="38" width="26" height="2.5" rx="1.25" fill="#E8DEFA" />
        <rect x="10" y="45" width="18" height="2.5" rx="1.25" fill="#E8DEFA" />
        <rect x="10" y="52" width="24" height="2.5" rx="1.25" fill="#E8DEFA" />
      </svg>
    </motion.div>
  );
}

/* -------------------------------------------------------------------------- */
/*  LOST CHARACTER — a little owl with eyes that follow the cursor             */
/* -------------------------------------------------------------------------- */

function LostOwl({ mouseX, mouseY }: { mouseX: number; mouseY: number }) {
  const owlRef = useRef<SVGSVGElement>(null);
  const [eyeOffset, setEyeOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!owlRef.current) return;
    const rect = owlRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    const dx = mouseX - cx;
    const dy = mouseY - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const maxOffset = 4;
    const factor = Math.min(dist / 300, 1);

    setEyeOffset({
      x: (dx / (dist || 1)) * maxOffset * factor,
      y: (dy / (dist || 1)) * maxOffset * factor,
    });
  }, [mouseX, mouseY]);

  return (
    <motion.svg
      ref={owlRef}
      width="180"
      height="200"
      viewBox="0 0 180 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      initial={{ scale: 0.8, opacity: 0, y: 20 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      transition={{ delay: 0.3, type: "spring", stiffness: 120 }}
    >
      {/* Body */}
      <ellipse cx="90" cy="130" rx="60" ry="65" fill="#E8DEFA" />
      <ellipse cx="90" cy="130" rx="60" ry="65" fill="url(#owlGrad)" />

      {/* Belly */}
      <ellipse cx="90" cy="145" rx="35" ry="38" fill="#F5F0FF" />

      {/* Head */}
      <circle cx="90" cy="75" r="50" fill="#D9C8F0" />
      <circle cx="90" cy="75" r="50" fill="url(#headGrad)" />

      {/* Ear tufts */}
      <path d="M52 38 L42 10 L62 32 Z" fill="#C7A8E6" />
      <path d="M128 38 L138 10 L118 32 Z" fill="#C7A8E6" />

      {/* Eye whites */}
      <ellipse cx="70" cy="72" rx="20" ry="21" fill="white" />
      <ellipse cx="110" cy="72" rx="20" ry="21" fill="white" />

      {/* Eye rings */}
      <ellipse
        cx="70"
        cy="72"
        rx="20"
        ry="21"
        stroke="#B89FD4"
        strokeWidth="2"
        fill="none"
      />
      <ellipse
        cx="110"
        cy="72"
        rx="20"
        ry="21"
        stroke="#B89FD4"
        strokeWidth="2"
        fill="none"
      />

      {/* Pupils (follow mouse) */}
      <circle
        cx={70 + eyeOffset.x}
        cy={72 + eyeOffset.y}
        r="9"
        fill="#2D2235"
      />
      <circle
        cx={110 + eyeOffset.x}
        cy={72 + eyeOffset.y}
        r="9"
        fill="#2D2235"
      />

      {/* Eye sparkles */}
      <circle
        cx={66 + eyeOffset.x * 0.5}
        cy={68 + eyeOffset.y * 0.5}
        r="3"
        fill="white"
      />
      <circle
        cx={106 + eyeOffset.x * 0.5}
        cy={68 + eyeOffset.y * 0.5}
        r="3"
        fill="white"
      />

      {/* Beak */}
      <path
        d="M84 85 L90 96 L96 85 Z"
        fill="#E6A87C"
        stroke="#D4956A"
        strokeWidth="1"
      />

      {/* Blush */}
      <ellipse cx="55" cy="88" rx="8" ry="5" fill="#F5C6D0" opacity="0.5" />
      <ellipse cx="125" cy="88" rx="8" ry="5" fill="#F5C6D0" opacity="0.5" />

      {/* Feet */}
      <ellipse cx="72" cy="192" rx="14" ry="6" fill="#E6A87C" />
      <ellipse cx="108" cy="192" rx="14" ry="6" fill="#E6A87C" />

      {/* Wings (tucked) */}
      <path
        d="M30 110 Q20 140 35 165 Q45 150 40 125 Z"
        fill="#C7A8E6"
        opacity="0.7"
      />
      <path
        d="M150 110 Q160 140 145 165 Q135 150 140 125 Z"
        fill="#C7A8E6"
        opacity="0.7"
      />

      {/* Book the owl is holding */}
      <rect x="68" y="155" width="44" height="32" rx="3" fill="#B05CE6" />
      <rect x="71" y="158" width="38" height="26" rx="2" fill="#D45DA0" />
      <rect x="88" y="155" width="4" height="32" rx="1" fill="#9B3DC0" />
      {/* Book pages */}
      <rect x="74" y="161" width="12" height="2" rx="1" fill="white" opacity="0.6" />
      <rect x="74" y="166" width="10" height="2" rx="1" fill="white" opacity="0.6" />
      <rect x="74" y="171" width="8" height="2" rx="1" fill="white" opacity="0.4" />

      {/* Gradients */}
      <defs>
        <radialGradient id="owlGrad" cx="50%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#D9C8F0" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#E8DEFA" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="headGrad" cx="40%" cy="30%" r="60%">
          <stop offset="0%" stopColor="#E8DEFA" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#D9C8F0" stopOpacity="0" />
        </radialGradient>
      </defs>
    </motion.svg>
  );
}

/* -------------------------------------------------------------------------- */
/*  SPARKLE TRAIL (follows cursor lightly)                                     */
/* -------------------------------------------------------------------------- */

function SparkleTrail({ mouseX, mouseY }: { mouseX: number; mouseY: number }) {
  const [sparkles, setSparkles] = useState<
    { id: number; x: number; y: number }[]
  >([]);
  const idRef = useRef(0);
  const lastRef = useRef(0);

  useEffect(() => {
    const now = Date.now();
    if (now - lastRef.current < 120) return;
    lastRef.current = now;

    if (mouseX === 0 && mouseY === 0) return;

    const id = idRef.current++;
    setSparkles((s) => [...s.slice(-6), { id, x: mouseX, y: mouseY }]);

    const timeout = setTimeout(() => {
      setSparkles((s) => s.filter((sp) => sp.id !== id));
    }, 800);

    return () => clearTimeout(timeout);
  }, [mouseX, mouseY]);

  return (
    <div className="fixed inset-0 pointer-events-none z-50">
      {sparkles.map((sp) => (
        <motion.div
          key={sp.id}
          className="absolute"
          style={{ left: sp.x - 6, top: sp.y - 6 }}
          initial={{ opacity: 0.8, scale: 1 }}
          animate={{ opacity: 0, scale: 0.3, y: -20 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        >
          <Sparkles className="w-3 h-3" style={{ color: "#C77DFF" }} />
        </motion.div>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  404 PAGE                                                                   */
/* -------------------------------------------------------------------------- */

export default function NotFound() {
  const [mouse, setMouse] = useState({ x: 0, y: 0 });

  useEffect(() => {
    function handleMove(e: MouseEvent) {
      setMouse({ x: e.clientX, y: e.clientY });
    }
    window.addEventListener("mousemove", handleMove);
    return () => window.removeEventListener("mousemove", handleMove);
  }, []);

  return (
    <>
      <FontLoader />

      <div
        className="min-h-screen relative overflow-hidden flex items-center justify-center"
        style={{ fontFamily: "'Bricolage Grotesque', system-ui, sans-serif" }}
      >
        {/* ── Background ──────────────────────────────────────────────────── */}
        <div
          className="fixed inset-0 -z-10"
          style={{
            background: `
              radial-gradient(ellipse 80% 60% at 20% 10%, rgba(232,190,255,0.3) 0%, transparent 60%),
              radial-gradient(ellipse 70% 50% at 85% 80%, rgba(255,182,210,0.25) 0%, transparent 55%),
              radial-gradient(ellipse 50% 40% at 50% 50%, rgba(200,210,255,0.15) 0%, transparent 50%),
              #F9F5FF
            `,
          }}
        >
          <div
            className="absolute inset-0 opacity-50"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23c4b5d4' fill-opacity='0.04'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            }}
          />
        </div>

        {/* ── Floating pages ──────────────────────────────────────────────── */}
        {PAGES.map((p, i) => (
          <FloatingPage key={i} {...p} />
        ))}

        {/* ── Sparkle trail ───────────────────────────────────────────────── */}
        <SparkleTrail mouseX={mouse.x} mouseY={mouse.y} />

        {/* ── Content ─────────────────────────────────────────────────────── */}
        <div className="relative z-10 flex flex-col items-center text-center px-6 max-w-lg">
          {/* Owl character */}
          <LostOwl mouseX={mouse.x} mouseY={mouse.y} />

          {/* 404 number — whimsical */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5, type: "spring", stiffness: 100 }}
            className="mt-2 mb-4"
          >
            <span
              className="text-7xl sm:text-8xl font-extrabold tracking-tighter"
              style={{
                background: "linear-gradient(135deg, #B05CE6, #D45DA0, #E6A87C)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                letterSpacing: "-0.06em",
              }}
            >
              404
            </span>
          </motion.div>

          {/* Message */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
          >
            <h1
              className="text-2xl sm:text-3xl font-extrabold mb-3"
              style={{ color: "#2D2235", letterSpacing: "-0.03em" }}
            >
              This page wandered off
            </h1>
            <p
              className="text-sm sm:text-base leading-relaxed mb-8"
              style={{ color: "#7B6E90" }}
            >
              Looks like this page slipped out of the story. 
              Don't worry — every character finds their way home eventually.
            </p>
          </motion.div>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9 }}
            className="flex flex-col sm:flex-row items-center gap-3"
          >
            <Link
              href="/"
              className="inline-flex items-center gap-2.5 px-7 py-3.5 rounded-2xl text-sm font-bold text-white transition-all active:scale-[0.98] hover:shadow-lg"
              style={{
                background: "linear-gradient(135deg, #B05CE6, #D45DA0)",
                boxShadow: "0 4px 16px rgba(176,92,230,0.25)",
                fontFamily: "inherit",
              }}
            >
              <Home className="w-4 h-4" />
              Back to Home
            </Link>

            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2.5 px-7 py-3.5 rounded-2xl text-sm font-semibold transition-all active:scale-[0.98]"
              style={{
                color: "#6B5C80",
                background: "white",
                border: "1.5px solid rgba(180,150,210,0.2)",
                boxShadow: "0 2px 8px rgba(100,60,140,0.05)",
                fontFamily: "inherit",
              }}
            >
              <BookOpen className="w-4 h-4" />
              My Stories
            </Link>
          </motion.div>

          {/* Subtle footer */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2 }}
            className="mt-12 text-xs"
            style={{ color: "#C4B5D4" }}
          >
            FlipWhizz · Every story finds its way
          </motion.p>
        </div>
      </div>
    </>
  );
}