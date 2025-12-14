// src/app/dev/chat/page.tsx
"use client";

import { useState } from "react";

export default function DevChatPage() {
  const [msg, setMsg] = useState("Hi Claude, I’m planning a kids book.");
  const [reply, setReply] = useState<string>("");
  const [loading, setLoading] = useState(false);

  async function send() {
    setLoading(true);
    setReply("");
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: msg }),
    });
    const data = await res.json();
    setReply(data?.reply || data?.error || "No response");
    setLoading(false);
  }

  return (
    <main className="min-h-screen p-10">
      <div className="max-w-xl space-y-4">
        <h1 className="text-2xl font-semibold">Claude Test</h1>
        <textarea
          className="w-full rounded-md border p-3"
          rows={4}
          value={msg}
          onChange={(e) => setMsg(e.target.value)}
        />
        <button
          onClick={send}
          disabled={loading}
          className="rounded-md bg-black px-4 py-2 text-white disabled:opacity-50"
        >
          {loading ? "Sending..." : "Send"}
        </button>
        {reply && (
          <div className="rounded-md border p-4 whitespace-pre-wrap">
            {reply}
          </div>
        )}
      </div>
    </main>
  );
}
