// src/app/admin/tools/ToolsClient.tsx
"use client";

import { useState } from "react";
import { Card } from "../ui";

const TOOLS = [
  { tool: "health-email", label: "Email me the health digest", detail: "Runs every health check now and emails the result, even if all clear." },
  { tool: "test-alert", label: "Send a test alert", detail: "Checks that alert emails and PostHog are working." },
];

export default function ToolsClient() {
  const [sending, setSending] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function run(tool: string, label: string) {
    if (!window.confirm(`${label}?`)) return;
    setSending(tool);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/tools", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tool }) });
      const data = await res.json().catch(() => ({}));
      setMessage({ ok: res.ok && data.ok, text: data.message ?? data.error ?? `Failed (${res.status})` });
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : "Request failed" });
    } finally {
      setSending(null);
    }
  }

  return (
    <Card title="Actions">
      <div className="space-y-3">
        {TOOLS.map((t) => (
          <div key={t.tool} className="flex flex-col gap-2 rounded-lg border border-white/10 p-3 sm:flex-row sm:items-center">
            <div className="flex-1">
              <div className="text-sm font-semibold text-white">{t.label}</div>
              <div className="text-xs text-slate-400">{t.detail}</div>
            </div>
            <button
              className="rounded-lg bg-[#8B5CF6] px-3 py-2 text-xs font-semibold text-white hover:bg-[#7C4DEB] disabled:opacity-40"
              disabled={!!sending}
              onClick={() => run(t.tool, t.label)}
            >
              {sending === t.tool ? "Sending…" : "Send"}
            </button>
          </div>
        ))}
      </div>
      {message && <p className={`mt-3 text-sm ${message.ok ? "text-emerald-300" : "text-rose-300"}`}>{message.text}</p>}
    </Card>
  );
}
