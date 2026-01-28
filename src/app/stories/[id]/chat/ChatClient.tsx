

"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Send } from "lucide-react"
type ChatMsg = { role: "user" | "assistant"; content: string };

export default function ChatPage() {
  const searchParams = useSearchParams();
  const projectId = useMemo(() => searchParams.get("project"), [searchParams]);
  const [storyCreating, setStoryCreating] = useState(false);
  const [storyId, setStoryId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll on new message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading]);

  useEffect(() => {
    async function loadChat() {
      if (!projectId) return;
      const res = await fetch(`/api/chat/history?projectId=${projectId}`);
      const data = await res.json();
      if (data.sessionId) {
        setMessages(data.messages || []);
      }
    }
    loadChat();
  }, [projectId]);

  useEffect(() => {
    async function loadExistingStory() {
      if (!projectId) return;
      const res = await fetch(`/api/stories/by-project?projectId=${projectId}`);
      const data = await res.json();
      if (data.storyId) {
        setStoryId(data.storyId);
      }
    }
    loadExistingStory();
  }, [projectId]);

  // Auto-navigate when story is ready
useEffect(() => {
  if (!storyId) return;
  
  let cancelled = false;
  let pollCount = 0;
  const maxPolls = 60; // 3 minutes max (60 * 3 seconds)

  const interval = setInterval(async () => {
    if (cancelled || pollCount >= maxPolls) {
      clearInterval(interval);
      return;
    }

    pollCount++;

    try {
      const res = await fetch(`/api/stories/${storyId}`, {
        cache: "no-store",
      });

      if (!res.ok) return;

      const story = await res.json();

      // Check if pages are ready
      if (story.status === "pages_ready" || story.status === "complete") {
        clearInterval(interval);
        // Navigate to the story pages
        window.location.href = `/stories/${storyId}/pages`;
      }
    } catch (err) {
      console.warn("Polling error:", err);
    }
  }, 3000); // Poll every 3 seconds

  return () => {
    cancelled = true;
    clearInterval(interval);
  };
}, [storyId]);

  async function createStoryFromChat() {
    if (!projectId || storyCreating) return;
    setStoryCreating(true);

    try {
      const res = await fetch("/api/stories/create-from-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });

      const data = await res.json();
      if (data.storyId) {
        setStoryId(data.storyId);
      } else {
        console.error("Story creation returned:", data);
      }
    } catch (err) {
      console.error("Story creation failed:", err);
    } finally {
      setStoryCreating(false);
    }
  }

  if (!projectId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-50 via-pink-50 to-orange-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-8 text-center">
          <div className="text-6xl mb-4">📚</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Oops! No Project Found
          </h2>
          <p className="text-gray-600">
            Please start from a project page to begin crafting your story.
          </p>
        </div>
      </div>
    );
  }

  async function sendMessage() {
    if (!input.trim() || loading) return;

    const text = input.trim();
    const userMessage: ChatMsg = { role: "user", content: text };
    const nextHistory = [...messages, userMessage];

    setMessages(nextHistory);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          history: nextHistory,
          projectId,
        }),
      });

      const data = await res.json();
      const assistantMessage: ChatMsg = {
        role: "assistant",
        content: data.reply ?? "(no reply)",
      };

      setMessages((m) => [...m, assistantMessage]);
    } catch (err) {
      console.error(err);
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: "⚠️ Sorry — something went wrong. Please try again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-pink-50 to-orange-50">
      {/* Elegant Header */}
      <div className="bg-white/80 backdrop-blur-xl border-b border-gray-200/50 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center text-white text-xl shadow-lg">
                ✨
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-900">
                  Story Builder
                </h1>
                <p className="text-xs text-gray-500">
                  Creating magic, one detail at a time
                </p>
              </div>
            </div>
            <div>

            {storyId && (
                  <a
                    href={`/stories/${storyId}`}
                    className="flex-1 sm:flex-initial px-6 py-3 bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 text-white font-semibold rounded-2xl shadow-lg hover:shadow-xl transition-all text-center"
                  >
                    <span className="flex items-center justify-center gap-2">
                      <span>📖</span>
                      Open Your Book
                    </span>
                  </a>
                )}
            </div>
            <div className="hidden sm:flex items-center gap-2">
              <div className="px-3 py-1.5 bg-gradient-to-r from-violet-100 to-pink-100 rounded-full">
                <span className="text-xs font-semibold bg-gradient-to-r from-violet-600 to-pink-600 bg-clip-text text-transparent">
                  Auto-saving
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Chat Container */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 pb-32">
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
          {/* Messages Area */}
          <div className="h-[calc(100vh-280px)] sm:h-[600px] overflow-y-auto px-4 sm:px-6 py-6 space-y-4">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center px-4">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-violet-400 via-pink-400 to-orange-400 flex items-center justify-center text-4xl mb-6 shadow-xl animate-pulse">
                  📖
                </div>
                <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3 max-w-xl">
                  Let's create something magical together
                </h2>
                <p className="text-gray-600 text-base sm:text-lg mb-8 max-w-md leading-relaxed">
                  Tell me about the little one this story is for. Their name,
                  age, what makes them laugh, what they love...
                </p>

                {/* Example prompts */}
                <div className="flex flex-wrap gap-2 justify-center max-w-xl">
                  {[
                    "My daughter Emma loves unicorns and baking...",
                    "Make it funny like Roald Dahl",
                    "Include our dog Max as a hero",
                    "Set it in a magical forest",
                  ].map((prompt, i) => (
                    <button
                      key={i}
                      onClick={() => setInput(prompt)}
                      className="px-4 py-2 bg-gradient-to-r from-violet-50 to-pink-50 hover:from-violet-100 hover:to-pink-100 rounded-full text-sm text-gray-700 border border-violet-200/50 transition-all hover:shadow-md hover:scale-105"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${
                  msg.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-5 py-3.5 shadow-sm ${
                    msg.role === "user"
                      ? "bg-gradient-to-br from-violet-500 to-pink-500 text-white"
                      : "bg-gray-50 border border-gray-200 text-gray-900"
                  }`}
                >
                  <p className="text-sm sm:text-base leading-relaxed whitespace-pre-wrap">
                    {msg.content}
                  </p>
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="max-w-[75%] rounded-2xl px-5 py-3.5 bg-gray-50 border border-gray-200">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" />
                      <div className="w-2 h-2 bg-pink-400 rounded-full animate-bounce delay-100" />
                      <div className="w-2 h-2 bg-orange-400 rounded-full animate-bounce delay-200" />
                    </div>
                    <span className="text-sm text-gray-500">
                      Crafting response...
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input Area */}
          <div className="border-t border-gray-200 bg-gray-50/50 px-4 sm:px-6 py-4">
            <div className="flex gap-3 items-end">
              <div className="flex-1 relative">
                <textarea
                  className="w-full rounded-2xl border-2 border-gray-200 bg-white px-4 py-3 text-sm sm:text-base resize-none focus:outline-none focus:border-violet-300 focus:ring-4 focus:ring-violet-100 transition-all"
                  placeholder="Share your ideas..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKey}
                  rows={1}
                  style={{
                    minHeight: "44px",
                    maxHeight: "120px",
                  }}
                />
              </div>
              <button
                onClick={sendMessage}
                disabled={loading || !input.trim()}
                className="shrink-0 w-11 h-11 rounded-2xl bg-gradient-to-br from-violet-500 to-pink-500 hover:from-violet-600 hover:to-pink-600 text-white font-semibold shadow-lg hover:shadow-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {/* <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2.5}
                    d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                  />
                </svg> */}
                <Send className='' />
              </button>
            </div>

            {/* Action Buttons */}
            {messages.length > 2 && (
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  onClick={createStoryFromChat}
                  disabled={storyCreating}
                  className="flex-1 sm:flex-initial px-6 py-3 bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-700 hover:to-pink-700 text-white font-semibold rounded-2xl shadow-lg hover:shadow-xl transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {storyCreating ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Creating magic...
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      <span>✨</span>
                      Create Story Book
                    </span>
                  )}
                </button>

                {storyId && (
                  <a
                    href={`/stories/${storyId}`}
                    className="flex-1 sm:flex-initial px-6 py-3 bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 text-white font-semibold rounded-2xl shadow-lg hover:shadow-xl transition-all text-center"
                  >
                    <span className="flex items-center justify-center gap-2">
                      <span>📖</span>
                      Open Your Book
                    </span>
                  </a>
                )}
              </div>
            )}

            {/* Helpful tip */}
            <div className="mt-4 text-center">
              <p className="text-xs text-gray-500">
                💡 Tip: The more details you share, the more magical the story
                becomes
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Floating encouragement for mobile */}
      <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-white via-white to-transparent px-4 pb-6 pt-8 pointer-events-none sm:hidden">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-xs text-gray-600 font-medium">
            You're building something your child will treasure forever ✨
          </p>
        </div>
      </div>
    </div>
  );
}

// Add to your globals.css:
/*
@keyframes bounce {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-8px);
  }
}

.animate-bounce {
  animation: bounce 1s infinite;
}

.delay-100 {
  animation-delay: 0.1s;
}

.delay-200 {
  animation-delay: 0.2s;
}
*/