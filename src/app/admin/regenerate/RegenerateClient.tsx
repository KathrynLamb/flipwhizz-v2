// src/app/admin/regenerate/RegenerateClient.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Story = {
  id: string;
  title: string;
  status: string | null;
  paymentStatus: string | null;
  ownerEmail: string | null;
  drawn: number;
  pages: number;
} | null;

const ACTIONS: { event: string; label: string; detail: string; danger?: boolean }[] = [
  {
    event: "story/ensure-world:force",
    label: "Re-plan scenes and redraw every page",
    detail: "Re-plans who is in each scene, rewrites the art direction, rebuilds character references, then redraws all pages. Use after code or character changes.",
    danger: true,
  },
  {
    event: "story/generate-spreads:force",
    label: "Redraw every page (same scene plans)",
    detail: "Keeps the current scene plans and redraws all pages.",
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
    detail: "Uses the saved cover plan. Run after the pages are done.",
    danger: true,
  },
];

export default function RegenerateClient({ storyId, story }: { storyId: string; story: Story }) {
  const router = useRouter();
  const [input, setInput] = useState(storyId);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function run(event: string, label: string, danger?: boolean) {
    if (!story) return;
    if (danger && !window.confirm(`${label}\n\nBook: ${story.title}\nOwner: ${story.ownerEmail ?? "unknown"}\n\nThis replaces existing pictures. Continue?`)) return;
    setBusy(event);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/stories/${story.id}/retrigger`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event }),
      });
      const data = await res.json().catch(() => ({}));
      setMessage(res.ok ? `Started: ${label}. Refresh this page to watch the page count.` : `Failed: ${data.error ?? res.status}`);
    } catch (err) {
      setMessage(`Failed: ${err instanceof Error ? err.message : "network error"}`);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "#1a1325", color: "white", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "32px 16px" }}>
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
            <div style={{ background: "#241a33", borderRadius: 14, padding: 16, marginBottom: 16, fontSize: 14, lineHeight: 1.7 }}>
              <div style={{ fontSize: 17, fontWeight: 800 }}>{story.title}</div>
              <div>Owner: <b>{story.ownerEmail ?? "unknown"}</b></div>
              <div>Status: {story.status} · Payment: {story.paymentStatus}</div>
              <div>Pages with pictures: <b>{story.drawn} / {story.pages}</b></div>
              <div style={{ marginTop: 8, display: "flex", gap: 14, flexWrap: "wrap" }}>
                <a href={`/stories/${story.id}/studio`} target="_blank" style={{ color: "#C4B5FD" }}>Open studio ↗</a>
                <a href={`/stories/${story.id}/characters`} target="_blank" style={{ color: "#C4B5FD" }}>Characters ↗</a>
                <a href={`/stories/${story.id}/preview`} target="_blank" style={{ color: "#C4B5FD" }}>Preview ↗</a>
              </div>
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
            </div>

            {message && <p style={{ marginTop: 16, fontSize: 14, color: message.startsWith("Failed") ? "#fca5a5" : "#86efac" }}>{message}</p>}
          </>
        )}
      </div>
    </div>
  );
}
