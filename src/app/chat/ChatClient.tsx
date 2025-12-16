"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Sparkles, PenTool, CheckCircle, RotateCcw, BookOpen } from "lucide-react";

type ChatMsg = { role: "user" | "assistant"; content: string };

export default function ChatPage() {
  const searchParams = useSearchParams();
  const projectId = useMemo(() => searchParams.get("project"), [searchParams]);
  
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(true);
  const [storyCreating, setStoryCreating] = useState(false);
  const [storyId, setStoryId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  // 1. Initial Load: Sync everything from Database
  useEffect(() => {
    async function initializeStudio() {
      if (!projectId) return;

      try {
        // Fetch Chat History
        const chatRes = await fetch(`/api/chat/history?projectId=${projectId}`);
        const chatData = await chatRes.json();
        if (chatData.messages) {
          setMessages(chatData.messages);
        }

        // Check for Existing Story
        const storyRes = await fetch(`/api/stories/by-project?projectId=${projectId}`);
        const storyData = await storyRes.json();
        if (storyData.storyId) {
          setStoryId(storyData.storyId);
        }
      } catch (err) {
        console.error("Studio sync failed:", err);
      } finally {
        setIsSyncing(false);
      }
    }
    initializeStudio();
  }, [projectId]);

  // 2. Auto-scroll and Local Backup
  useEffect(() => {
    if (projectId && messages.length > 0) {
      localStorage.setItem(`chat_backup_${projectId}`, JSON.stringify(messages));
    }
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, projectId]);

  // 3. Core Functions
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
        body: JSON.stringify({ message: text, history: nextHistory, projectId }),
      });

      const data = await res.json();
      const assistantMessage: ChatMsg = {
        role: "assistant",
        content: data.reply ?? "(The ink paused... please try again)",
      };

      setMessages((m) => [...m, assistantMessage]);
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
      }
    } catch (err) {
      console.error("Story creation failed:", err);
    } finally {
      setStoryCreating(false);
    }
  }

  if (!projectId) return <div className="p-20 text-center font-serif text-stone-400">Project context required to begin.</div>;

  return (
    <div className="min-h-screen bg-[#FAF9F6] text-[#1A1A1A] font-sans selection:bg-indigo-100">
      {/* --- NAV BAR --- */}
      <nav className="fixed top-0 w-full z-50 bg-[#FAF9F6]/80 backdrop-blur-md border-b border-stone-200/60">
        <div className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="bg-indigo-600 p-2.5 rounded-xl shadow-lg shadow-indigo-200">
              <Sparkles className="text-white w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-serif italic font-semibold tracking-tight">FlipWhizz Studio</h1>
              <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-stone-400">
                {isSyncing ? (
                  <><RotateCcw className="w-3 h-3 animate-spin" /> Syncing Manuscript...</>
                ) : (
                  <><CheckCircle className="w-3 h-3 text-emerald-500" /> Scribed to Library</>
                )}
              </span>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto pt-32 pb-48 px-6">
        <AnimatePresence>
          {messages.length === 0 && !isSyncing && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center py-20">
              <h2 className="text-5xl font-serif leading-[1.1] mb-6">
                Tell me about the magic <br/> 
                <span className="italic text-indigo-600">waiting to be written.</span>
              </h2>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="space-y-10">
          {messages.map((msg, i) => (
            <motion.div 
              initial={{ opacity: 0, y: 10 }} 
              animate={{ opacity: 1, y: 0 }} 
              key={i} 
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div className={`max-w-[85%] text-lg leading-relaxed ${
                msg.role === "user" 
                ? "bg-indigo-600 text-white px-6 py-4 rounded-3xl rounded-tr-none shadow-xl shadow-indigo-100" 
                : "text-stone-800 border-l-2 border-stone-200 pl-8 py-2 italic font-serif"
              }`}>
                {msg.content}
              </div>
            </motion.div>
          ))}

          {/* MILESTONE ACTION */}
          {messages.length >= 3 && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center gap-4 py-16 border-t border-stone-100 mt-20"
            >
              <div className="text-center space-y-2 mb-4">
                <h3 className="font-serif italic text-2xl">The ink is ready...</h3>
                <p className="text-sm text-stone-500">I have enough magic to begin drafting your heirloom.</p>
              </div>

              <button
                onClick={createStoryFromChat}
                disabled={storyCreating}
                className="group relative px-10 py-5 bg-indigo-600 text-white rounded-full font-bold shadow-2xl shadow-indigo-200 hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-70"
              >
                {storyCreating ? (
                  <span className="flex items-center gap-3">
                    <RotateCcw className="w-5 h-5 animate-spin" />
                    Weaving the tale...
                  </span>
                ) : (
                  <span className="flex items-center gap-3">
                    <Sparkles className="w-5 h-5 text-indigo-200" />
                    Create Story Book
                  </span>
                )}
              </button>
              
              {storyId && (
                <a
                  href={`/stories/${storyId}`}
                  className="mt-4 px-6 py-2 border border-stone-200 rounded-full text-sm font-bold text-stone-600 hover:bg-stone-50 transition-colors flex items-center gap-2"
                >
                  <BookOpen className="w-4 h-4 text-indigo-600" />
                  Open Existing Draft
                </a>
              )}
            </motion.div>
          )}

          {loading && (
            <div className="flex gap-2 pl-8">
              <div className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-pulse" />
              <div className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-pulse delay-75" />
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </main>

      {/* --- INPUT AREA --- */}
      <div className="fixed bottom-10 w-full px-6 pointer-events-none">
        <div className="max-w-3xl mx-auto pointer-events-auto">
          <div className="bg-white/80 backdrop-blur-xl border border-stone-200 rounded-[2.5rem] p-2 shadow-2xl shadow-stone-200/50">
            <div className="flex items-center gap-2">
              <div className="p-4 text-stone-400">
                <PenTool className="w-5 h-5" />
              </div>
              <textarea
                className="flex-1 bg-transparent py-4 text-lg focus:outline-none resize-none placeholder:text-stone-300"
                placeholder="Share a detail..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                rows={1}
              />
              <button 
                onClick={sendMessage}
                className="bg-black text-white p-4 rounded-full hover:scale-105 transition-transform active:scale-95"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
          <p className="text-center text-[10px] text-stone-400 font-bold uppercase tracking-widest mt-6">
            Review all AI drafted content before finalized printing.
          </p>
        </div>
      </div>
    </div>
  );
}