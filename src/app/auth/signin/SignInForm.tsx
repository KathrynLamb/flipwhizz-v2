"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import posthog from "posthog-js";

const PINK = "#D94590";

export default function SignInForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";
  const errorParam = searchParams.get("error");

  const [mode, setMode] = useState<"signin" | "register">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(
    errorParam === "CredentialsSignin"
      ? "Invalid email or password."
      : errorParam
        ? "Something went wrong. Please try again."
        : ""
  );
  const [success, setSuccess] = useState("");

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      if (mode === "register") {
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name.trim(), email, password }),
        });

        const data = await res.json();

        if (!res.ok) {
          setError(data.error || "Registration failed.");
          setLoading(false);
          return;
        }

        if (data.linked) {
          setSuccess("Password added to your existing account! Signing you in...");
        } else {
          setSuccess("Account created! Signing you in...");
        }

        const result = await signIn("credentials", {
          email,
          password,
          callbackUrl,
          redirect: false,
        });

        if (result?.error) {
          setError("Account created but sign-in failed. Please sign in manually.");
          setMode("signin");
          setLoading(false);
          return;
        }

        // Register route returns userId — use it as distinctId
        // identify is also fired server-side in /api/auth/register, this
        // aliases the client anonymous ID to the real user
        if (data.userId) {
          posthog.identify(data.userId, { email, name: name.trim() });
        }
        posthog.capture("user_registered", { method: "email" });
        window.location.href = callbackUrl;
      } else {
        const result = await signIn("credentials", {
          email,
          password,
          callbackUrl,
          redirect: false,
        });

        if (result?.error) {
          setError("Invalid email or password.");
          setLoading(false);
          return;
        }

        // For sign-in we don't have the userId here — identify happens
        // in the PostHogIdentifier component that runs after session loads.
        // Just capture the event; the anonymous session will be aliased once
        // the session-aware component calls posthog.identify().
        posthog.capture("user_signed_in", { method: "email" });
        window.location.href = callbackUrl;
      }
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

        {/* Heading */}
        <h1 className="text-center font-serif text-2xl font-bold mb-1" style={{ color: "#2D2235" }}>
          {mode === "register" ? "Create your account" : "Welcome back"}
        </h1>
        <p className="text-center text-sm mb-8" style={{ color: "#6B5D52" }}>
          {mode === "register"
            ? "Start creating beautiful stories for your little ones."
            : "Sign in to continue creating\nbeautiful stories for your little ones."}
        </p>

        {/* Google */}
        <button
          onClick={() => signIn("google", { callbackUrl })}
          className="w-full flex items-center justify-center gap-3 py-3.5 rounded-xl border-2 border-gray-200 bg-white text-sm font-semibold transition-all duration-200 hover:border-gray-300 hover:shadow-sm active:scale-[0.98]"
          style={{ color: "#4A4038" }}
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
          </svg>
          Continue with Google
        </button>

        {/* Divider */}
        <div className="flex items-center gap-4 my-6">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-xs font-medium uppercase tracking-wider" style={{ color: "#A89B8E" }}>or</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        {/* Email / Password form */}
        <form onSubmit={handleEmailSubmit} className="space-y-4">
          {mode === "register" && (
            <div>
              <label htmlFor="name" className="block text-xs font-semibold mb-1.5 tracking-wide uppercase" style={{ color: "#6B5D52" }}>Name</label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your first name"
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 bg-white text-sm transition-all duration-200 focus:outline-none focus:border-[#D94590] focus:ring-2 focus:ring-[#D94590]/10"
                style={{ color: "#2D2235" }}
              />
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-xs font-semibold mb-1.5 tracking-wide uppercase" style={{ color: "#6B5D52" }}>Email</label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 bg-white text-sm transition-all duration-200 focus:outline-none focus:border-[#D94590] focus:ring-2 focus:ring-[#D94590]/10"
              style={{ color: "#2D2235" }}
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-xs font-semibold mb-1.5 tracking-wide uppercase" style={{ color: "#6B5D52" }}>Password</label>
            <input
              id="password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === "register" ? "At least 8 characters" : "Your password"}
              className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 bg-white text-sm transition-all duration-200 focus:outline-none focus:border-[#D94590] focus:ring-2 focus:ring-[#D94590]/10"
              style={{ color: "#2D2235" }}
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 px-4 py-2.5 rounded-xl">{error}</p>
          )}
          {success && (
            <p className="text-sm text-emerald-700 bg-emerald-50 px-4 py-2.5 rounded-xl">{success}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-xl text-sm font-bold text-white tracking-wide transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
            style={{ background: PINK, boxShadow: "0 4px 16px rgba(217,69,144,0.3)" }}
          >
            {loading
              ? mode === "register" ? "Creating account..." : "Signing in..."
              : mode === "register" ? "Create account" : "Sign in"}
          </button>
        </form>

        {/* Toggle mode */}
        <p className="text-center text-sm mt-6" style={{ color: "#6B5D52" }}>
          {mode === "signin" ? (
            <>
              Don&apos;t have an account?{" "}
              <button onClick={() => { setMode("register"); setError(""); setSuccess(""); }} className="font-semibold hover:underline" style={{ color: PINK }}>Create one</button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button onClick={() => { setMode("signin"); setError(""); setSuccess(""); }} className="font-semibold hover:underline" style={{ color: PINK }}>Sign in</button>
            </>
          )}
        </p>

        {/* Legal */}
        <p className="text-center text-xs mt-6" style={{ color: "#A89B8E" }}>
          By signing in, you agree to our{" "}
          <Link href="/terms" className="underline hover:no-underline" style={{ color: "#6B5D52" }}>Terms of Service</Link>{" "}
          and{" "}
          <Link href="/privacy" className="underline hover:no-underline" style={{ color: "#6B5D52" }}>Privacy Policy</Link>.
        </p>
      </div>

      <p className="mt-6 text-xs" style={{ color: "#A89B8E" }}>FlipWhizz · Every story finds its way</p>
    </div>
  );
}