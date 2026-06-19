'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { clsx } from 'clsx';

type PagesBoxProps = {
  projectId: string;
};

function PagesBox({ projectId }: PagesBoxProps) {
  const [storyId, setStoryId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadExistingStory() {
      if (!projectId) return;

      const res = await fetch(
        `/api/stories/by-project?projectId=${encodeURIComponent(projectId)}`
      );

      if (!res.ok) {
        console.error('Failed to fetch story', await res.text());
        setLoading(false);
        return;
      }

      const data = await res.json();

      if (data.storyId && data.status === 'paged') {
        setStoryId(data.storyId);
      }
      setLoading(false);
    }

    loadExistingStory();
  }, [projectId]);

  const href = storyId ? `/stories/${storyId}` : '#';

  return (
    <Link
      href={href}
      aria-disabled={!storyId}
      className={clsx(
        "group block rounded-3xl p-6 transition-all",
        "border border-slate-200 bg-white",
        "shadow-sm hover:border-slate-300 hover:shadow-md",
        !storyId && "pointer-events-none opacity-60"
      )}
    >
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#5B6BD6] text-white shadow-sm">
          <span className="text-xl">📄</span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold tracking-tight text-slate-900">
              View pages
            </h2>

            <span
              className={clsx(
                "rounded-full px-2 py-0.5 text-[10px] font-semibold border",
                "border-slate-200 bg-white text-slate-500"
              )}
            >
              Recommended
            </span>
          </div>

          <p className="mt-1 text-sm text-slate-600 leading-relaxed">
            Add details, lock the tone, and generate the full story.
          </p>

          <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-[10px] font-semibold text-[#5B6BD6] ring-1 ring-[#5B6BD6]/20">
            <span className={clsx("text-base leading-none animate-pulse")}>
              ⚡
            </span>
            Best next step for this project
          </div>

          {loading && (
            <p className="mt-3 text-xs text-slate-400 italic">
              Loading story…
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}

export default PagesBox;