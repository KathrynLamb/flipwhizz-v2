"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";

const PINK = "#D94590";

// Rainbow colours sampled from the FlipWhizz logo
const NAV_COLORS = ["#E8457A", "#F5A623", "#7BC67E", "#5EAED4"];

// `minimal` strips the nav links and keeps only the logo + a quiet auth
// action. Used on conversion pages (e.g. /projects/create) where every extra
// link is an exit from the flow.
// `title`/`subtitle` render a compact heading inside the bar (desktop: centred
// between logo and auth; mobile: a tidy line beneath the logo row). Used on
// conversion pages so the page hero lives in the header and the chat gets more
// room. Most pages pass neither and are unaffected.
export default function Header({
  session,
  minimal = false,
  title,
  subtitle,
}: {
  session: any;
  minimal?: boolean;
  title?: string;
  subtitle?: string;
}) {
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
      {/* Desktop */}
      <div className="relative hidden lg:flex items-center justify-between px-12 py-1 bg-white/95 backdrop-blur-xl border-b border-gray-100">
        <Logo />

        {title && (
          <div className="pointer-events-none absolute left-1/2 top-1/2 max-w-[50vw] -translate-x-1/2 -translate-y-1/2 text-center">
            <p
              className="truncate text-[32px] font-black tracking-tighter"
              style={{
                backgroundImage:
                  "linear-gradient(90deg, #F2546A, #F7A93E, #8AC7E0, #A270C9)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              {title}
            </p>
            {/* {subtitle && (
              <p className="mt-0.5 truncate text-[12px] font-medium text-slate-400">
                {subtitle}
              </p>
            )} */}
          </div>
        )}

        {!minimal && (
          <nav className="flex items-center gap-9">
            {navLinks.map(({ href, label }, i) => (
              <Link
                key={href}
                href={href}
                className="relative group text-sm font-semibold tracking-wide transition-colors duration-300"
                style={{ color: NAV_COLORS[i] }}
              >
                <span className="group-hover:opacity-80 transition-opacity duration-300">
                  {label}
                </span>
                <span
                  className="absolute -bottom-0.5 left-0 w-0 h-[2px] rounded-full group-hover:w-full transition-all duration-300"
                  style={{ background: NAV_COLORS[i] }}
                />
              </Link>
            ))}
          </nav>
        )}

        <div className="flex items-center gap-3">
          {!session ? (
            <SignInButton />
          ) : (
            <>
              <Link
                href="/projects"
                className="px-6 py-2.5 rounded-full text-sm font-bold text-white tracking-wide transition-all duration-300 hover:scale-105 hover:shadow-lg"
                style={{ background: PINK, boxShadow: `0 3px 14px ${PINK}40` }}
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

      {/* Mobile */}
      <div className="lg:hidden bg-white/95 backdrop-blur-xl border-b border-gray-100">
        <div className="flex items-center justify-between px-6 py-4">
          <Logo />

          {minimal ? (
            /* On conversion pages, skip the hamburger entirely, just a quiet
               auth action, so there's no menu of exits. */
            !session ? (
              <SignInButton />
            ) : (
              <Link
                href="/projects"
                className="px-5 py-2 rounded-full text-sm font-bold text-white tracking-wide"
                style={{ background: PINK, boxShadow: `0 3px 14px ${PINK}40` }}
              >
                ✦ My Library
              </Link>
            )
          ) : (
            <button
              onClick={() => setIsOpen(!isOpen)}
              aria-label="Toggle menu"
              className="relative z-50 w-10 h-10 flex flex-col items-center justify-center gap-[5px]"
            >
              <motion.span animate={isOpen ? { rotate: 45, y: 7 } : { rotate: 0, y: 0 }} transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }} className="block w-6 h-[2px] bg-gray-700 origin-center" />
              <motion.span animate={isOpen ? { opacity: 0, scaleX: 0 } : { opacity: 1, scaleX: 1 }} transition={{ duration: 0.2 }} className="block w-6 h-[2px] bg-gray-700" />
              <motion.span animate={isOpen ? { rotate: -45, y: -7 } : { rotate: 0, y: 0 }} transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }} className="block w-6 h-[2px] bg-gray-700 origin-center" />
            </button>
          )}
        </div>

        {title && (
          <div className="px-5 pb-3 -mt-1 text-center">
            <p
              className="text-[19px] font-black leading-tight tracking-tighter"
              style={{
                backgroundImage:
                  "linear-gradient(90deg, #F2546A, #F7A93E, #8AC7E0, #A270C9)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              {title}
            </p>
            {subtitle && (
              <p className="mt-0.5 text-[11px] font-medium text-slate-400">
                {subtitle}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Mobile overlay, only when not minimal */}
      <AnimatePresence>
        {!minimal && isOpen && (
          <>
            <motion.div key="scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }} className="fixed inset-0 z-40 bg-black/15 backdrop-blur-sm" onClick={() => setIsOpen(false)} />
            <motion.div
              key="panel"
              initial={{ opacity: 0, clipPath: "circle(0% at calc(100% - 48px) 48px)" }}
              animate={{ opacity: 1, clipPath: "circle(160% at calc(100% - 48px) 48px)" }}
              exit={{ opacity: 0, clipPath: "circle(0% at calc(100% - 48px) 48px)" }}
              transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
              className="fixed inset-0 z-40 flex flex-col overflow-hidden bg-white"
            >
              <div className="relative z-10 flex items-center justify-between px-6 py-2">
                <Logo />
                <button onClick={() => setIsOpen(false)} className="w-10 h-10 flex items-center justify-center rounded-full border border-gray-200 text-gray-500 hover:text-gray-800 transition-all">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 1L13 13M13 1L1 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
                </button>
              </div>
              <div className="mx-6 h-px bg-gray-100" />
              <nav className="flex-1 flex flex-col justify-center px-8">
                {navLinks.map(({ href, label }, i) => (
                  <motion.div key={href} initial={{ opacity: 0, x: -28 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.18 + i * 0.08, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}>
                    <Link href={href} onClick={() => setIsOpen(false)} className="group flex items-center justify-between py-5" style={{ borderBottom: `1px solid ${NAV_COLORS[i]}20` }}>
                      <span
                        className="font-serif text-3xl font-bold tracking-tight transition-opacity duration-300 group-hover:opacity-70"
                        style={{ color: NAV_COLORS[i] }}
                      >
                        {label}
                      </span>
                      <span className="text-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{ color: NAV_COLORS[i] }}>→</span>
                    </Link>
                  </motion.div>
                ))}
              </nav>
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.42, duration: 0.4, ease: [0.16, 1, 0.3, 1] }} className="relative z-10 px-8 pb-16 flex flex-col gap-3">
                {!session ? (
                  <Link href="/auth/signin" onClick={() => setIsOpen(false)} className="w-full py-4 rounded-2xl text-center text-base font-semibold text-[#DB79AC] border-2 border-[#DB79AC] transition-all">Sign In</Link>
                ) : (
                  <>
                    <Link href="/projects" onClick={() => setIsOpen(false)} className="w-full py-4 rounded-2xl text-center text-base font-bold text-white tracking-wide transition-all hover:scale-[1.02] active:scale-[0.98] bg-[#DB79AC]" style={{  boxShadow: `0 4px 20px ` }}>✦ My Library</Link>
                    <button onClick={handleSignOut} className="w-full py-4 rounded-2xl text-center text-base font-medium text-[#DB79AC] hover:text-[#DB79AC] transition-all">Sign Out</button>
                  </>
                )}
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </header>
  );
}

// Quiet, on-brand secondary action. Pink-outline pill that fills on hover via
// pure CSS (no inline JS), with a visible keyboard focus ring. Reads as
// intentional rather than greyed-out, but stays secondary to the demo.
function SignInButton() {
  return (
    <Link
      href="/auth/signin"
      className="rounded-full border-2 border-[#D94590]/30 px-6 py-2.5 text-sm font-semibold text-[#D94590] transition-all duration-300 hover:bg-[#DB79AC] hover:border-[#D94590] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D94590]/50 focus-visible:ring-offset-2"
    >
      Sign in
    </Link>
  );
}

function Logo() {
  return (
    <Link href="/" className="flex items-center group">
      <Image src="/Flipwhizz_logo_NEW.png" alt="FlipWhizz" width={180} height={180} className="transition-transform duration-300 group-hover:rotate-3" />
    </Link>
  );
}