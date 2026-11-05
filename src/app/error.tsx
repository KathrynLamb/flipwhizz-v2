// src/app/error.tsx
"use client";

import { openSupportChat } from "@/lib/supportChat";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  function tellKaty() {
    openSupportChat({
      kind: "page_crashed",
      message: [error.digest && `digest ${error.digest}`, error.message].filter(Boolean).join(": "),
    });
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 text-center" style={{ background: "#FEFCFA" }}>
      <h2 className="font-serif text-2xl font-bold" style={{ color: "#2D2235" }}>Something went wrong</h2>
      <p className="max-w-sm text-sm" style={{ color: "#5B4B6B" }}>
        Sorry about that. Try again, or tell me what you were doing and I&apos;ll look into it.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          onClick={reset}
          className="px-6 py-3 rounded-full text-white font-semibold"
          style={{ background: "#D94590" }}
        >
          Try again
        </button>
        <button
          onClick={tellKaty}
          className="px-6 py-3 rounded-full font-semibold border-2"
          style={{ borderColor: "#6A4DAA", color: "#6A4DAA" }}
        >
          Chat to Katy
        </button>
      </div>
    </div>
  );
}
