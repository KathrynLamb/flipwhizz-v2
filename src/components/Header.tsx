"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

export default function Header({ session }: { session: any }) {
  const [isOpen, setIsOpen] = useState(false);

  const handleSignOut = async () => {
    setIsOpen(false);
    await signOut({ callbackUrl: "/" });
  };

  const navLinks = [
    { href: "#how-it-works", label: "How It Works" },
    { href: "#gallery",      label: "Gallery"       },
    { href: "#pricing",      label: "Pricing"       },
  ];

  return (
    <header className="relative z-50 w-full">
      {/* ── Desktop bar ── */}
      <div className="hidden md:flex items-center justify-between px-12 py-7">
        <Logo />

        <nav className="flex items-center gap-10">
          {navLinks.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="relative group text-white/80 text-sm tracking-widest uppercase font-medium hover:text-white transition-colors duration-300"
            >
              {label}
              {/* Magenta→purple underline slide-in */}
              <span
                className="absolute -bottom-0.5 left-0 w-0 h-px group-hover:w-full transition-all duration-300"
                style={{ background: "linear-gradient(90deg, #E91E8C, #B05CE6)" }}
              />
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          {!session ? (
            <Link
              href="/api/auth/signin"
              className="px-6 py-2.5 rounded-full text-sm font-semibold text-white/80 border border-white/20 hover:border-white/50 hover:text-white transition-all duration-300 tracking-wide"
            >
              Sign In
            </Link>
          ) : (
            <>
              <Link
                href="/projects"
                className="px-6 py-2.5 rounded-full text-sm font-bold text-white tracking-wide shadow-lg transition-all duration-300 hover:scale-105"
                style={{
                  background: "linear-gradient(135deg, #E91E8C, #B05CE6)",
                  boxShadow: "0 4px 20px rgba(233,30,140,0.35)",
                }}
              >
                ✦ My Library
              </Link>
              <button
                onClick={handleSignOut}
                className="px-5 py-2.5 rounded-full text-sm font-medium text-white/50 border border-white/15 hover:border-white/35 hover:text-white/80 transition-all duration-300 tracking-wide"
              >
                Sign Out
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Mobile bar ── */}
      <div className="md:hidden flex items-center justify-between px-6 py-6">
        <Logo />

        {/* Animated hamburger → X */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          aria-label="Toggle menu"
          className="relative z-50 w-10 h-10 flex flex-col items-center justify-center gap-[5px]"
        >
          <motion.span
            animate={isOpen ? { rotate: 45, y: 7 } : { rotate: 0, y: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="block w-6 h-[1.5px] bg-white origin-center"
          />
          <motion.span
            animate={isOpen ? { opacity: 0, scaleX: 0 } : { opacity: 1, scaleX: 1 }}
            transition={{ duration: 0.2 }}
            className="block w-6 h-[1.5px] bg-white"
          />
          <motion.span
            animate={isOpen ? { rotate: -45, y: -7 } : { rotate: 0, y: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="block w-6 h-[1.5px] bg-white origin-center"
          />
        </button>
      </div>

      {/* ── Mobile overlay ── */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Scrim */}
            <motion.div
              key="scrim"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35 }}
              className="fixed inset-0 z-40"
              style={{ background: "rgba(20,8,40,0.6)", backdropFilter: "blur(8px)" }}
              onClick={() => setIsOpen(false)}
            />

            {/* Panel — circle reveal from hamburger corner */}
            <motion.div
              key="panel"
              initial={{ opacity: 0, clipPath: "circle(0% at calc(100% - 48px) 48px)" }}
              animate={{ opacity: 1, clipPath: "circle(160% at calc(100% - 48px) 48px)" }}
              exit={{ opacity: 0, clipPath: "circle(0% at calc(100% - 48px) 48px)" }}
              transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
              className="fixed inset-0 z-40 flex flex-col overflow-hidden"
              style={{
                background: "linear-gradient(160deg, #1A0533 0%, #200A3E 55%, #150828 100%)",
              }}
            >
              {/* Ambient glows */}
              <div
                className="absolute top-0 right-0 w-72 h-72 pointer-events-none"
                style={{ background: "radial-gradient(circle at top right, rgba(176,92,230,0.2) 0%, transparent 65%)" }}
              />
              <div
                className="absolute bottom-0 left-0 w-80 h-80 pointer-events-none"
                style={{ background: "radial-gradient(circle at bottom left, rgba(233,30,140,0.14) 0%, transparent 65%)" }}
              />

              {/* Top bar inside panel */}
              <div className="relative z-10 flex items-center justify-between px-6 py-6">
                <Logo />
                <button
                  onClick={() => setIsOpen(false)}
                  className="w-10 h-10 flex items-center justify-center rounded-full border border-white/15 text-white/50 hover:text-white hover:border-white/35 transition-all"
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M1 1L13 13M13 1L1 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </button>
              </div>

              {/* Purple gradient divider */}
              <div
                className="mx-6 h-px"
                style={{ background: "linear-gradient(90deg, transparent, rgba(176,92,230,0.35), transparent)" }}
              />

              {/* Nav links — large serif */}
              <nav className="flex-1 flex flex-col justify-center px-8">
                {navLinks.map(({ href, label }, i) => (
                  <motion.div
                    key={href}
                    initial={{ opacity: 0, x: -28 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.18 + i * 0.08, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <Link
                      href={href}
                      onClick={() => setIsOpen(false)}
                      className="group flex items-center justify-between py-5 border-b"
                      style={{ borderColor: "rgba(176,92,230,0.14)" }}
                    >
                      <span className="font-serif text-3xl font-bold tracking-tight text-white/70 group-hover:text-white transition-colors duration-300">
                        {label}
                      </span>
                      <motion.span
                        className="text-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                        style={{ color: "#E91E8C" }}
                        whileHover={{ x: 4 }}
                      >
                        →
                      </motion.span>
                    </Link>
                  </motion.div>
                ))}
              </nav>

              {/* Bottom CTA */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.42, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                className="relative z-10 px-8 pb-16 flex flex-col gap-3"
              >
                {!session ? (
                  <Link
                    href="/api/auth/signin"
                    onClick={() => setIsOpen(false)}
                    className="w-full py-4 rounded-2xl text-center text-base font-semibold text-white border border-white/20 hover:border-white/40 transition-all tracking-wide"
                  >
                    Sign In
                  </Link>
                ) : (
                  <>
                    <Link
                      href="/projects"
                      onClick={() => setIsOpen(false)}
                      className="w-full py-4 rounded-2xl text-center text-base font-bold text-white tracking-wide transition-all hover:scale-[1.02] active:scale-[0.98]"
                      style={{
                        background: "linear-gradient(135deg, #E91E8C, #B05CE6)",
                        boxShadow: "0 8px 32px rgba(233,30,140,0.35)",
                      }}
                    >
                      ✦ My Library
                    </Link>
                    <button
                      onClick={handleSignOut}
                      className="w-full py-4 rounded-2xl text-center text-base font-medium text-white/45 border border-white/10 hover:border-white/25 hover:text-white/70 transition-all tracking-wide"
                    >
                      Sign Out
                    </button>
                  </>
                )}

                <p
                  className="text-center text-xs mt-2 font-serif italic tracking-wide"
                  style={{ color: "rgba(176,92,230,0.4)" }}
                >
                  Stories made for magic. ✨
                </p>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </header>
  );
}

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5 group">
      <motion.span
        whileHover={{ rotate: 15 }}
        transition={{ type: "spring", stiffness: 300, damping: 15 }}
        className="text-2xl inline-block"
      >
        📖
      </motion.span>
      <span
        className="font-serif text-2xl font-bold tracking-wide text-white"
        style={{ textShadow: "0 0 28px rgba(176,92,230,0.5)" }}
      >
        FlipWhizz
      </span>
    </Link>
  );
}