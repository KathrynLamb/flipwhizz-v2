"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";



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
  workspace = false,
  title,
  subtitle,
}: {
  session: any;
  minimal?: boolean;
  workspace?: boolean;
  title?: string;
  subtitle?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);

  const handleSignOut = async () => {
    setIsOpen(false);
    await signOut({ callbackUrl: "/" });
  };

  if (workspace) return (
    <header className="z-20 flex h-16 shrink-0 items-center justify-between gap-4 border-b border-[#EFE7F5] bg-white px-4 sm:px-8">
      <div className="flex min-w-0 items-center gap-4">
        <Link href="/" aria-label="FlipWhizz home" className="shrink-0">
          <Image src="/Flipwhizz_logo_NEW.png" alt="FlipWhizz" width={180} height={180} className="h-auto w-[104px]" />
        </Link>
        <div className="hidden h-6 w-px bg-[#E4DCF0] sm:block" />
        <p className="hidden truncate text-[15px] font-bold text-[#24182F] sm:block">Story studio</p>
      </div>
      <nav aria-label="Account" className="flex shrink-0 items-center gap-3 sm:gap-5">
        {session ? <>
          <Link href="/projects" className="rounded-full border-[1.5px] border-[#E4DCF0] px-4 py-2 text-[14px] font-semibold text-[#24182F] transition-colors hover:border-[#A270C9]">My library</Link>
          <button onClick={handleSignOut} className="hidden rounded-full px-2 py-2 text-[14px] font-medium text-[#6A5E73] transition-colors hover:text-[#24182F] sm:block">Sign out</button>
        </> : <SignInButton />}
      </nav>
    </header>
  );

  const navLinks = [
    { href: "/#how-it-works", label: "How it works" },
    { href: "/#gallery", label: "Examples" },
    { href: "/#gifts", label: "Gifts" },
    { href: "/#pricing", label: "Pricing" },
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
              style={{ color: "#24182F" }}
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
            {navLinks.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className="relative group text-[15px] font-semibold text-[#24182F] transition-colors duration-300 hover:text-[#6F4BB0]"
              >
                <span>{label}</span>
                <span className="absolute -bottom-1 left-0 h-[2px] w-0 rounded-full bg-[#E8455C] transition-all duration-300 group-hover:w-full" />
              </Link>
            ))}
          </nav>
        )}

        <div className="flex items-center gap-3">
          {!session ? (
            <>
              <SignInButton />
              {!minimal && <StartStoryButton />}
            </>
          ) : (
            <>
              <Link
                href="/projects"
                className="rounded-full border-[1.5px] border-[#E4DCF0] px-5 py-2.5 text-[15px] font-semibold text-[#24182F] transition-colors hover:border-[#A270C9]"
              >
                My library
              </Link>
              <button
                onClick={handleSignOut}
                className="rounded-full px-3 py-2.5 text-[15px] font-medium text-[#6A5E73] transition-colors hover:text-[#24182F]"
              >
                Sign out
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
                className="rounded-full border-[1.5px] border-[#E4DCF0] px-4 py-2 text-[14px] font-semibold text-[#24182F]"
              >
                My library
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
              style={{ color: "#24182F" }}
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
                    <Link href={href} onClick={() => setIsOpen(false)} className="group flex items-center justify-between border-b border-[#EFE7F5] py-5">
                      <span className="text-3xl font-bold tracking-tight text-[#24182F] transition-colors duration-300 group-hover:text-[#6F4BB0]">
                        {label}
                      </span>
                      <span className="text-xl text-[#E8455C] opacity-0 transition-opacity duration-300 group-hover:opacity-100">→</span>
                    </Link>
                  </motion.div>
                ))}
              </nav>
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.42, duration: 0.4, ease: [0.16, 1, 0.3, 1] }} className="relative z-10 px-8 pb-16 flex flex-col gap-3">
                {!session ? (
                  <>
                  <Link href="/projects/create?entry=header_mobile" onClick={() => setIsOpen(false)} className="w-full py-4 rounded-full text-center text-base font-bold text-white bg-[#E8455C]">Start a story</Link>
                  <Link href="/auth/signin" onClick={() => setIsOpen(false)} className="w-full py-4 rounded-full text-center text-base font-semibold text-[#24182F] border-[1.5px] border-[#E4DCF0] transition-all">Sign in</Link>
                  </>
                ) : (
                  <>
                    <Link href="/projects" onClick={() => setIsOpen(false)} className="w-full rounded-full bg-[#24182F] py-4 text-center text-base font-bold text-white">My library</Link>
                    <button onClick={handleSignOut} className="w-full rounded-full py-4 text-center text-base font-medium text-[#6A5E73]">Sign out</button>
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
      className="rounded-full px-4 py-2.5 text-[15px] font-semibold text-[#24182F] transition-colors hover:text-[#6F4BB0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6F4BB0]/50"
    >
      Sign in
    </Link>
  );
}

function StartStoryButton() {
  return (
    <Link
      href="/projects/create?entry=header"
      className="rounded-full bg-[#E8455C] px-6 py-3 text-[15px] font-bold text-white shadow-[0_10px_24px_-8px_rgba(232,69,92,0.55)] transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E8455C]/50 focus-visible:ring-offset-2"
    >
      Start a story
    </Link>
  );
}

function Logo() {
  return (
    <Link href="/" className="flex items-center group">
      <Image src="/Flipwhizz_logo_NEW.png" alt="FlipWhizz" width={180} height={180} className="h-auto w-[132px] transition-transform duration-300 group-hover:rotate-3 lg:w-[150px]" />
    </Link>
  );
}