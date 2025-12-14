"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

type StoryPage = {
  id: string;
  pageNumber: number;
  text: string;
};

export default function StoryViewPage() {
  const params = useParams();
  const router = useRouter();

  const storyId = useMemo(() => {
    const raw = params?.id;
    return typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : null;
  }, [params]);

  const [story, setStory] = useState<any>(null);
  const [pages, setPages] = useState<StoryPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log("story", story)
    console.log("pages", pages)
  }, [story, pages])

  useEffect(() => {
    async function load() {
      if (!storyId) {
        setLoading(false);
        setError("Missing story id.");
        return;
      }

      try {
        const res = await fetch(`/api/stories/${storyId}`);
        const data = await res.json();

        if (!res.ok) {
          setError(data?.error ?? "Failed to load story.");
          setLoading(false);
          return;
        }

        setStory(data.story);
        setPages(data.pages || []);
      } catch (e) {
        setError("Network error loading story.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [storyId]);

  const confirmStory = async () => {
    try {
      await fetch(`/api/stories/${storyId}/extract-world`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ overwriteLinks: true }),
      });

      router.push(`/stories/${storyId}/extract`);
    } catch (err) {
      console.error(err);
      alert("Failed to confirm story.");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0b0b10] text-white p-10">
        <div className="animate-pulse text-white/60">Loading story…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0b0b10] text-red-300 p-10">
        {error}
      </div>
    );
  }

  if (!story) {
    return (
      <div className="min-h-screen bg-[#0b0b10] text-red-300 p-10">
        Story not found.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b0b10] text-white pb-28">
      {/* HEADER / HERO */}
      <div className="relative z-10 border-b border-white/10 bg-gradient-to-b from-white/5 to-transparent">
        <div className="mx-auto max-w-3xl p-6 pb-10">
          <div className="text-[10px] uppercase tracking-wide text-white/40">
            Your Story
          </div>

          <h1 className="mt-1 text-4xl font-bold leading-tight bg-gradient-to-r from-white via-white/90 to-white/70 bg-clip-text text-transparent">
            {story.title ?? "Untitled Story"}
          </h1>

          <p className="mt-2 text-white/60">{pages.length} pages</p>

          <div className="mt-4 inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-[11px] font-medium ring-1 ring-white/10">
            Print-ready flow
          </div>
        </div>
      </div>

      {/* STORY PAGES */}
      <div className="mx-auto max-w-3xl p-6 pt-8 space-y-6">
        {pages.map((p) => (
          <div
            key={p.id}
            className="bg-white text-black p-5 rounded-2xl shadow-lg border border-neutral-200"
          >
            <div className="text-xs font-semibold mb-2 text-neutral-500">
              Page {p.pageNumber}
            </div>

            <div className="text-[15px] leading-relaxed whitespace-pre-line">
              {p.text}
            </div>
          </div>
        ))}
      </div>

      {/* FLOATING MOBILE ACTION BAR */}
      <div className="
        fixed bottom-0 left-0 right-0 z-50
        bg-[#0b0b10]/95 backdrop-blur-lg
        border-t border-white/10
        p-4 flex flex-wrap justify-center gap-3
        sm:static sm:bg-transparent sm:border-none sm:p-0 sm:mt-12 sm:mx-auto sm:max-w-3xl
      ">
        <a
          href={`/stories/${storyId}/edit`}
          className="px-4 py-2 rounded-xl text-sm bg-white/10 border border-white/20 active:scale-[0.97] transition"
        >
          ✏️ Edit Story
        </a>

        <button
          onClick={confirmStory}
          className="px-4 py-2 rounded-xl text-sm bg-sky-500 font-semibold text-black shadow active:scale-[0.97] transition"
        >
          ✓ Confirm & Continue
        </button>

        <a
          href={`/stories/${storyId}/pdf`}
          className="px-4 py-2 rounded-xl text-sm bg-white text-black font-semibold shadow active:scale-[0.97] transition"
        >
          📘 Export PDF
        </a>

        <a
          href={`/projects`}
          className="px-4 py-2 rounded-xl text-sm bg-white/5 border border-white/10 active:scale-[0.97] transition"
        >
          ← Projects
        </a>
      </div>
    </div>
  );
}
