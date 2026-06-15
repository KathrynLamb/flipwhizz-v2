"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ background: "#FEFCFA" }}>
      <h2 className="font-serif text-2xl font-bold" style={{ color: "#2D2235" }}>Something went wrong</h2>
      <button
        onClick={reset}
        className="px-6 py-3 rounded-full text-white font-semibold"
        style={{ background: "#D94590" }}
      >
        Try again
      </button>
    </div>
  );
}