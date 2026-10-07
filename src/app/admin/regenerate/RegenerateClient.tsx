// src/app/admin/regenerate/RegenerateClient.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type StoryInfo = {
  id: string;
  title: string;
  status: string | null;
  paymentStatus: string | null;
  ownerEmail: string | null;
  drawn: number;
  pages: number;
};

export type SpreadQa = {
  id: string;
  index: number;
  status: string | null; // ok | fixed | flagged | unchecked | null (drawn before checks existed)
  remaining: string[];
  textProblems: string[];
  fixesApplied: number;
  model: string | null;
  finalUrl: string | null;
  artUrl: string | null;
  at: string | null;
};

const ACTIONS: { event: string; label: string; detail: string; danger?: boolean }[] = [
  {
    event: "story/ensure-world:force",
    label: "Re-plan scenes and redraw every page",
    detail: "Re-plans who is in each scene, rewrites the art direction, rebuilds reference sheets, then draws, checks, fixes and letters every page.",
    danger: true,
  },
  {
    event: "story/generate-spreads:force",
    label: "Redraw every page (same scene plans)",
    detail: "Keeps the current scene plans; draws, checks, fixes and letters every page.",
    danger: true,
  },
  {
    event: "story/generate-spreads",
    label: "Draw missing pages only",
    detail: "Only pages without a picture. Safe on a finished book.",
  },
  {
    event: "story/generate.cover.spread",
    label: "Redraw the cover",
    detail: "Uses the saved cover plan, then checks and fixes every character on it. Run after the pages are done.",
    danger: true,
  },
];

const STATUS_STYLE: Record<string, { label: string; color: string }> = {
  ok: { label: "Checked: all correct", color: "#86efac" },
  fixed: { label: "Checked: fixed", color: "#86efac" },
  flagged: { label: "Needs attention", color: "#fca5a5" },
  unchecked: { label: "Check failed to run", color: "#fcd34d" },
};

