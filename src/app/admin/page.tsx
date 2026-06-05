"use client";
// src/app/admin/page.tsx

import { useState, useCallback, useRef } from "react";

// ── Types ────────────────────────────────────────────────────────────────────

interface UserResult {
  id: string;
  name: string | null;
  email: string;
  createdAt: string;
  projectCount: number;
  storyCount: number;
}

interface Story {
  id: string;
  projectId: string;
  title: string;
  status: string;
  currentStep: number;
  storyConfirmed: boolean;
  createdAt: string;
  updatedAt: string;
  pageCount: number;
  imagesCount: number;
  charactersExtracted: boolean | null;
  locationsExtracted: boolean | null;
  spreadsBuilt: boolean | null;
  promptsBuilt: boolean | null;
  worldComplete: boolean | null;
}

interface Project {
  id: string;
  name: string;
  createdAt: string;
}

interface UserDetail {
  user: { id: string; name: string | null; email: string; createdAt: string };
  projects: Project[];
  stories: Story[];
}

interface Page {
  id: string;
  pageNumber: number;
  text: string;
  imageUrl: string | null;
}

interface StoryPages {
  story: { title: string; status: string };
  pages: Page[];
}

// ── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const colours: Record<string, string> = {
    generating: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    ready:      "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    complete:   "bg-blue-500/20 text-blue-300 border-blue-500/30",
    paged:      "bg-slate-500/20 text-slate-300 border-slate-500/30",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono border ${colours[status] ?? "bg-slate-500/20 text-slate-300 border-slate-500/30"}`}>
      {status}
    </span>
  );
}

// ── Pipeline flags ────────────────────────────────────────────────────────────

function PipelineFlags({ story }: { story: Story }) {
  const flags = [
    { key: "charactersExtracted", label: "chars" },
    { key: "locationsExtracted",  label: "locs"  },
    { key: "spreadsBuilt",        label: "spreads"},
    { key: "promptsBuilt",        label: "prompts"},
    { key: "worldComplete",       label: "world"  },
  ] as const;

  return (
    <div className="flex gap-1 flex-wrap">
      {flags.map(({ key, label }) => {
        const val = story[key];
        return (
          <span
            key={key}
            className={`text-xs px-1.5 py-0.5 rounded font-mono ${
              val === true  ? "bg-emerald-900/50 text-emerald-400" :
              val === false ? "bg-red-900/50 text-red-400" :
                              "bg-slate-800 text-slate-500"
            }`}
          >
            {label}
          </span>
        );
      })}
      <span className="text-xs px-1.5 py-0.5 rounded font-mono bg-slate-800 text-slate-400">
        {story.imagesCount}/{story.pageCount} imgs
      </span>
    </div>
  );
}

// ── Story viewer ──────────────────────────────────────────────────────────────

function StoryViewer({
  storyId,
  storyTitle,
  currentStatus,
  onClose,
  onStatusChange,
}: {
  storyId: string;
  storyTitle: string;
  currentStatus: string;
  onClose: () => void;
  onStatusChange: (storyId: string, status: string) => void;
}) {
  const [data, setData] = useState<StoryPages | null>(null);
  const [loading, setLoading] = useState(true);
  const [nudging, setNudging] = useState(false);
  const [localStatus, setLocalStatus] = useState(currentStatus);

  // Load on mount
  useState(() => {
    fetch(`/api/admin/stories/${storyId}/pages`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  });

  // actually load on mount
  const loaded = useRef(false);
  if (!loaded.current) {
    loaded.current = true;
    fetch(`/api/admin/stories/${storyId}/pages`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }

  async function nudgeStatus(status: string) {
    setNudging(true);
    try {
      const res = await fetch(`/api/admin/stories/${storyId}/pages`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        setLocalStatus(status);
        onStatusChange(storyId, status);
      }
    } finally {
      setNudging(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#0a0a0f]">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors text-lg">←</button>
          <h2 className="font-mono text-white text-sm">{storyTitle}</h2>
          <StatusBadge status={localStatus} />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 font-mono mr-2">nudge status:</span>
          {["paged", "generating", "ready", "complete"].map(s => (
            <button
              key={s}
              onClick={() => nudgeStatus(s)}
              disabled={nudging || s === localStatus}
              className={`text-xs px-2 py-1 rounded font-mono border transition-all ${
                s === localStatus
                  ? "border-white/20 text-white bg-white/10 cursor-default"
                  : "border-white/10 text-slate-400 hover:border-white/30 hover:text-white"
              }`}
            >
              {s}
            </button>
          ))}
<select
  id={`retrigger-${storyId}`}
  className="text-xs px-2 py-1 rounded font-mono border border-white/10 bg-transparent text-slate-400"
  defaultValue="story/generate-spreads"
>
  <option value="story/ensure-world">ensure-world (full pipeline)</option>
  <option value="story/build-spreads">build-spreads</option>
  <option value="story/build-spread-prompts">build-spread-prompts</option>
  <option value="story/generate-spreads">generate-spreads (images only)</option>
</select>
<button
  onClick={async () => {
    const select = document.getElementById(`retrigger-${storyId}`) as HTMLSelectElement;
    const event = select?.value ?? "story/generate-spreads";
    const res = await fetch(`/api/admin/stories/${storyId}/retrigger`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event }),
    });
    const data = await res.json();
    if (res.ok) alert(`✅ Fired: ${data.event}`);
    else alert(`❌ Failed: ${data.error}`);
  }}
  className="text-xs px-2 py-1 rounded font-mono border border-amber-500/30 text-amber-400 hover:border-amber-400 hover:text-amber-300 transition-all"
>
  retrigger
</button>
        </div>
      </div>

      {/* Pages */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading && (
          <div className="flex items-center justify-center h-40 text-slate-500 font-mono text-sm">
            loading pages...
          </div>
        )}
        {!loading && data && (
          <div className="grid grid-cols-2 gap-4 max-w-5xl mx-auto">
        {data.pages.filter(page => page.pageNumber % 2 !== 0).map(page => (
              <div key={page.id} className="bg-[#0f0f1a] border border-white/8 rounded-lg overflow-hidden">
                {page.imageUrl ? (
                  <img
                    src={page.imageUrl}
                    alt={`Page ${page.pageNumber}`}
                    className="w-full aspect-[3/2] object-cover"
                  />
                ) : (
                  <div className="w-full aspect-[3/2] bg-slate-900 flex items-center justify-center">
                    <span className="text-slate-600 font-mono text-xs">no image</span>
                  </div>
                )}
                <div className="p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-mono text-slate-500">p.{page.pageNumber}</span>
                    {page.imageUrl && (
                      <a
                        href={page.imageUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-mono text-slate-500 hover:text-white transition-colors"
                      >
                        ↗ cloudinary
                      </a>
                    )}
                  </div>
                  <p className="text-slate-300 text-xs leading-relaxed">{page.text}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main admin page ───────────────────────────────────────────────────────────

export default function AdminPage() {
  const [query, setQuery]           = useState("");
  const [searching, setSearching]   = useState(false);
  const [results, setResults]       = useState<UserResult[]>([]);
  const [selected, setSelected]     = useState<UserDetail | null>(null);
  const [loadingUser, setLoadingUser] = useState(false);
  const [viewingStory, setViewingStory] = useState<{ id: string; title: string; status: string } | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const search = useCallback((q: string) => {
    clearTimeout(debounceRef.current);
    if (q.length < 2) { setResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/admin/users?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        setResults(data.users ?? []);
      } finally {
        setSearching(false);
      }
    }, 300);
  }, []);

  async function loadUser(userId: string) {
    setLoadingUser(true);
    setSelected(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}`);
      const data = await res.json();
      setSelected(data);
    } finally {
      setLoadingUser(false);
    }
  }

  function handleStatusChange(storyId: string, status: string) {
    if (!selected) return;
    setSelected(prev => prev ? {
      ...prev,
      stories: prev.stories.map(s => s.id === storyId ? { ...s, status } : s)
    } : null);
  }

  const projectName = (projectId: string) =>
    selected?.projects.find(p => p.id === projectId)?.name ?? "—";

  return (
    <div className="min-h-screen bg-[#07070f] text-white" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&display=swap');`}</style>

      {/* Story viewer overlay */}
      {viewingStory && (
        <StoryViewer
          storyId={viewingStory.id}
          storyTitle={viewingStory.title}
          currentStatus={viewingStory.status}
          onClose={() => setViewingStory(null)}
          onStatusChange={handleStatusChange}
        />
      )}

      {/* Top bar */}
      <div className="border-b border-white/8 px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-white/30 text-xs">▲</span>
          <span className="text-white text-sm font-medium tracking-tight">flipwhizz</span>
          <span className="text-white/20 text-xs">/</span>
          <span className="text-white/50 text-xs">admin</span>
        </div>
        <span className="text-white/30 text-xs">🔒 restricted</span>
      </div>

      <div className="max-w-6xl mx-auto px-8 py-10">

        {/* Search */}
        <div className="mb-8">
          <label className="block text-xs text-white/40 mb-2 uppercase tracking-widest">Search users</label>
          <div className="relative">
            <input
              type="text"
              value={query}
              onChange={e => { setQuery(e.target.value); search(e.target.value); }}
              placeholder="email or name..."
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/30 transition-colors font-mono"
            />
            {searching && (
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 text-xs animate-pulse">
                searching...
              </span>
            )}
          </div>
        </div>

        {/* Search results */}
        {results.length > 0 && !selected && (
          <div className="mb-8 border border-white/8 rounded-lg overflow-hidden">
            {results.map((u, i) => (
              <button
                key={u.id}
                onClick={() => loadUser(u.id)}
                className={`w-full text-left px-5 py-4 flex items-center justify-between hover:bg-white/5 transition-colors ${i > 0 ? "border-t border-white/8" : ""}`}
              >
                <div>
                  <div className="text-sm text-white">{u.email}</div>
                  <div className="text-xs text-white/40 mt-0.5">{u.name ?? "—"} · joined {new Date(u.createdAt).toLocaleDateString()}</div>
                </div>
                <div className="flex gap-4 text-xs text-white/30 font-mono">
                  <span>{u.projectCount} projects</span>
                  <span>{u.storyCount} stories</span>
                  <span className="text-white/20">→</span>
                </div>
              </button>
            ))}
          </div>
        )}

        {loadingUser && (
          <div className="text-white/30 text-xs font-mono animate-pulse">loading user...</div>
        )}

        {/* User detail */}
        {selected && (
          <div>
            {/* User header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <button
                  onClick={() => { setSelected(null); }}
                  className="text-white/30 hover:text-white text-xs mb-2 transition-colors"
                >
                  ← back to search
                </button>
                <h1 className="text-white text-lg font-medium">{selected.user.email}</h1>
                <p className="text-white/40 text-xs mt-1">
                  {selected.user.name ?? "no name"} · {selected.user.id} · joined {new Date(selected.user.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div className="text-right text-xs text-white/30 font-mono">
                <div>{selected.projects.length} projects</div>
                <div>{selected.stories.length} stories</div>
              </div>
            </div>

            {/* Stories */}
            {selected.stories.length === 0 ? (
              <div className="text-white/30 text-sm border border-white/8 rounded-lg p-6 text-center">
                No stories yet
              </div>
            ) : (
              <div className="space-y-3">
                {selected.stories.map(story => (
                  <div
                    key={story.id}
                    className="border border-white/8 rounded-lg p-5 hover:border-white/15 transition-colors bg-white/[0.02]"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <StatusBadge status={story.status} />
                          {story.storyConfirmed && (
                            <span className="text-xs font-mono text-emerald-400/70">confirmed</span>
                          )}
                        </div>
                        <h3 className="text-white text-sm font-medium truncate">{story.title}</h3>
                        <p className="text-white/30 text-xs mt-1 font-mono">
                          {projectName(story.projectId)} · updated {new Date(story.updatedAt).toLocaleDateString()}
                        </p>
                        <div className="mt-2">
                          <PipelineFlags story={story} />
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button
                          onClick={() => setViewingStory({ id: story.id, title: story.title, status: story.status })}
                          className="text-xs px-3 py-1.5 rounded border border-white/10 text-white/60 hover:text-white hover:border-white/30 transition-all font-mono"
                        >
                          view pages
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Empty projects */}
            {selected.projects.filter(p => !selected.stories.some(s => s.projectId === p.id)).length > 0 && (
              <div className="mt-6">
                <p className="text-xs text-white/30 uppercase tracking-widest mb-3">projects with no stories</p>
                <div className="space-y-2">
                  {selected.projects
                    .filter(p => !selected.stories.some(s => s.projectId === p.id))
                    .map(p => (
                      <div key={p.id} className="border border-white/8 rounded-lg px-5 py-3 flex items-center justify-between">
                        <span className="text-white/50 text-sm">{p.name}</span>
                        <span className="text-white/20 text-xs font-mono">no story · {new Date(p.createdAt).toLocaleDateString()}</span>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}