// src/app/chat/ChatClient.tsx
"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import {
  Send,
  Sparkles,
  Loader2,
  Zap,
  BookOpen,
  Globe2,
} from "lucide-react";

type ChatMsg = { role: "user" | "assistant"; content: string };

interface WorldContext {
  id: string;
  name: string;
  description: string | null;
  bookNumber: number;
  readerName: string | null;
  themes: string[];
}

export default function ChatPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = useMemo(() => searchParams.get("project"), [searchParams]);
  const worldIdParam = useMemo(() => searchParams.get("worldId"), [searchParams]);
  const bookNumberParam = useMemo(() => searchParams.get("bookNumber"), [searchParams]);

  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(true);
  const [storyCreating, setStoryCreating] = useState(false);
  const [storyId, setStoryId] = useState<string | null>(null);
  const [worldContext, setWorldContext] = useState<WorldContext | null>(null);

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Guard to prevent double-triggering story creation
  const creationTriggeredRef = useRef(false);

  // Load world context if worldId is in the URL
  useEffect(() => {
    async function loadWorldContext() {
      if (!worldIdParam) return;
      try {
        const res = await fetch(`/api/worlds/${worldIdParam}`);
        if (!res.ok) return;
        const data = await res.json();
        setWorldContext({
          id: data.id,
          name: data.name,
          description: data.description,
          bookNumber: Number(bookNumberParam) || 1,
          readerName: data.readers?.[0]?.reader?.name ?? null,
          themes: (data.themes as string[]) ?? [],
        });
      } catch {
        // World not found — continue without context
      }
    }
    loadWorldContext();
  }, [worldIdParam, bookNumberParam]);

  async function waitForPagesAndNavigate(nextStoryId: string) {
    for (let attempt = 0; attempt < 30; attempt++) {
      try {
        const res = await fetch(`/api/stories/${nextStoryId}/pages`, {
          cache: "no-store",
        });
        const data = await res.json();

        if (Array.isArray(data) && data.length > 0) {
          router.push(`/stories/${nextStoryId}/pages`);
          return;
        }
      } catch (err) {
        console.error("Polling error:", err);
      }

      await new Promise((r) => setTimeout(r, 1000));
    }

    router.push(`/stories/${nextStoryId}/pages`);
  }

  useEffect(() => {
    async function initializeStudio() {
      if (!projectId) return;

      try {
        const chatRes = await fetch(`/api/chat/history?projectId=${projectId}`, {
          cache: "no-store",
        });
        const chatData = await chatRes.json();

        if (chatData.messages) {
          setMessages(chatData.messages);
        }

        const storyRes = await fetch(`/api/stories/by-project?projectId=${projectId}`, {
          cache: "no-store",
        });
        const storyData = await storyRes.json();

        if (storyData.storyId) {
          setStoryId(storyData.storyId);
          await waitForPagesAndNavigate(storyData.storyId);
          return;
        }
      } catch (err) {
        console.error("Studio sync failed:", err);
      } finally {
        setIsSyncing(false);
      }
    }

    initializeStudio();
  }, [projectId, router]);

  useEffect(() => {
    if (projectId && messages.length > 0) {
      localStorage.setItem(`chat_backup_${projectId}`, JSON.stringify(messages));
    }

    setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  }, [messages, projectId]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = textareaRef.current.scrollHeight + "px";
    }
  }, [input]);

  async function createStoryFromChat() {
    if (!projectId || storyCreating || storyId) return;
    if (creationTriggeredRef.current) return;
    creationTriggeredRef.current = true;

    setStoryCreating(true);

    try {
      const res = await fetch("/api/stories/create-from-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          ...(worldIdParam && { worldId: worldIdParam }),
        }),
      });

      const data = await res.json();

      if (data.storyId) {
        setStoryId(data.storyId);
        await waitForPagesAndNavigate(data.storyId);
      } else {
        console.error("No storyId returned from create-from-chat", data);
        creationTriggeredRef.current = false;
      }
    } catch (err) {
      console.error("Story creation failed:", err);
      creationTriggeredRef.current = false;
    } finally {
      setStoryCreating(false);
    }
  }

  async function sendMessage() {
    if (!input.trim() || loading) return;

    const text = input.trim();
    const userMessage: ChatMsg = { role: "user", content: text };
    const nextHistory = [...messages, userMessage];

    setMessages(nextHistory);
    setInput("");
    setLoading(true);

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          history: nextHistory,
          projectId,
          ...(worldIdParam && { worldId: worldIdParam }),
        }),
      });

      const data = await res.json();

      const assistantReply =
        data.reply ?? "Hmm, let me think about that again...";

      setMessages((m) => [
        ...m,
        { role: "assistant", content: assistantReply },
      ]);

      // Auto-trigger story creation when Claude signals readiness
      if (data.readyToGenerate && !storyId && !storyCreating) {
        // Small delay so the user sees Claude's reply before the transition
        setTimeout(() => {
          void createStoryFromChat();
        }, 1500);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  if (!projectId) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
      </div>
    );
  }

  // Derive display values
  const isWorldBook = !!worldContext;
  const bookNumber = worldContext?.bookNumber ?? 1;
  const readerName = worldContext?.readerName;
  const worldName = worldContext?.name;

  return (
    <div className="min-h-screen bg-gray-50 overflow-x-hidden">
      {/* Top Bar */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-200/50">
        <div className="px-4 py-3 flex items-center justify-between min-h-[64px]">
          {/* Left */}
          <button
            onClick={() => router.push("/projects")}
            className="flex items-center active:opacity-60 transition-opacity min-h-[44px]"
            aria-label="Back to library"
          >
            <Image
              src="/Flipwhizz_logo_NEW.png"
              alt="FlipWhizz"
              width={150}
              height={150}
              className="h-auto w-[136px] sm:w-[150px]"
            />
          </button>

          {/* Center — world context or sync status */}
          <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2 pointer-events-none">
            {isSyncing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-purple-500" />
                <span className="text-sm font-semibold text-gray-600">Syncing...</span>
              </>
            ) : isWorldBook ? (
              <div className="flex items-center gap-2">
                <Globe2 className="w-4 h-4 text-[#7B5EA7]" />
                <span className="text-sm font-semibold text-gray-700 hidden sm:inline">
                  {worldName} — Book {bookNumber}
                </span>
                <span className="text-sm font-semibold text-gray-700 sm:hidden">
                  Book {bookNumber}
                </span>
              </div>
            ) : null}
          </div>

          {/* Right CTA */}
          <div className="flex items-center justify-end min-w-[120px]">
            {messages.length >= 3 && !storyId ? (
              <button
                onClick={createStoryFromChat}
                disabled={storyCreating}
                className="inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold text-white shadow-lg transition-transform active:scale-[0.98] disabled:opacity-60"
                style={{
                  background: "#D94590",
                  boxShadow: "0 8px 28px rgba(217,69,144,0.25)",
                }}
              >
                {storyCreating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="hidden sm:inline">Creating...</span>
                  </>
                ) : (
                  <>
                    <BookOpen className="w-4 h-4" />
                    <span className="hidden sm:inline">
                      {isWorldBook ? `Create Book ${bookNumber}` : "Create My Book"}
                    </span>
                    <span className="sm:hidden">Create</span>
                  </>
                )}
              </button>
            ) : (
              <div className="w-[120px]" />
            )}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="h-[calc(100vh-64px-140px)] mt-[64px] pt-4 overflow-y-auto px-4">
      <div className="max-w-2xl mx-auto pt-4 pb-4">
          <AnimatePresence>
            {messages.length === 0 && !isSyncing && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="text-center py-16 px-4 space-y-6"
              >
                {/* Icon */}
                <div
                  className="w-20 h-20 mx-auto rounded-3xl flex items-center justify-center shadow-lg"
                  style={{
                    background: isWorldBook
                      ? "linear-gradient(135deg, #7B5EA7, #D94590)"
                      : "linear-gradient(135deg, #A855F7, #EC4899)",
                  }}
                >
                  {isWorldBook ? (
                    <Globe2 className="w-10 h-10 text-white" />
                  ) : (
                    <Sparkles className="w-10 h-10 text-white" />
                  )}
                </div>

                {/* Heading — personalised for world context */}
                <div className="space-y-3">
                  {isWorldBook ? (
                    <>
                      <h1 className="text-3xl sm:text-4xl font-black text-gray-900">
                        {readerName
                          ? `${readerName}'s next adventure`
                          : `Book ${bookNumber} awaits`}
                      </h1>
                      <p className="text-[17px] text-gray-600 leading-relaxed max-w-md mx-auto">
                        {worldContext?.description
                          ? `Back in ${worldName} — ${worldContext.description.toLowerCase()}`
                          : `Continuing the story in ${worldName}. What happens next?`}
                      </p>
                    </>
                  ) : (
                    <>
                      <h1 className="text-4xl font-black text-gray-900">
                        Let&apos;s Create Magic! ✨
                      </h1>
                      <p className="text-[17px] text-gray-600 leading-relaxed max-w-sm mx-auto">
                        Tell me about your character, their world, or the adventure you want to go on
                      </p>
                    </>
                  )}
                </div>

                {/* World context banner */}
                {isWorldBook && (
                  <div
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium"
                    style={{
                      background: "rgba(123,94,167,0.08)",
                      color: "#7B5EA7",
                    }}
                  >
                    <Globe2 className="w-4 h-4" />
                    Characters & world carry forward from{" "}
                    {bookNumber > 1 ? `Book ${bookNumber - 1}` : "this world"}
                  </div>
                )}

                {/* Prompt suggestions — context-aware */}
                <div className="flex flex-wrap gap-2 justify-center pt-4">
                  {isWorldBook
                    ? [
                        {
                          emoji: "🌍",
                          label: "Explore somewhere new",
                          text: "Let's explore somewhere completely new this time",
                        },
                        {
                          emoji: "🤝",
                          label: "New friend",
                          text: "I'd love a story about making a new friend",
                        },
                        {
                          emoji: "🎉",
                          label: "Celebration",
                          text: "Something about a big celebration or festival",
                        },
                      ].map((prompt) => (
                        <button
                          key={prompt.label}
                          onClick={() => setInput(prompt.text)}
                          className="px-4 py-2.5 bg-white border-2 border-gray-200 rounded-full text-sm font-semibold text-gray-700 active:scale-95 transition-transform"
                        >
                          {prompt.emoji} {prompt.label}
                        </button>
                      ))
                    : [
                        {
                          emoji: "🐉",
                          label: "Brave Dragon",
                          text: "A brave dragon who's afraid of heights",
                        },
                        {
                          emoji: "🌳",
                          label: "Magical Forest",
                          text: "A magical forest where trees can talk",
                        },
                        {
                          emoji: "🐬",
                          label: "Ocean Quest",
                          text: "An underwater adventure with friendly dolphins",
                        },
                      ].map((prompt) => (
                        <button
                          key={prompt.label}
                          onClick={() => setInput(prompt.text)}
                          className="px-4 py-2.5 bg-white border-2 border-gray-200 rounded-full text-sm font-semibold text-gray-700 active:scale-95 transition-transform"
                        >
                          {prompt.emoji} {prompt.label}
                        </button>
                      ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="space-y-3">
            {messages.map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.role === "user" ? (
                  <div className="max-w-[85%]">
                    <div className="bg-purple-500 text-white px-5 py-3 rounded-[20px] rounded-tr-[4px] shadow-sm">
                      <p className="text-[16px] leading-[1.4] font-normal whitespace-pre-wrap break-words">
                        {msg.content}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="max-w-[85%]">
                    <div className="flex gap-2 items-end">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-pink-500 flex items-center justify-center flex-shrink-0 shadow-sm">
                        <Sparkles className="w-4 h-4 text-white" />
                      </div>
                      <div className="bg-white px-5 py-3 rounded-[20px] rounded-bl-[4px] shadow-sm border border-gray-100">
                        <p className="text-[16px] leading-[1.4] text-gray-900 font-normal whitespace-pre-wrap break-words">
                          {msg.content}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            ))}

            {loading && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-end gap-2"
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-pink-500 flex items-center justify-center shadow-sm">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <div className="bg-white px-5 py-3 rounded-[20px] rounded-bl-[4px] shadow-sm border border-gray-100 flex gap-1.5">
                  <motion.div
                    animate={{ y: [0, -4, 0] }}
                    transition={{ repeat: Infinity, duration: 0.6, delay: 0 }}
                    className="w-2 h-2 bg-gray-400 rounded-full"
                  />
                  <motion.div
                    animate={{ y: [0, -4, 0] }}
                    transition={{ repeat: Infinity, duration: 0.6, delay: 0.1 }}
                    className="w-2 h-2 bg-gray-400 rounded-full"
                  />
                  <motion.div
                    animate={{ y: [0, -4, 0] }}
                    transition={{ repeat: Infinity, duration: 0.6, delay: 0.2 }}
                    className="w-2 h-2 bg-gray-400 rounded-full"
                  />
                </div>
              </motion.div>
            )}

            {/* Story creation transition state */}
            {storyCreating && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-end gap-2"
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-fuchsia-500 to-pink-500 flex items-center justify-center shadow-sm">
                  <BookOpen className="w-4 h-4 text-white" />
                </div>
                <div className="bg-gradient-to-br from-fuchsia-50 to-pink-50 border border-fuchsia-200 px-5 py-3 rounded-[20px] rounded-bl-[4px] shadow-sm">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-[#D94590]" />
                    <p className="text-[16px] leading-[1.4] text-gray-900 font-semibold">
                      Writing your story…
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            <div ref={bottomRef} />
          </div>
        </div>
      </div>

      {/* Input Area */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-xl border-t border-gray-200/50">
        <div className="px-4 py-3">
          <div className="max-w-2xl mx-auto">
            {messages.length > 0 && messages.length < 3 && (
              <div className="mb-2 px-1">
                <div
                  className="flex items-center gap-2 text-xs font-semibold"
                  style={{ color: "#D94590" }}
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>
                    {3 - messages.length} more message{3 - messages.length !== 1 ? "s" : ""} to unlock book creation
                  </span>
                </div>
              </div>
            )}

            <div className="flex items-end gap-2">
              <div className="flex-1 bg-gray-100 rounded-[20px] min-h-[44px] flex items-center px-4 py-2">
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
                  placeholder={
                    storyCreating
                      ? "Writing your story…"
                      : isWorldBook
                        ? `What happens next in ${worldName}...`
                        : "Message"
                  }
                  disabled={storyCreating}
                  className="w-full max-h-[100px] bg-transparent border-0 focus:ring-0 focus:outline-none text-[16px] text-gray-900 placeholder:text-gray-500 resize-none font-normal disabled:cursor-not-allowed disabled:opacity-60"
                  rows={1}
                  style={{ lineHeight: "1.4" }}
                />
              </div>

              <button
                onClick={sendMessage}
                disabled={!input.trim() || loading || storyCreating}
                className="w-11 h-11 rounded-full flex-shrink-0 flex items-center justify-center transition-all duration-200 active:scale-90"
                style={{
                  background: input.trim() && !storyCreating ? "#D94590" : "#E5E7EB",
                  color: input.trim() && !storyCreating ? "white" : "#9CA3AF",
                  boxShadow: input.trim() && !storyCreating ? "0 3px 12px rgba(217,69,144,0.3)" : "none",
                }}
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" style={{ transform: "translateX(1px)" }} />
                )}
              </button>
            </div>
          </div>
        </div>
        <div className="h-[env(safe-area-inset-bottom)]" />
      </div>
    </div>
  );
}