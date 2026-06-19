"use client";

import Link from "next/link";
import Image from "next/image";

const PRIMARY_LINKS = [
  { href: "/how-it-works", label: "How it works" },
  { href: "/faq", label: "FAQ" },
  { href: "/examples", label: "Examples" },
  { href: "/about", label: "About" },
];

const LEGAL_LINKS = [
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
];

// `minimal` drops the primary link row and keeps just the logo, legal links,
// and copyright. Use on focused conversion pages where every link is an exit;
// Privacy/Terms stay (they're trust signals, not distractions).
export default function ChatFooter({ minimal = false }: { minimal?: boolean }) {
  const year = new Date().getFullYear();

  return (
    <footer className="relative mt-auto w-full overflow-hidden border-t border-slate-100 bg-white">
      {/* The same soft painterly bloom used behind the chat, sourced from
          the real logo spectrum, low and diffuse so it bookends the page
          rather than competing with it. */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 bottom-0 h-[360px] w-[760px] -translate-x-1/2 translate-y-1/3 rounded-full opacity-[0.12] blur-[100px]"
        style={{
          background:
            "conic-gradient(from 20deg, #FA626F, #FAB043, #F7CD55, #71CBE5, #9D6CC7, #DB6AAC, #FA626F)",
        }}
      />

      <div className="relative mx-auto max-w-2xl px-6 py-12 sm:px-10">
        <div className="flex flex-col items-center gap-6 text-center">
          <Image
            src="/Flipwhizz_logo_NEW.png"
            alt="FlipWhizz"
            width={140}
            height={140}
            className="h-auto w-[100px]"
          />

          {!minimal && (
            <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
              {PRIMARY_LINKS.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  className="text-sm font-semibold text-slate-600 transition-colors duration-200 hover:text-slate-900"
                >
                  {label}
                </Link>
              ))}
            </nav>
          )}

          <div className="h-px w-12 bg-slate-200" />

          <div className="flex flex-col items-center gap-2 text-xs text-slate-400 sm:flex-row sm:gap-5">
            <p>
              © {year} FlipWhizz Ltd. Made for storytelling families.
            </p>
            <div className="flex items-center gap-4">
              {LEGAL_LINKS.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  className="font-medium text-slate-400 transition-colors hover:text-slate-600"
                >
                  {label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}