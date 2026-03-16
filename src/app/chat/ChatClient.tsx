"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { 
  Send, 
  Sparkles, 
  ArrowLeft,
  Loader2, 
  Zap,
  BookOpen,
  LogOut
} from "lucide-react";

type ChatMsg = { role: "user" | "assistant"; content: string };

export default function ChatPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = useMemo(() => searchParams.get("project"), [searchParams]);
  
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(true);
  const [storyCreating, setStoryCreating] = useState(false);
  const [storyId, setStoryId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  async function waitForPagesAndNavigate(storyId: string) {
    for (let attempt = 0; attempt < 30; attempt++) {
      try {
        const res = await fetch(`/api/stories/${storyId}/pages`);
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          router.push(`/stories/${storyId}/pages`);
          return;
        }
      } catch (err) {
        console.error("Polling error:", err);
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
    router.push(`/stories/${storyId}/pages`);
  }

  useEffect(() => {
    async function initializeStudio() {
      if (!projectId) return;
      try {
        const chatRes = await fetch(`/api/chat/history?projectId=${projectId}`);
        const chatData = await chatRes.json();

        if (chatData.messages) setMessages(chatData.messages);

        const storyRes = await fetch(`/api/stories/by-project?projectId=${projectId}`);
        const storyData = await storyRes.json();
        if (storyData.storyId) await waitForPagesAndNavigate(storyData.storyId);
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

  async function sendMessage() {
    if (!input.trim() || loading) return;
    const text = input.trim();
    const userMessage: ChatMsg = { role: "user", content: text };
    const nextHistory = [...messages, userMessage];
    setMessages(nextHistory);
    setInput("");
    setLoading(true);
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history: nextHistory, projectId }),
      });
      const data = await res.json();
      setMessages((m) => [...m, { role: "assistant", content: data.reply ?? "Hmm, let me think about that again..." }]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

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
        await waitForPagesAndNavigate(data.storyId);
      }
    } catch (err) {
      console.error("Story creation failed:", err);
    } finally {
      setStoryCreating(false);
    }
  }
  
  if (!projectId) return (
    <div className="flex h-screen items-center justify-center bg-gray-50">
      <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      
      {/* Top Bar */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-200/50">
        <div className="px-4 py-3 flex items-center justify-between">
          {/* Back to stories */}
          <button
            onClick={() => router.push("/projects")}
            className="flex items-center gap-1.5 active:opacity-60 transition-opacity font-semibold text-[15px] min-h-[44px] -ml-2 pl-2 pr-3"
            style={{ color: "#D94590" }}
          >
                   <Image src="/Flipwhizz_logo_NEW.png" alt="/" width={150} height={150} />
          </button>

          {/* Centre: Logo + Story Studio */}
          <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2">
            {isSyncing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-purple-500" />
                <span className="text-sm font-semibold text-gray-600">Syncing...</span>
              </>
            ) : (
              <>

                <span className=" text-lg font-extrabold tracking-tight bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 bg-clip-text text-transparent">
                  Story Studio
                </span>
              </>
            )}
          </div>

          {/* Right spacer */}
          <div className="w-16" />
        </div>
      </div>

      {/* Messages Container */}
      <div className="pt-[60px] pb-[140px] px-4">
        <div className="max-w-2xl mx-auto">
          
          {/* Welcome State */}
          <AnimatePresence>
            {messages.length === 0 && !isSyncing && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="text-center py-16 px-4 space-y-6"
              >
                <div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg">
                  <Sparkles className="w-10 h-10 text-white" />
                </div>

                <div className="space-y-3">
                  <h1 className="text-4xl font-black text-gray-900">
                    Let's Create Magic! ✨
                  </h1>
                  
                  <p className="text-[17px] text-gray-600 leading-relaxed max-w-sm mx-auto">
                    Tell me about your character, their world, or the adventure you want to go on
                  </p>
                </div>

                <div className="flex flex-wrap gap-2 justify-center pt-4">
                  <button 
                    onClick={() => setInput("A brave dragon who's afraid of heights")}
                    className="px-4 py-2.5 bg-white border-2 border-gray-200 rounded-full text-sm font-semibold text-gray-700 active:scale-95 transition-transform"
                  >
                    🐉 Brave Dragon
                  </button>
                  <button 
                    onClick={() => setInput("A magical forest where trees can talk")}
                    className="px-4 py-2.5 bg-white border-2 border-gray-200 rounded-full text-sm font-semibold text-gray-700 active:scale-95 transition-transform"
                  >
                    🌳 Magical Forest
                  </button>
                  <button 
                    onClick={() => setInput("An underwater adventure with friendly dolphins")}
                    className="px-4 py-2.5 bg-white border-2 border-gray-200 rounded-full text-sm font-semibold text-gray-700 active:scale-95 transition-transform"
                  >
                    🐬 Ocean Quest
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Messages */}
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

            {/* Typing Indicator */}
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
                  <motion.div animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0 }} className="w-2 h-2 bg-gray-400 rounded-full" />
                  <motion.div animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.1 }} className="w-2 h-2 bg-gray-400 rounded-full" />
                  <motion.div animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.2 }} className="w-2 h-2 bg-gray-400 rounded-full" />
                </div>
              </motion.div>
            )}

            <div ref={bottomRef} />
          </div>
        </div>
      </div>

      {/* Floating Create Story Button */}
      {messages.length >= 3 && !storyId && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.9 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="fixed bottom-[100px] left-0 right-0 z-40 px-4"
        >
          <div className="max-w-2xl mx-auto">
            <button
              onClick={createStoryFromChat}
              disabled={storyCreating}
              className="w-full text-white rounded-2xl px-6 py-4 font-bold text-[17px] shadow-lg active:scale-[0.98] transition-transform disabled:opacity-60 flex items-center justify-center gap-3 min-h-[56px]"
              style={{ background: "#D94590", boxShadow: "0 8px 28px rgba(217,69,144,0.3)" }}
            >
              {storyCreating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Creating Your Book...</span>
                </>
              ) : (
                <>
                  <BookOpen className="w-5 h-5" />
                  <span>Create My Book</span>
                  <span className="text-2xl">📖</span>
                </>
              )}
            </button>
          </div>
        </motion.div>
      )}

      {/* Input Area */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-xl border-t border-gray-200/50">
        <div className="px-4 py-3">
          <div className="max-w-2xl mx-auto">
            
            {/* Progress Indicator */}
            {messages.length > 0 && messages.length < 3 && (
              <div className="mb-2 px-1">
                <div className="flex items-center gap-2 text-xs font-semibold" style={{ color: "#D94590" }}>
                  <Zap className="w-3.5 h-3.5" />
                  <span>{3 - messages.length} more message{3 - messages.length !== 1 ? 's' : ''} to unlock book creation</span>
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
                  placeholder="Message"
                  className="w-full max-h-[100px] bg-transparent border-0 focus:ring-0 focus:outline-none text-[16px] text-gray-900 placeholder:text-gray-500 resize-none font-normal"
                  rows={1}
                  style={{ lineHeight: '1.4' }}
                />
              </div>
              
              <button
                onClick={sendMessage}
                disabled={!input.trim() || loading}
                className="w-11 h-11 rounded-full flex-shrink-0 flex items-center justify-center transition-all duration-200 active:scale-90"
                style={{
                  background: input.trim() ? "#D94590" : "#E5E7EB",
                  color: input.trim() ? "white" : "#9CA3AF",
                  boxShadow: input.trim() ? "0 3px 12px rgba(217,69,144,0.3)" : "none",
                }}
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" style={{ transform: 'translateX(1px)' }} />
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