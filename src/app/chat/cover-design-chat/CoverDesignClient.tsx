"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

type ChatMsg = { role: "user" | "assistant"; content: string };

export default function CoverDesignPage() {
  const searchParams = useSearchParams();
  const storyId = useMemo(() => searchParams.get("story"), [searchParams]);
  
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [story, setStory] = useState<any>(null);
  const [coverPrompt, setCoverPrompt] = useState<string | null>(null);
  const [frontCoverUrl, setFrontCoverUrl] = useState<string | null>(null);
  const [backCoverUrl, setBackCoverUrl] = useState<string | null>(null);
  
  const bottomRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading]);

  // Load story details
  useEffect(() => {
    async function loadStory() {
      if (!storyId) return;
      try {
        const res = await fetch(`/api/stories/${storyId}`);
        const data = await res.json();
        if (res.ok) {
          setStory(data.story);
        }
      } catch (e) {
        console.error(e);
      }
    }
    loadStory();
  }, [storyId]);

  // Load chat history
  useEffect(() => {
    async function loadChat() {
      if (!storyId) return;
      const res = await fetch(`/api/stories/${storyId}/cover-chat`);
      const data = await res.json();
      if (data.messages) {
        setMessages(data.messages);
      }
    }
    loadChat();
  }, [storyId]);

  async function sendMessage() {
    if (!input.trim() || loading || !storyId) return;

    const text = input.trim();
    const userMessage: ChatMsg = { role: "user", content: text };
    const nextHistory = [...messages, userMessage];

    setMessages(nextHistory);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/stories/cover-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          history: nextHistory,
          storyId,
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
        { role: "assistant", content: "⚠️ Sorry — something went wrong." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function generateCoverPrompt() {
    if (!storyId || generating) return;
    setGenerating(true);

    try {
      const res = await fetch("/api/stories/generate-cover-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storyId,
          conversationHistory: messages,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setCoverPrompt(data.prompt);
      
      // Automatically generate covers after prompt is ready
      await generateCovers(data.prompt);
    } catch (err: any) {
      alert(err.message || "Failed to generate prompt");
    } finally {
      setGenerating(false);
    }
  }

  async function generateCovers(prompt: string) {
    try {
      const res = await fetch("/api/stories/generate-covers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storyId,
          prompt,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setFrontCoverUrl(data.frontCoverUrl);
      setBackCoverUrl(data.backCoverUrl);
    } catch (err: any) {
      alert(err.message || "Failed to generate covers");
    }
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  if (!storyId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-50 via-pink-50 to-orange-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-8 text-center">
          <div className="text-6xl mb-4">📚</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">No Story Found</h2>
          <p className="text-gray-600">Please select a story to design covers for.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-pink-50 to-orange-50">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-xl border-b border-gray-200/50 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center text-white text-xl shadow-lg">
                📖
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-900">Cover Design</h1>
                <p className="text-xs text-gray-500">
                  {story?.title || "Loading..."}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 pb-32">
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
          {/* Messages Area */}
          <div className="h-[calc(100vh-280px)] sm:h-[600px] overflow-y-auto px-4 sm:px-6 py-6 space-y-4">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center px-4">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-violet-400 via-pink-400 to-orange-400 flex items-center justify-center text-4xl mb-6 shadow-xl">
                  🎨
                </div>
                <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3 max-w-xl">
                  Let's design the perfect cover
                </h2>
                <p className="text-gray-600 text-base sm:text-lg mb-8 max-w-md leading-relaxed">
                  Tell me what you envision for your book's cover. What should be on the front? What about the back?
                </p>

                <div className="flex flex-wrap gap-2 justify-center max-w-xl">
                  {[
                    "Show the main character in their adventure",
                    "Include all the characters together",
                    "Feature the magical setting",
                    "Make it cozy and inviting",
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
                    <span className="text-sm text-gray-500">Thinking...</span>
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
                  placeholder="Describe your cover vision..."
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
                <svg
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
                </svg>
              </button>
            </div>

            {/* Action Buttons */}
            {messages.length > 2 && !coverPrompt && (
              <div className="mt-4">
                <button
                  onClick={generateCoverPrompt}
                  disabled={generating}
                  className="w-full px-6 py-3 bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-700 hover:to-pink-700 text-white font-semibold rounded-2xl shadow-lg hover:shadow-xl transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {generating ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Generating covers...
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      <span>✨</span>
                      Generate Book Covers
                    </span>
                  )}
                </button>
              </div>
            )}

            {/* Cover Preview */}
            {(frontCoverUrl || backCoverUrl) && (
              <div className="mt-6 space-y-4">
                <h3 className="text-sm font-bold text-gray-900">Your Covers:</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {frontCoverUrl && (
                    <div>
                      <p className="text-xs font-semibold text-gray-600 mb-2">Front Cover</p>
                      <img
                        src={frontCoverUrl}
                        alt="Front Cover"
                        className="w-full rounded-xl border border-gray-200 shadow-lg"
                      />
                    </div>
                  )}
                  {backCoverUrl && (
                    <div>
                      <p className="text-xs font-semibold text-gray-600 mb-2">Back Cover</p>
                      <img
                        src={backCoverUrl}
                        alt="Back Cover"
                        className="w-full rounded-xl border border-gray-200 shadow-lg"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="mt-4 text-center">
              <p className="text-xs text-gray-500">
                💡 Describe the mood, characters, and setting you want to see
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}