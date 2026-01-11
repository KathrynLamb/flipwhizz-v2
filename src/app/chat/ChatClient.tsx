"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Send, 
  Sparkles, 
  ArrowLeft,
  Loader2, 
  Zap,
  BookOpen
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

  // Initial Load
  useEffect(() => {
    async function initializeStudio() {
      if (!projectId) return;

      try {
        const chatRes = await fetch(`/api/chat/history?projectId=${projectId}`);
        const chatData = await chatRes.json();
        if (chatData.messages) {
          setMessages(chatData.messages);
        }

        const storyRes = await fetch(`/api/stories/by-project?projectId=${projectId}`);
        const storyData = await storyRes.json();
        if (storyData.storyId) {
          router.push(`/stories/${storyData.storyId}/hub`);
        }
      } catch (err) {
        console.error("Studio sync failed:", err);
      } finally {
        setIsSyncing(false);
      }
    }
    initializeStudio();
  }, [projectId, router]);

  // Auto-scroll
  useEffect(() => {
    if (projectId && messages.length > 0) {
      localStorage.setItem(`chat_backup_${projectId}`, JSON.stringify(messages));
    }
    setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  }, [messages, projectId]);

  // Auto-resize textarea
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
      const assistantMessage: ChatMsg = {
        role: "assistant",
        content: data.reply ?? "Hmm, let me think about that again...",
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
        router.push(`/stories/${data.storyId}/hub`);
      }
    } catch (err) {
      console.error("Story creation failed:", err);
    } finally {
      setStoryCreating(false);
    }
  }
  
  if (!projectId) return (
    <div className="flex h-screen items-center justify-center bg-white">
      <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
    </div>
  );

  return (
    <div className="min-h-screen bg-white">
      
      {/* Top Bar */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <button
            onClick={() => router.push("/projects")}
            className="flex items-center gap-2 text-gray-600 hover:text-black transition-colors font-medium"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Projects</span>
          </button>

          <div className="flex items-center gap-2 px-4 py-2 bg-purple-100 rounded-full">
            {isSyncing ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin text-purple-600" />
                <span className="text-sm font-bold text-purple-900">Syncing...</span>
              </>
            ) : (
              <>
                <div className="w-2 h-2 rounded-full bg-purple-500" />
                <span className="text-sm font-bold text-purple-900">Saved</span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="pt-24 pb-32 px-6">
        <div className="max-w-4xl mx-auto">
          
          {/* Welcome State */}
          <AnimatePresence>
            {messages.length === 0 && !isSyncing && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, y: -20 }}
                className="text-center py-24 space-y-8"
              >
                <div className="inline-flex items-center gap-2 mb-4">
                  {[...Array(3)].map((_, i) => (
                    <div
                      key={i}
                      className="w-3 h-3 rounded-full bg-gradient-to-r from-pink-500 to-purple-500"
                    />
                  ))}
                </div>

                <h1 className="text-7xl font-black bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 bg-clip-text text-transparent mb-6">
                  Let's Write!
                </h1>
                
                <p className="text-xl text-gray-600 max-w-2xl mx-auto font-medium">
                  Tell me about a character, a magical place, or an adventure. I'll help bring your story to life! ✨
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Messages */}
          <div className="space-y-6">
            {messages.map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.role === "user" ? (
                  <div className="max-w-[80%]">
                    <div className="bg-gradient-to-br from-purple-500 to-pink-500 text-white px-6 py-4 rounded-3xl shadow-lg">
                      <p className="text-base font-medium leading-relaxed">{msg.content}</p>
                    </div>
                  </div>
                ) : (
                  <div className="max-w-[85%]">
                    <div className="flex gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-pink-500 flex items-center justify-center flex-shrink-0">
                        <Sparkles className="w-5 h-5 text-white" />
                      </div>
                      <div className="bg-gray-100 text-gray-900 px-6 py-4 rounded-3xl shadow-sm">
                        <p className="text-base font-medium leading-relaxed">{msg.content}</p>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            ))}

            {/* Loading */}
            {loading && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center gap-3"
              >
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-pink-500 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <div className="flex gap-2">
                  <motion.div 
                    animate={{ scale: [1, 1.2, 1] }} 
                    transition={{ repeat: Infinity, duration: 0.8 }}
                    className="w-2 h-2 bg-purple-500 rounded-full" 
                  />
                  <motion.div 
                    animate={{ scale: [1, 1.2, 1] }} 
                    transition={{ repeat: Infinity, duration: 0.8, delay: 0.2 }}
                    className="w-2 h-2 bg-pink-500 rounded-full" 
                  />
                  <motion.div 
                    animate={{ scale: [1, 1.2, 1] }} 
                    transition={{ repeat: Infinity, duration: 0.8, delay: 0.4 }}
                    className="w-2 h-2 bg-blue-500 rounded-full" 
                  />
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
          initial={{ opacity: 0, y: 100, scale: 0.8 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: "spring", damping: 20 }}
          className="fixed bottom-32 right-6 z-50"
        >
          <button
            onClick={createStoryFromChat}
            disabled={storyCreating}
            className="
              group relative
              bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500
              text-white rounded-2xl
              px-6 py-4
              font-black text-base
              shadow-2xl
              hover:scale-105 active:scale-95
              transition-transform
              disabled:opacity-70
              flex items-center gap-3
            "
          >
            {/* Pulse ring */}
            {!storyCreating && (
              <span className="absolute -inset-1 bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 rounded-2xl opacity-75 blur-lg animate-pulse" />
            )}
            
            <span className="relative flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center text-2xl">
                {storyCreating ? <Loader2 className="w-6 h-6 animate-spin" /> : "📖"}
              </div>
              
              <div className="text-left">
                <div className="text-sm opacity-90">Ready!</div>
                <div className="text-base font-black">Create My Book</div>
              </div>
            </span>
          </button>
        </motion.div>
      )}

      {/* Input Area */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-gradient-to-t from-white via-white to-transparent pt-8 pb-6">
        <div className="max-w-4xl mx-auto px-6">
          <div className={`
            relative bg-white rounded-3xl border-4 transition-colors
            ${input.trim() ? 'border-purple-500' : 'border-black'}
            shadow-2xl overflow-hidden
          `}>
            <div className="flex items-end gap-2 p-2">
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
                placeholder="Tell me about your story..."
                className="
                  w-full max-h-32 bg-transparent border-0 
                  focus:ring-0 focus:outline-none
                  text-lg text-black placeholder:text-gray-400
                  py-4 px-6 resize-none font-medium
                "
                rows={1}
              />
              
              <button
                onClick={sendMessage}
                disabled={!input.trim() || loading}
                className={`
                  mb-2 mr-2 w-12 h-12 rounded-2xl
                  flex items-center justify-center
                  transition-all duration-300
                  ${input.trim() 
                    ? "bg-black text-white hover:scale-110 active:scale-95 shadow-lg" 
                    : "bg-gray-200 text-gray-400 cursor-not-allowed"}
                `}
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
              </button>
            </div>
            
            {/* Progress Indicator */}
            {messages.length > 0 && messages.length < 3 && (
              <div className="px-6 pb-3">
                <div className="flex items-center gap-2 text-xs font-bold text-purple-600">
                  <Zap className="w-3 h-3" />
                  <span>{3 - messages.length} more detail{3 - messages.length !== 1 ? 's' : ''} to create your book</span>
                </div>
              </div>
            )}
          </div>

          <div className="mt-3 text-center text-xs font-medium text-gray-400">
            Press Enter to send • Shift + Enter for new line
          </div>
        </div>
      </div>
    </div>
  );
}