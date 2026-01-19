"use client";

import { useEffect, useRef, useState } from "react";
import {
  Send,
  ArrowLeft,
  Loader2,
  BookOpen,
  CheckCircle,
} from "lucide-react";

import type {
  Story,
  Character,
  Location,
  StyleGuide,
} from "@/db/types";


/* ======================================================
   TYPES
====================================================== */

type Props = {
  story: Story;
  characters: Character[];
  locations: Location[];
  styleGuide: StyleGuide | null;
};



type ChatMsg = {
  role: "user" | "assistant";
  content: string;
};

export default function CoverDesignPage({
  story,
  characters,
  locations,
  styleGuide,
}: Props) {

  const storyId = story.id;

  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const [coverUrl, setCoverUrl] = useState<string | null>(
    story.frontCoverUrl ?? null
  );
  const [generating, setGenerating] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  /* ======================================================
     PHASE 1 — INTERPRET (ONCE)
  ====================================================== */

  useEffect(() => {
    if (sessionId) return;

    setLoading(true);

    fetch("/api/cover/interpret", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storyId }),
    })
      .then((res) => res.json())
      .then((data) => {
        setSessionId(data.sessionId);
        setMessages([{ role: "assistant", content: data.message }]);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [storyId, sessionId]);

  /* ======================================================
     AUTO SCROLL
  ====================================================== */

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  /* ======================================================
     AUTO RESIZE TEXTAREA
  ====================================================== */

  useEffect(() => {
    if (!textareaRef.current) return;
    textareaRef.current.style.height = "auto";
    textareaRef.current.style.height =
      textareaRef.current.scrollHeight + "px";
  }, [input]);

  /* ======================================================
     PHASE 2 — REFINE (CHAT)
  ====================================================== */

  async function sendMessage() {
    if (!input.trim() || loading || !sessionId) return;

    const userMsg: ChatMsg = { role: "user", content: input.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/cover/refine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, message: userMsg.content }),
      });

      const data = await res.json();

      if (data.reply) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: data.reply },
        ]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  /* ======================================================
     GENERATE COVER
  ====================================================== */

  async function generateCover() {
    if (generating || !sessionId) return;

    setGenerating(true);

    try {
      const res = await fetch("/api/cover/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storyId, sessionId }),
      });

      const data = await res.json();
      if (!data.jobId) throw new Error("No jobId");

      const poll = setInterval(async () => {
        const pollRes = await fetch(
          `/api/cover/status?jobId=${data.jobId}`
        );
        const pollData = await pollRes.json();

        if (pollData.coverUrl) {
          clearInterval(poll);
          setCoverUrl(pollData.coverUrl);
          setGenerating(false);
        }
      }, 2000);

      setTimeout(() => {
        clearInterval(poll);
        setGenerating(false);
      }, 150000);
    } catch (err) {
      console.error(err);
      setGenerating(false);
    }
  }

  const canGenerate = messages.length >= 2 && !generating;

  /* ======================================================
     RENDER
  ====================================================== */

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-pink-50 to-purple-50">
      <header className="sticky top-0 bg-white border-b p-4 flex justify-between">
        <button onClick={() => (window.location.href = `/stories/${storyId}`)}>
          <ArrowLeft className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4" />
          <strong>{story.title}</strong>
        </div>

        {coverUrl && (
          <div className="text-green-600 flex items-center gap-1">
            <CheckCircle className="w-4 h-4" /> Cover Ready
          </div>
        )}
      </header>

      <main className="max-w-4xl mx-auto p-6">
        <div className="bg-white rounded-3xl shadow-xl p-6">
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            {messages.map((m, i) => (
              <div key={i} className={m.role === "user" ? "text-right" : ""}>
                <div
                  className={`inline-block px-4 py-3 rounded-2xl ${
                    m.role === "user"
                      ? "bg-purple-600 text-white"
                      : "bg-orange-600 text-white"
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {loading && <Loader2 className="animate-spin" />}
            <div ref={bottomRef} />
          </div>

          <div className="mt-4 flex gap-2">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              className="flex-1 rounded-xl border p-3"
              placeholder="Refine the cover…"
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || loading}
              className="bg-purple-600 text-white px-4 rounded-xl"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>

          <button
            onClick={generateCover}
            disabled={!canGenerate}
            className="mt-6 w-full bg-gradient-to-r from-orange-400 to-purple-600 text-white py-4 rounded-2xl font-bold"
          >
            {coverUrl ? "Generate New Version" : "Generate Cover"}
          </button>
        </div>
      </main>
    </div>
  );
}
