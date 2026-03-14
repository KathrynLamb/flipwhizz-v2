"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";

/*
  Logo colour reference (left to right):
  F - coral/salmon   #F28B7B
  l - peach/orange    #F5A862
  i - warm yellow     #F5CE62
  p - mint green      #7DD4A8
  W - swirl gradient  (pink → orange → yellow → green → blue → purple)
  h - sky blue        #6DBCE0
  i - lavender        #A78BDA
  z - soft purple     #9B7DC9
  z - pink            #E88BAE
*/

const LOGO_COLORS = {
  coral: "#F28B7B",
  orange: "#F5A862",
  yellow: "#F5CE62",
  mint: "#7DD4A8",
  blue: "#6DBCE0",
  lavender: "#A78BDA",
  purple: "#9B7DC9",
  pink: "#E88BAE",
};

export default function Header({ session }: { session: any }) {
  const [isOpen, setIsOpen] = useState(false);

  const handleSignOut = async () => {
    setIsOpen(false);
    await signOut({ callbackUrl: "/" });
  };

  const navLinks = [
    { href: "#how-it-works", label: "How It Works", color: LOGO_COLORS.purple },
    { href: "#gallery", label: "Gallery", color: LOGO_COLORS.coral },
    { href: "/blog", label: "Blog", color: LOGO_COLORS.blue },
    { href: "#pricing", label: "Pricing", color: LOGO_COLORS.mint },
  ];

  return (
    <header className="relative z-50 w-full">
      {/* ── Desktop bar ── */}
      <div className="hidden md:flex items-center justify-between px-12 py-4 bg-white/95 backdrop-blur-xl border-b border-gray-100">
        <Logo />

        <nav className="flex items-center gap-9">
          {navLinks.map(({ href, label, color }) => (
            <Link
              key={href}
              href={href}
              className="relative group text-gray-500 text-sm font-semibold tracking-wide transition-colors duration-300"
              style={{ ["--hover-color" as any]: color }}
              onMouseEnter={(e) => (e.currentTarget.style.color = color)}
              onMouseLeave={(e) => (e.currentTarget.style.color = "")}
            >
              {label}
              <span
                className="absolute -bottom-0.5 left-0 w-0 h-[2px] rounded-full group-hover:w-full transition-all duration-300"
                style={{ background: `linear-gradient(90deg, ${LOGO_COLORS.coral}, ${LOGO_COLORS.orange}, ${LOGO_COLORS.yellow}, ${LOGO_COLORS.mint})` }}
              />
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          {!session ? (
            <Link
              href="/api/auth/signin"
              className="px-6 py-2.5 rounded-full text-sm font-semibold text-gray-500 border-2 border-gray-200 hover:border-transparent hover:text-white transition-all duration-300"
              style={{
                backgroundOrigin: "border-box",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = `linear-gradient(135deg, ${LOGO_COLORS.coral}, ${LOGO_COLORS.pink}, ${LOGO_COLORS.purple})`;
                e.currentTarget.style.borderColor = "transparent";
                e.currentTarget.style.color = "white";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "";
                e.currentTarget.style.borderColor = "";
                e.currentTarget.style.color = "";
              }}
            >
              Sign In
            </Link>
          ) : (
            <>
              <Link
                href="/projects"
                className="px-6 py-2.5 rounded-full text-sm font-bold text-white tracking-wide transition-all duration-300 hover:scale-105 hover:shadow-lg"
                style={{
                  background: `linear-gradient(135deg, ${LOGO_COLORS.coral}, ${LOGO_COLORS.pink}, ${LOGO_COLORS.purple})`,
                  boxShadow: `0 3px 14px ${LOGO_COLORS.pink}40`,
                }}
              >
                ✦ My Library
              </Link>
              <button
                onClick={handleSignOut}
                className="px-5 py-2.5 rounded-full text-sm font-medium text-gray-400 hover:text-gray-600 transition-all duration-300"
              >
                Sign Out
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Mobile bar ── */}
      <div className="md:hidden flex items-center justify-between px-6 py-4 bg-white/95 backdrop-blur-xl border-b border-gray-100">
        <Logo />

        <button
          onClick={() => setIsOpen(!isOpen)}
          aria-label="Toggle menu"
          className="relative z-50 w-10 h-10 flex flex-col items-center justify-center gap-[5px]"
        >
          <motion.span
            animate={isOpen ? { rotate: 45, y: 7 } : { rotate: 0, y: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="block w-6 h-[2px] origin-center"
            style={{ background: LOGO_COLORS.purple }}
          />
          <motion.span
            animate={isOpen ? { opacity: 0, scaleX: 0 } : { opacity: 1, scaleX: 1 }}
            transition={{ duration: 0.2 }}
            className="block w-6 h-[2px]"
            style={{ background: LOGO_COLORS.pink }}
          />
          <motion.span
            animate={isOpen ? { rotate: -45, y: -7 } : { rotate: 0, y: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="block w-6 h-[2px] origin-center"
            style={{ background: LOGO_COLORS.coral }}
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
              className="fixed inset-0 z-40 bg-black/15 backdrop-blur-sm"
              onClick={() => setIsOpen(false)}
            />

            <motion.div
              key="panel"
              initial={{ opacity: 0, clipPath: "circle(0% at calc(100% - 48px) 48px)" }}
              animate={{ opacity: 1, clipPath: "circle(160% at calc(100% - 48px) 48px)" }}
              exit={{ opacity: 0, clipPath: "circle(0% at calc(100% - 48px) 48px)" }}
              transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
              className="fixed inset-0 z-40 flex flex-col overflow-hidden bg-white"
            >
              {/* Decorative gradient blobs */}
              <div
                className="absolute top-0 right-0 w-80 h-80 pointer-events-none opacity-30"
                style={{
                  background: `radial-gradient(circle at top right, ${LOGO_COLORS.pink}40, transparent 60%)`,
                }}
              />
              <div
                className="absolute bottom-0 left-0 w-64 h-64 pointer-events-none opacity-20"
                style={{
                  background: `radial-gradient(circle at bottom left, ${LOGO_COLORS.mint}50, transparent 60%)`,
                }}
              />

              <div className="relative z-10 flex items-center justify-between px-6 py-2">
                <Logo />
                <button
                  onClick={() => setIsOpen(false)}
                  className="w-10 h-10 flex items-center justify-center rounded-full border-2 transition-all"
                  style={{ borderColor: `${LOGO_COLORS.pink}30`, color: LOGO_COLORS.purple }}
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M1 1L13 13M13 1L1 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </button>
              </div>

              <div
                className="mx-6 h-[2px] rounded-full"
                style={{
                  background: `linear-gradient(90deg, ${LOGO_COLORS.coral}, ${LOGO_COLORS.orange}, ${LOGO_COLORS.yellow}, ${LOGO_COLORS.mint}, ${LOGO_COLORS.blue}, ${LOGO_COLORS.lavender})`,
                  opacity: 0.3,
                }}
              />

              <nav className="flex-1 flex flex-col justify-center px-8">
                {navLinks.map(({ href, label, color }, i) => (
                  <motion.div
                    key={href}
                    initial={{ opacity: 0, x: -28 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.18 + i * 0.08, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <Link
                      href={href}
                      onClick={() => setIsOpen(false)}
                      className="group flex items-center justify-between py-5 border-b border-gray-100"
                    >
                      <span
                        className="font-serif text-3xl font-bold tracking-tight text-gray-300 group-hover:text-current transition-colors duration-300"
                        style={{ ["--tw-text-opacity" as any]: 1 }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = color)}
                        onMouseLeave={(e) => (e.currentTarget.style.color = "")}
                      >
                        {label}
                      </span>
                      <motion.span
                        className="text-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                        style={{ color }}
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
                    className="w-full py-4 rounded-2xl text-center text-base font-semibold text-gray-500 border-2 border-gray-200 transition-all"
                  >
                    Sign In
                  </Link>
                ) : (
                  <>
                    <Link
                      href="/projects"
                      onClick={() => setIsOpen(false)}
                      className="w-full py-4 rounded-2xl text-center text-base font-bold text-white tracking-wide transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg"
                      style={{
                        background: `linear-gradient(135deg, ${LOGO_COLORS.coral}, ${LOGO_COLORS.pink}, ${LOGO_COLORS.purple})`,
                        boxShadow: `0 4px 20px ${LOGO_COLORS.pink}35`,
                      }}
                    >
                      ✦ My Library
                    </Link>
                    <button
                      onClick={handleSignOut}
                      className="w-full py-4 rounded-2xl text-center text-base font-medium text-gray-400 hover:text-gray-600 transition-all"
                    >
                      Sign Out
                    </button>
                  </>
                )}
                <p
                  className="text-center text-xs mt-2 font-serif italic tracking-wide"
                  style={{ color: `${LOGO_COLORS.lavender}80` }}
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
    <Link href="/" className="flex items-center group">
      <Image
        src="/Flipwhizz_logo_NEW.png"
        alt="FlipWhizz"
        width={180}
        height={180}
        className="transition-transform duration-300 group-hover:rotate-3"
      />
    </Link>
  );
}