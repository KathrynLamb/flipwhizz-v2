// src/app/auth/signin/page.tsx
"use client";

import { signIn } from "next-auth/react";
import Image from "next/image";
import Link from "next/link";

export default function SignInPage() {
  return (
    <div
      className="min-h-screen relative flex items-center justify-center px-5 py-12"
      style={{ fontFamily: "'Bricolage Grotesque', system-ui, sans-serif" }}
    >
      {/* ── Background ──────────────────────────────────────────────── */}
      <div
        className="fixed inset-0 -z-10"
        style={{
          background: `
            radial-gradient(ellipse 90% 70% at 30% 20%, rgba(232,190,255,0.35) 0%, transparent 55%),
            radial-gradient(ellipse 80% 60% at 75% 75%, rgba(255,182,210,0.3) 0%, transparent 50%),
            radial-gradient(ellipse 60% 50% at 50% 50%, rgba(200,220,255,0.15) 0%, transparent 45%),
            #FEFCFA
          `,
        }}
      >
        <div
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23c4b5d4' fill-opacity='0.04'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />
      </div>

      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link
        href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600;12..96,700;12..96,800&display=swap"
        rel="stylesheet"
      />

      {/* ── Card ────────────────────────────────────────────────────── */}
      <div
        className="relative w-full max-w-[420px] rounded-[28px] overflow-hidden"
        style={{
          background: "white",
          border: "1px solid rgba(180,150,210,0.12)",
          boxShadow:
            "0 8px 40px rgba(100,60,140,0.08), 0 2px 12px rgba(100,60,140,0.04)",
        }}
      >
        {/* Top accent bar */}
        <div
          className="h-1.5"
          style={{
            background:
              "linear-gradient(90deg, #F28B7B, #F5A862, #F5CE62, #7DD4A8, #6DBCE0, #A78BDA)",
          }}
        />

        <div className="px-8 pt-10 pb-10">
          {/* Logo */}
          <div className="flex justify-center mb-8">
            <Link href="/" className="block transition-transform hover:scale-105">
              <Image
                src="/Flipwhizz_logo_NEW.png"
                alt="FlipWhizz"
                width={160}
                height={48}
                priority
              />
            </Link>
          </div>

          {/* Heading */}
          <div className="text-center mb-8">
            <h1
              className="text-[26px] font-extrabold mb-2"
              style={{ color: "#2D2235", letterSpacing: "-0.03em" }}
            >
              Welcome back
            </h1>
            <p
              className="text-[15px] leading-relaxed"
              style={{ color: "#7B6E90" }}
            >
              Sign in to continue creating
              <br />
              beautiful stories for your little ones.
            </p>
          </div>

          {/* Sign in button */}
          <button
            onClick={() => signIn("google", { callbackUrl: "/projects" })}
            className="w-full flex items-center justify-center gap-3 rounded-2xl px-6 py-4 transition-all duration-200 hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]"
            style={{
              background: "white",
              border: "2px solid rgba(180,150,210,0.18)",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            {/* Google icon */}
            <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            <span
              className="text-[15px] font-bold"
              style={{ color: "#2D2235" }}
            >
              Continue with Google
            </span>
          </button>

          {/* Divider */}
          <div className="flex items-center gap-4 my-6">
            <div
              className="flex-1 h-px"
              style={{ background: "rgba(180,150,210,0.12)" }}
            />
            <span
              className="text-[11px] font-semibold uppercase"
              style={{ color: "#C4B5D4", letterSpacing: "0.08em" }}
            >
              or
            </span>
            <div
              className="flex-1 h-px"
              style={{ background: "rgba(180,150,210,0.12)" }}
            />
          </div>

          {/* Email hint (future) */}
          <div
            className="w-full flex items-center justify-center gap-2 rounded-2xl px-6 py-4 opacity-50 cursor-not-allowed"
            style={{
              background: "rgba(249,245,255,0.5)",
              border: "1.5px solid rgba(180,150,210,0.1)",
            }}
          >
            <svg
              className="w-4.5 h-4.5 flex-shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#A897BD"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="2" y="4" width="20" height="16" rx="2" />
              <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
            </svg>
            <span
              className="text-[14px] font-semibold"
              style={{ color: "#A897BD" }}
            >
              Email sign-in coming soon
            </span>
          </div>

          {/* Terms */}
          <p
            className="text-center text-[12px] leading-relaxed mt-8"
            style={{ color: "#C4B5D4" }}
          >
            By signing in, you agree to our{" "}
            <Link
              href="/terms"
              className="underline underline-offset-2 transition-colors"
              style={{ color: "#A897BD" }}
            >
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link
              href="/privacy"
              className="underline underline-offset-2 transition-colors"
              style={{ color: "#A897BD" }}
            >
              Privacy Policy
            </Link>
            .
          </p>
        </div>
      </div>

      {/* ── Footer tagline ──────────────────────────────────────────── */}
      <p
        className="absolute bottom-6 left-1/2 -translate-x-1/2 text-[12px] font-medium"
        style={{ color: "#D4C6E6" }}
      >
        FlipWhizz · Every story finds its way
      </p>
    </div>
  );
}