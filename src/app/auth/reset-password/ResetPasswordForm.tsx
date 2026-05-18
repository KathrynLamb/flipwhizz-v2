"use client";

import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

const PINK = "#D94590";

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

// Minimal strength indicator: 0-3
function passwordStrength(pw: string): { score: number; label: string; color: string } {
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw) || /[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw) || pw.length >= 12) score++;
  const map = [
    { label: "", color: "bg-gray-200" },
    { label: "Weak", color: "bg-red-400" },
    { label: "Fair", color: "bg-amber-400" },
    { label: "Strong", color: "bg-emerald-500" },
  ];
  return { score, ...map[score] };
}

type Stage = "form" | "no-token" | "done";

export default function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [stage, setStage] = useState<Stage>(token ? "form" : "no-token");

  const strength = passwordStrength(password);
  const mismatch = confirm.length > 0 && password !== confirm;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong. Please try again.");
        setLoading(false);
        return;
      }
      setStage("done");
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6 py-12"
      style={{ background: "#FEFCFA" }}
    >
      <div
        className="w-full max-w-md rounded-[22px] bg-white px-8 py-10 lg:px-10 lg:py-12"
        style={{
          boxShadow: "0 12px 48px rgba(45,34,53,0.08), 0 0 0 1px rgba(45,34,53,0.04)",
        }}
      >
        {/* Decorative top bar */}
        <div
          className="mx-auto mb-6 h-1 w-32 rounded-full"
          style={{ background: "linear-gradient(to right, #D94590, #7C3AED, #5EEAD4)" }}
        />

        {/* Logo */}
        <div className="flex justify-center mb-4">
          <Link href="/">
            <Image src="/Flipwhizz_logo_NEW.png" alt="FlipWhizz" width={160} height={160} />
          </Link>
        </div>

        {/* ── No token ── */}
        {stage === "no-token" && (
          <>
            <h1 className="text-center font-serif text-2xl font-bold mb-2" style={{ color: "#2D2235" }}>
              Invalid link
            </h1>
            <p className="text-center text-sm mb-8" style={{ color: "#6B5D52" }}>
              This password reset link is missing or malformed.
              Request a new one from the sign-in page.
            </p>
            <Link
              href="/auth/signin"
              className="block w-full py-3.5 rounded-xl text-sm font-bold text-white text-center tracking-wide transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
              style={{ background: PINK, boxShadow: "0 4px 16px rgba(217,69,144,0.3)" }}
            >
              Back to sign in
            </Link>
          </>
        )}

        {/* ── Success ── */}
        {stage === "done" && (
          <>
            {/* Checkmark illustration */}
            <div className="flex justify-center mb-6">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center"
                style={{ background: "rgba(217,69,144,0.08)" }}
              >
                <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke={PINK} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
            </div>
            <h1 className="text-center font-serif text-2xl font-bold mb-2" style={{ color: "#2D2235" }}>
              Password updated!
            </h1>
            <p className="text-center text-sm mb-8" style={{ color: "#6B5D52" }}>
              Your password has been changed successfully. You can now sign in with your new password.
            </p>
            <button
              onClick={() => router.push("/auth/signin")}
              className="w-full py-3.5 rounded-xl text-sm font-bold text-white tracking-wide transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
              style={{ background: PINK, boxShadow: "0 4px 16px rgba(217,69,144,0.3)" }}
            >
              Sign in
            </button>
          </>
        )}

        {/* ── Form ── */}
        {stage === "form" && (
          <>
            <h1 className="text-center font-serif text-2xl font-bold mb-1" style={{ color: "#2D2235" }}>
              Choose a new password
            </h1>
            <p className="text-center text-sm mb-8" style={{ color: "#6B5D52" }}>
              Make it something memorable — at least 8 characters.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* New password */}
              <div>
                <label htmlFor="new-password" className="block text-xs font-semibold mb-1.5 tracking-wide uppercase" style={{ color: "#6B5D52" }}>
                  New password
                </label>
                <div className="relative">
                  <input
                    id="new-password"
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    className="w-full px-4 py-3 pr-11 rounded-xl border-2 border-gray-200 bg-white text-sm transition-all duration-200 focus:outline-none focus:border-[#D94590] focus:ring-2 focus:ring-[#D94590]/10"
                    style={{ color: "#2D2235" }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md transition-colors hover:bg-gray-100"
                    style={{ color: "#A89B8E" }}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    <EyeIcon open={showPassword} />
                  </button>
                </div>

                {/* Strength meter — only shown once typing starts */}
                {password.length > 0 && (
                  <div className="mt-2 space-y-1">
                    <div className="flex gap-1">
                      {[1, 2, 3].map((i) => (
                        <div
                          key={i}
                          className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                            i <= strength.score ? strength.color : "bg-gray-200"
                          }`}
                        />
                      ))}
                    </div>
                    {strength.label && (
                      <p className="text-xs" style={{ color: "#A89B8E" }}>
                        Strength: <span className="font-semibold">{strength.label}</span>
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Confirm password */}
              <div>
                <label htmlFor="confirm-password" className="block text-xs font-semibold mb-1.5 tracking-wide uppercase" style={{ color: "#6B5D52" }}>
                  Confirm password
                </label>
                <div className="relative">
                  <input
                    id="confirm-password"
                    type={showConfirm ? "text" : "password"}
                    required
                    minLength={8}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="Same password again"
                    className={`w-full px-4 py-3 pr-11 rounded-xl border-2 bg-white text-sm transition-all duration-200 focus:outline-none focus:ring-2 ${
                      mismatch
                        ? "border-red-400 focus:border-red-400 focus:ring-red-400/10"
                        : "border-gray-200 focus:border-[#D94590] focus:ring-[#D94590]/10"
                    }`}
                    style={{ color: "#2D2235" }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md transition-colors hover:bg-gray-100"
                    style={{ color: "#A89B8E" }}
                    aria-label={showConfirm ? "Hide password" : "Show password"}
                  >
                    <EyeIcon open={showConfirm} />
                  </button>
                </div>
                {mismatch && (
                  <p className="mt-1 text-xs text-red-500">Passwords don&apos;t match.</p>
                )}
              </div>

              {error && (
                <p className="text-sm text-red-600 bg-red-50 px-4 py-2.5 rounded-xl">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading || mismatch || password.length < 8}
                className="w-full py-3.5 rounded-xl text-sm font-bold text-white tracking-wide transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
                style={{ background: PINK, boxShadow: "0 4px 16px rgba(217,69,144,0.3)" }}
              >
                {loading ? "Updating password..." : "Set new password"}
              </button>
            </form>

            <p className="text-center text-sm mt-6" style={{ color: "#6B5D52" }}>
              <Link href="/auth/signin" className="font-semibold hover:underline" style={{ color: PINK }}>
                ← Back to sign in
              </Link>
            </p>
          </>
        )}
      </div>

      <p className="mt-6 text-xs" style={{ color: "#A89B8E" }}>FlipWhizz · Every story finds its way</p>
    </div>
  );
}