export default function RegenerateClient({
  storyId,
  story,
  spreads,
  cast,
}: {
  storyId: string;
  story: StoryInfo | null;
  spreads: SpreadQa[];
  cast: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [input, setInput] = useState(storyId);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [model, setModel] = useState<"nb21" | "pro">("nb21");
  const [characterId, setCharacterId] = useState<string>("");

  async function run(event: string, label: string, danger?: boolean, extra: Record<string, string> = {}) {
    if (!story) return;
    if (danger && !window.confirm(`${label}\n\nBook: ${story.title}\nOwner: ${story.ownerEmail ?? "unknown"}\n\nThis replaces existing pictures. Continue?`)) return;
    setBusy(event);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/stories/${story.id}/retrigger`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event, artModel: model, ...extra }),
      });
      const data = await res.json().catch(() => ({}));
      setMessage(res.ok ? `Started: ${label}. Refresh this page to watch progress.` : `Failed: ${data.error ?? res.status}`);
    } catch (err) {
      setMessage(`Failed: ${err instanceof Error ? err.message : "network error"}`);
    } finally {
      setBusy(null);
    }
  }

  const flagged = spreads.filter((s) => s.status === "flagged").length;
  const checked = spreads.filter((s) => s.status).length;

  const box = { background: "#241a33", borderRadius: 14, padding: 16 } as const;

  return (
    <div style={{ minHeight: "100vh", background: "#1a1325", color: "white", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "32px 16px" }}>
        <a href="/admin" style={{ color: "#C4B5FD", fontSize: 13 }}>← admin</a>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: "12px 0 20px" }}>Regenerate a book</h1>

        <form
          onSubmit={(e) => { e.preventDefault(); router.push(`/admin/regenerate?storyId=${encodeURIComponent(input.trim())}`); }}
          style={{ display: "flex", gap: 8, marginBottom: 20 }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Story id"
            style={{ flex: 1, minWidth: 0, padding: "10px 12px", borderRadius: 10, border: "1px solid #4c3a66", background: "#241a33", color: "white", fontSize: 14 }}
          />
          <button type="submit" style={{ padding: "10px 16px", borderRadius: 10, background: "#8B5CF6", color: "white", fontWeight: 700, border: "none" }}>Load</button>
        </form>

        {storyId && !story && <p style={{ color: "#fca5a5" }}>No book found with that id.</p>}

        {story && (
          <>
            <div style={{ ...box, marginBottom: 16, fontSize: 14, lineHeight: 1.7 }}>
              <div style={{ fontSize: 17, fontWeight: 800 }}>{story.title}</div>
              <div>Owner: <b>{story.ownerEmail ?? "unknown"}</b></div>
              <div>Status: {story.status} · Payment: {story.paymentStatus}</div>
              <div>Pages with pictures: <b>{story.drawn} / {story.pages}</b></div>
              <div>Spreads checked: <b>{checked} / {spreads.length}</b>{flagged > 0 && <span style={{ color: "#fca5a5" }}> · {flagged} need attention</span>}</div>
              <div style={{ marginTop: 8, display: "flex", gap: 14, flexWrap: "wrap" }}>
                <a href={`/stories/${story.id}/studio`} target="_blank" style={{ color: "#C4B5FD" }}>Open studio ↗</a>
                <a href={`/stories/${story.id}/characters`} target="_blank" style={{ color: "#C4B5FD" }}>Characters ↗</a>
                <a href={`/stories/${story.id}/preview`} target="_blank" style={{ color: "#C4B5FD" }}>Preview ↗</a>
              </div>
            </div>

            <div style={{ ...box, marginBottom: 16 }}>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>Image model for the art</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {([
                  ["nb21", "Nano Banana 2.1", "best multi-character consistency (Google eval), cheaper"],
                  ["pro", "Nano Banana Pro", "previous model, strongest at long text"],
                ] as const).map(([key, label, hint]) => (
                  <button
                    key={key}
                    onClick={() => setModel(key)}
                    style={{ flex: "1 1 220px", textAlign: "left", padding: 12, borderRadius: 10, border: `2px solid ${model === key ? "#8B5CF6" : "#4c3a66"}`, background: model === key ? "#3b2a55" : "transparent", color: "white" }}
                  >
                    <div style={{ fontWeight: 700 }}>{label}</div>
                    <div style={{ fontSize: 12, color: "#c9bde0" }}>{hint}</div>
                  </button>
                ))}
              </div>
              <div style={{ fontSize: 12, color: "#c9bde0", marginTop: 8 }}>Lettering always uses Nano Banana Pro.</div>
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              {ACTIONS.map((a) => (
                <button
                  key={a.event}
                  disabled={!!busy}
                  onClick={() => run(a.event, a.label, a.danger)}
                  style={{ textAlign: "left", padding: 14, borderRadius: 12, border: `1px solid ${a.danger ? "#7c3aed" : "#4c3a66"}`, background: busy === a.event ? "#3b2a55" : "#241a33", color: "white", cursor: busy ? "wait" : "pointer", opacity: busy && busy !== a.event ? 0.5 : 1 }}
                >
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{busy === a.event ? "Starting…" : a.label}</div>
                  <div style={{ fontSize: 12.5, color: "#c9bde0", marginTop: 4 }}>{a.detail}</div>
                </button>
              ))}

              <div style={{ padding: 14, borderRadius: 12, border: "1px solid #7c3aed", background: "#241a33" }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>Update one character on every page</div>
                <div style={{ fontSize: 12.5, color: "#c9bde0", margin: "4px 0 10px" }}>
                  After changing someone's card or photo: redraws only that person, on every page they're in. Everything else, including the lettering, stays exactly as it is.
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <select
                    value={characterId}
                    onChange={(e) => setCharacterId(e.target.value)}
                    style={{ flex: "1 1 200px", padding: "10px 12px", borderRadius: 10, border: "1px solid #4c3a66", background: "#1a1325", color: "white" }}
                  >
                    <option value="">Choose a character…</option>
                    {cast.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <button
                    disabled={!characterId || !!busy}
                    onClick={() => run("story/refresh-character", `Update ${cast.find((c) => c.id === characterId)?.name ?? "character"} on every page`, true, { characterId })}
                    style={{ padding: "10px 16px", borderRadius: 10, background: characterId ? "#8B5CF6" : "#4c3a66", color: "white", fontWeight: 700, border: "none" }}
                  >
                    {busy === "story/refresh-character" ? "Starting…" : "Update"}
                  </button>
                </div>
              </div>
            </div>

            {message && <p style={{ marginTop: 16, fontSize: 14, color: message.startsWith("Failed") ? "#fca5a5" : "#86efac" }}>{message}</p>}

            <h2 style={{ fontSize: 17, fontWeight: 800, margin: "28px 0 10px" }}>Check report</h2>
            <div style={{ display: "grid", gap: 8 }}>
              {spreads.map((s) => {
                const st = s.status ? STATUS_STYLE[s.status] ?? { label: s.status, color: "#c9bde0" } : { label: "Not checked (drawn before checks existed)", color: "#8b7ba0" };
                const problems = [...s.remaining, ...s.textProblems];
                return (
                  <div key={s.id} style={{ ...box, padding: 12, fontSize: 13 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                      <b>Spread {s.index}</b>
                      <span style={{ color: st.color }}>{st.label}{s.fixesApplied ? ` · ${s.fixesApplied} fix${s.fixesApplied === 1 ? "" : "es"}` : ""}</span>
                    </div>
                    {problems.length > 0 && (
                      <ul style={{ margin: "6px 0 0", paddingLeft: 18, color: "#fca5a5" }}>
                        {problems.map((p, i) => <li key={i}>{p}</li>)}
                      </ul>
                    )}
                    <div style={{ marginTop: 6, display: "flex", gap: 12, flexWrap: "wrap", color: "#c9bde0" }}>
                      {s.finalUrl && <a href={s.finalUrl} target="_blank" style={{ color: "#C4B5FD" }}>page ↗</a>}
                      {s.artUrl && <a href={s.artUrl} target="_blank" style={{ color: "#C4B5FD" }}>art without text ↗</a>}
                      {s.model && <span>{s.model}</span>}
                      {s.at && <span>{new Date(s.at).toLocaleString("en-GB")}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
