"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

type StoryPage = {
  id: string;
  pageNumber: number;
  text: string;
};

export default function StoryEditPage() {
  const params = useParams();
  const router = useRouter();

  const storyId = useMemo(() => {
    const raw = (params as any)?.id;
    return typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : null;
  }, [params]);

  const [story, setStory] = useState<any>(null);
  const [pages, setPages] = useState<StoryPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [rewriteInstruction, setRewriteInstruction] = useState("");
  const [rewriting, setRewriting] = useState(false);

  useEffect(() => {
    async function load() {
      if (!storyId) {
        setLoading(false);
        return;
      }
      const res = await fetch(`/api/stories/${storyId}`);
      const data = await res.json();
      setStory(data.story ?? null);
      setPages(data.pages ?? []);
      setLoading(false);
    }
    load();
  }, [storyId]);

  function updateLocalPage(id: string, text: string) {
    setPages((prev) => prev.map((p) => (p.id === id ? { ...p, text } : p)));
  }

  async function saveManualEdits() {
    if (!storyId || saving) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/stories/${storyId}/pages`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pages: pages.map((p) => ({ id: p.id, text: p.text })),
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        console.error("Save failed", err);
      }
    } finally {
      setSaving(false);
    }
  }

  async function runGlobalRewrite() {
    if (!storyId || rewriting || !rewriteInstruction.trim()) return;
    setRewriting(true);
    try {
      const res = await fetch(`/api/stories/${storyId}/global-rewrite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instruction: rewriteInstruction }),
      });

      const data = await res.json();
      if (!res.ok) {
        console.error("Rewrite failed", data);
        if (data?.debug?.rawPreview) {
          console.log("RAW PREVIEW:", data.debug.rawPreview);
        }
        alert(data?.error ?? "Rewrite failed");
        return;
      }
      

      // Reload story after rewrite
      const reload = await fetch(`/api/stories/${storyId}`);
      const fresh = await reload.json();
      setStory(fresh.story ?? null);
      setPages(fresh.pages ?? []);
      setRewriteInstruction("");
    } finally {
      setRewriting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0b0b10] text-white p-10">
        Loading editor…
      </div>
    );
  }

  if (!storyId || !story) {
    return (
      <div className="min-h-screen bg-[#0b0b10] text-red-300 p-10">
        Story not found.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b0b10] text-white">
      <div className="mx-auto max-w-4xl p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-[10px] uppercase tracking-wide text-white/50">
              Edit story
            </div>
            <h1 className="text-2xl font-semibold">
              {story.title ?? "Untitled Story"}
            </h1>
            <p className="text-white/60 text-sm mt-1">
              {pages.length} pages • Print-friendly pacing
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => router.push(`/stories/${storyId}`)}
              className="rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-xs"
            >
              ← Back to story
            </button>
            <button
              onClick={saveManualEdits}
              disabled={saving}
              className="rounded-xl bg-white text-black px-4 py-2 text-xs font-semibold disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save manual edits"}
            </button>
          </div>
        </div>

        {/* Global rewrite */}
        <div className="mt-6 rounded-2xl bg-white/5 border border-white/10 p-4">
          <div className="text-sm font-semibold mb-1">
            Claude-powered global rewrite
          </div>
          <div className="text-xs text-white/60 mb-3">
            Keeps the same {pages.length} pages. Great for tone shifts, style changes,
            or tightening the story.
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <input
              value={rewriteInstruction}
              onChange={(e) => setRewriteInstruction(e.target.value)}
              placeholder='e.g., "Make it funnier and more rhyming"'
              className="flex-1 rounded-xl bg-black/20 border border-white/10 px-3 py-2 text-sm outline-none"
            />
            <button
              onClick={runGlobalRewrite}
              disabled={rewriting || !rewriteInstruction.trim()}
              className="rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
            >
              {rewriting ? "Rewriting…" : "Rewrite all pages"}
            </button>
          </div>
        </div>

        {/* Manual page editor */}
        <div className="mt-8 space-y-4">
          {pages.map((p) => (
            <div
              key={p.id}
              className="rounded-2xl bg-white text-black p-5 shadow"
            >
              <div className="text-xs font-semibold text-neutral-500 mb-2">
                Page {p.pageNumber}
              </div>
              <textarea
                value={p.text}
                onChange={(e) => updateLocalPage(p.id, e.target.value)}
                className="w-full min-h-[90px] rounded-xl border border-black/10 p-3 text-sm leading-relaxed outline-none focus:ring-2 focus:ring-black/10"
              />
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-wrap gap-3">
          <button
            onClick={saveManualEdits}
            disabled={saving}
            className="rounded-xl bg-white text-black px-4 py-2 text-sm font-semibold disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save manual edits"}
          </button>

          <a
            href={`/stories/${storyId}/pdf`}
            className="rounded-xl bg-white/10 border border-white/20 px-4 py-2 text-sm"
          >
            Generate Print-Ready PDF
          </a>

          <a
  href={`/stories/${storyId}/extract`}
  className="px-4 py-2 bg-white text-black rounded-xl text-sm font-semibold"
>
  Confirm Story & Extract World
</a>

        </div>
      </div>
    </div>
  );
}
