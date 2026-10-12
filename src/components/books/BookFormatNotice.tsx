"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function BookFormatNotice({ storyId, confirmed }: { storyId: string; confirmed: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function confirm() {
    setBusy(true); setError("");
    try {
      const res = await fetch(`/api/stories/${storyId}/book-type`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirm: true }) });
      if (!res.ok) throw new Error("Could not confirm the format. Please try again.");
      router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Please try again."); }
    finally { setBusy(false); }
  }
  return <aside className="border-b border-purple-100 bg-purple-50 px-5 py-3 text-sm text-slate-800">
    <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3">
      <svg viewBox="0 0 64 48" width="64" height="48" role="img" aria-label="Example of simple outline artwork on white paper" className="rounded bg-white">
        <path d="M10 39h44M16 39V22l16-12 16 12v17M27 39V28h10v11M20 23h5v5h-5" fill="white" stroke="black" strokeWidth="2" strokeLinejoin="round" />
      </svg>
      <div className="flex-1"><strong>Colouring storybook</strong><p>A full-colour cover, with black-outline pictures and story text inside for your child to colour.</p></div>
      {!confirmed && <button type="button" onClick={confirm} disabled={busy} className="rounded-xl bg-[#7960AF] px-4 py-2 font-semibold text-white disabled:opacity-50">{busy ? "Saving…" : "Use this format"}</button>}
    </div>
    {error && <p role="alert" className="mt-2 text-red-700">{error}</p>}
  </aside>;
}
