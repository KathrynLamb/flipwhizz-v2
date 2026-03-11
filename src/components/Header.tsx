"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";

export default function Header({ session }: { session: any }) {
  const [isOpen, setIsOpen] = useState(false);

  const handleSignOut = async () => {
    setIsOpen(false);
    await signOut({ callbackUrl: "/" });
  };

  const navLinks = [
    { href: "#how-it-works", label: "How It Works" },
    { href: "#gallery", label: "Gallery" },
    { href: "/blog", label: "Blog" },
    { href: "#pricing", label: "Pricing" },
  ];

  return (
    <header className="relative z-50 w-full">
      {/* ── Desktop bar ── */}
      <div className="hidden md:flex items-center justify-between px-12 py-4 bg-white/80 backdrop-blur-xl border-b border-[#8B5A83]/10">
        <Logo />

        <nav className="flex items-center gap-10">
          {navLinks.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="relative group text-[#6B5D52] text-sm tracking-widest uppercase font-medium hover:text-[#8B5A83] transition-colors duration-300"
            >
              {label}
              <span className="absolute -bottom-0.5 left-0 w-0 h-px bg-[#8B5A83]/50 group-hover:w-full transition-all duration-300" />
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          {!session ? (
            <Link
              href="/api/auth/signin"
              className="px-6 py-2.5 rounded-full text-sm font-semibold text-[#6B5D52] border border-[#6B5D52]/20 hover:border-[#8B5A83]/40 hover:text-[#8B5A83] transition-all duration-300 tracking-wide"
            >
              Sign In
            </Link>
          ) : (
            <>
              <Link
                href="/projects"
                className="px-6 py-2.5 rounded-full text-sm font-bold text-white tracking-wide transition-all duration-300 hover:scale-105 bg-[#8B5A83] hover:bg-[#7A4E73] shadow-md hover:shadow-lg"
              >
                ✦ My Library
              </Link>
              <button
                onClick={handleSignOut}
                className="px-5 py-2.5 rounded-full text-sm font-medium text-[#6B5D52]/60 hover:text-[#6B5D52] transition-all duration-300 tracking-wide"
              >
                Sign Out
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Mobile bar ── */}
      <div className="md:hidden flex items-center justify-between px-6 py-4 bg-white/80 backdrop-blur-xl border-b border-[#8B5A83]/10">
        <Logo />

        <button
          onClick={() => setIsOpen(!isOpen)}
          aria-label="Toggle menu"
          className="relative z-50 w-10 h-10 flex flex-col items-center justify-center gap-[5px]"
        >
          <motion.span
            animate={isOpen ? { rotate: 45, y: 7 } : { rotate: 0, y: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="block w-6 h-[1.5px] bg-[#261C15] origin-center"
          />
          <motion.span
            animate={isOpen ? { opacity: 0, scaleX: 0 } : { opacity: 1, scaleX: 1 }}
            transition={{ duration: 0.2 }}
            className="block w-6 h-[1.5px] bg-[#261C15]"
          />
          <motion.span
            animate={isOpen ? { rotate: -45, y: -7 } : { rotate: 0, y: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="block w-6 h-[1.5px] bg-[#261C15] origin-center"
          />
        </button>
      </div>

      {/* ── Mobile overlay ── */}
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              key="scrim"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35 }}
              className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
              onClick={() => setIsOpen(false)}
            />

            <motion.div
              key="panel"
              initial={{ opacity: 0, clipPath: "circle(0% at calc(100% - 48px) 48px)" }}
              animate={{ opacity: 1, clipPath: "circle(160% at calc(100% - 48px) 48px)" }}
              exit={{ opacity: 0, clipPath: "circle(0% at calc(100% - 48px) 48px)" }}
              transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
              className="fixed inset-0 z-40 flex flex-col overflow-hidden bg-[#FDF8F0]"
            >
              <div
                className="absolute top-0 right-0 w-72 h-72 pointer-events-none"
                style={{
                  background: "radial-gradient(circle at top right, rgba(139,90,131,0.08) 0%, transparent 65%)",
                }}
              />

              <div className="relative z-10 flex items-center justify-between px-6 py-5">
                <Logo />
                <button
                  onClick={() => setIsOpen(false)}
                  className="w-10 h-10 flex items-center justify-center rounded-full border border-[#8B5A83]/20 text-[#6B5D52] hover:text-[#8B5A83] hover:border-[#8B5A83]/40 transition-all"
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M1 1L13 13M13 1L1 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </button>
              </div>

              <div className="mx-6 h-px bg-[#8B5A83]/10" />

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
                      className="group flex items-center justify-between py-5 border-b border-[#8B5A83]/10"
                    >
                      <span className="font-serif text-3xl font-bold tracking-tight text-[#261C15]/70 group-hover:text-[#8B5A83] transition-colors duration-300">
                        {label}
                      </span>
                      <motion.span
                        className="text-xl text-[#8B5A83] opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                        whileHover={{ x: 4 }}
                      >
                        →
                      </motion.span>
                    </Link>
                  </motion.div>
                ))}
              </nav>

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
                    className="w-full py-4 rounded-2xl text-center text-base font-semibold text-[#6B5D52] border border-[#6B5D52]/20 hover:border-[#8B5A83]/40 transition-all tracking-wide"
                  >
                    Sign In
                  </Link>
                ) : (
                  <>
                    <Link
                      href="/projects"
                      onClick={() => setIsOpen(false)}
                      className="w-full py-4 rounded-2xl text-center text-base font-bold text-white tracking-wide transition-all hover:scale-[1.02] active:scale-[0.98] bg-[#8B5A83] hover:bg-[#7A4E73] shadow-lg"
                    >
                      ✦ My Library
                    </Link>
                    <button
                      onClick={handleSignOut}
                      className="w-full py-4 rounded-2xl text-center text-base font-medium text-[#6B5D52]/50 hover:text-[#6B5D52] transition-all tracking-wide"
                    >
                      Sign Out
                    </button>
                  </>
                )}
                <p className="text-center text-xs mt-2 font-serif italic tracking-wide text-[#8B5A83]/40">
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
    <Link href="/" className="flex items-center group">
      <Image
        src="/Flipwhizz_logo.png"
        alt="FlipWhizz"
        width={84}
        height={84}
        className="transition-transform duration-300 group-hover:rotate-6"
      />
      <span className="font-serif text-2xl font-bold tracking-wide text-[#8B5A83]">
        FlipWhizz
      </span>
    </Link>
  );
}