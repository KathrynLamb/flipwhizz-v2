"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send,
  Sparkles,
  ArrowLeft,
  Loader2,
  BookOpen,
  Wand2,
  CheckCircle,
  RefreshCcw,
} from "lucide-react";

type ChatMsg = { role: "user" | "assistant"; content: string };

export default function CoverDesignPage({
  storyId,
  storyTitle,
  storySummary, // Need this for the initial pitch
  characters,   // Need this for the initial pitch
  existingCover,
}: {
  storyId: string;
  storyTitle: string;
  storySummary?: string;
  characters?: any[];
  existingCover?: string | null;
}) {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [coverUrl, setCoverUrl] = useState(existingCover);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // --- INITIAL PITCH (Auto-start) ---
  useEffect(() => {
    if (messages.length === 0 && !coverUrl) {
      // Trigger the AI to "Pitch" a concept immediately
      const startPitch = async () => {
        setLoading(true);
        try {
          const res = await fetch("/api/cover/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              storyId,
              storyTitle,
              storySummary,
              characters,
              history: [], // Empty history triggers the "Phase 1: Pitch" logic in your backend
            }),
          });
          const data = await res.json();
          setMessages([{ role: "assistant", content: data.reply }]);
        } catch (e) {
          console.error(e);
        } finally {
          setLoading(false);
        }
      };
      startPitch();
    }
  }, []); // Run once on mount

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

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
      const res = await fetch("/api/cover/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storyId,
          storyTitle,
          storySummary,
          characters,
          message: text,
          history: nextHistory,
        }),
      });

      const data = await res.json();
      const assistantMessage: ChatMsg = {
        role: "assistant",
        content: data.reply ?? "Let me think about that...",
      };

      setMessages((m) => [...m, assistantMessage]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }
  
async function generateCover() {
    if (generating) return;

    setGenerating(true);

    try {
      const res = await fetch("/api/cover/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storyId,
          storyTitle,
          chatHistory: messages,
        }),
      });

      const data = await res.json();

      if (data.jobId) {
        // Poll for result
        const pollInterval = setInterval(async () => {
          try {
            // ✅ FIX: Add try/catch inside the interval to prevent "Failed to fetch" crashes
            const pollRes = await fetch(`/api/cover/status?jobId=${data.jobId}`);
            
            if (!pollRes.ok) {
               // If server errors (500), just ignore this tick and try again next time
               console.warn("Polling endpoint error", pollRes.status);
               return; 
            }

            const pollData = await pollRes.json();

            if (pollData.coverUrl) {
              clearInterval(pollInterval);
              setCoverUrl(pollData.coverUrl);
              setGenerating(false);
            }
          } catch (e) {
            // Ignore network errors during polling (waiting for server restart etc)
            console.warn("Polling skipped tick:", e);
          }
        }, 2000);

        // Timeout after 2.5 minutes (Gemini Pro is slow)
        setTimeout(() => {
          clearInterval(pollInterval);
          if (generating) {
            setGenerating(false);
            alert("Generation timed out. Please try again.");
          }
        }, 150000);
      }
    } catch (err) {
      console.error(err);
      alert("Failed to start generation");
      setGenerating(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <button
            onClick={() => window.history.back()}
            className="flex items-center gap-2 text-gray-500 hover:text-black transition-colors font-medium text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Story</span>
          </button>

          <h1 className="font-bold text-lg hidden md:block">{storyTitle}</h1>

          {coverUrl && !generating ? (
            <div className="flex items-center gap-2 text-emerald-600 font-bold text-sm bg-emerald-50 px-3 py-1.5 rounded-full">
              <CheckCircle className="w-4 h-4" />
              <span>Cover Ready</span>
            </div>
          ) : (
            <div className="w-24" /> // Spacer
          )}
        </div>
      </div>

      <div className="pt-28 pb-10 px-6 max-w-7xl mx-auto grid lg:grid-cols-12 gap-8 h-[calc(100vh-20px)]">
        
        {/* LEFT: CHAT INTERFACE (Takes up 7 cols) */}
        <div className="lg:col-span-7 flex flex-col h-full bg-white rounded-[2rem] border border-gray-100 shadow-xl shadow-gray-200/50 overflow-hidden relative">
          
          {/* Chat Header */}
          <div className="p-6 border-b border-gray-50 bg-white z-10">
            <h2 className="text-2xl font-black bg-gradient-to-r from-violet-600 to-fuchsia-600 bg-clip-text text-transparent">
              Design Studio
            </h2>
            <p className="text-gray-500 text-sm mt-1">
              Collaborate with AI to create your wrap-around cover.
            </p>
          </div>

          {/* Messages Scroll Area */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-white">
            <AnimatePresence>
              {messages.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {msg.role === "user" ? (
                    <div className="max-w-[80%] bg-black text-white px-5 py-3 rounded-[1.5rem] rounded-tr-sm shadow-md">
                      <p className="text-sm font-medium leading-relaxed">{msg.content}</p>
                    </div>
                  ) : (
                    <div className="max-w-[90%] flex gap-4">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center flex-shrink-0 shadow-lg shadow-violet-200">
                        <Sparkles className="w-4 h-4 text-white" />
                      </div>
                      <div className="bg-gray-50 px-6 py-4 rounded-[1.5rem] rounded-tl-sm border border-gray-100 shadow-sm">
                        {/* Render simple markdown-ish formatting for emphasis */}
                        <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap font-medium">
                          {msg.content}
                        </div>
                      </div>
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>

            {loading && (
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-4"
            >
                {/* AI Avatar */}
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-violet-200 shrink-0">
                <Sparkles className="w-4 h-4 text-white" />
                </div>

                {/* Loading Bubble */}
                <div className="bg-gray-100 px-5 py-3 rounded-[1.5rem] rounded-tl-sm flex items-center gap-3 shadow-sm">
                <Loader2 className="w-4 h-4 text-violet-600 animate-spin" />
                <span className="text-sm font-medium text-gray-500">
                    Dreaming up ideas...
                </span>
                </div>
            </motion.div>
            )}

            <div ref={bottomRef} className="h-4" />
          </div>

          {/* Input Area */}
          <div className="p-4 bg-white border-t border-gray-50">
            <div className={`bg-gray-50 rounded-[1.5rem] border-2 transition-all duration-300 ${input.trim() ? 'border-violet-500 bg-white shadow-lg shadow-violet-100' : 'border-transparent'}`}>
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
                  placeholder="Type your feedback here..."
                  className="w-full max-h-32 bg-transparent border-0 focus:ring-0 focus:outline-none text-base text-gray-900 placeholder:text-gray-400 py-3 px-4 resize-none font-medium"
                  rows={1}
                />
                <button
                  onClick={sendMessage}
                  disabled={!input.trim() || loading}
                  className={`mb-1 mr-1 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 ${
                    input.trim() 
                      ? "bg-violet-600 text-white hover:scale-110 hover:shadow-lg active:scale-95" 
                      : "bg-gray-200 text-gray-400 cursor-not-allowed"
                  }`}
                >
                  <Send className="w-4 h-4 ml-0.5" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT: PREVIEW & ACTIONS (Takes up 5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-6 h-full">
          
          {/* Preview Card */}
          <div className="bg-white rounded-[2rem] p-3 shadow-xl shadow-gray-200/50 border border-gray-100 flex-1 flex flex-col">
            <div className="relative w-full flex-1 bg-gray-50 rounded-[1.5rem] overflow-hidden group border border-gray-100">
              
              {/* LOADING STATE */}
              <AnimatePresence>
                {generating && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 z-20 bg-white/90 backdrop-blur-sm flex flex-col items-center justify-center p-8 text-center"
                  >
                    <div className="relative mb-6">
                      <div className="absolute inset-0 bg-violet-500 blur-2xl opacity-20 animate-pulse rounded-full" />
                      <Loader2 className="relative w-12 h-12 text-violet-600 animate-spin" />
                    </div>
                    <h3 className="text-xl font-bold text-violet-950 mb-2">Painting your cover...</h3>
                    <p className="text-gray-500 text-sm max-w-xs">
                      This takes about a minute. The AI is blending your characters into the scene.
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* EMPTY STATE */}
              {!generating && !coverUrl && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 p-8 text-center">
                  <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-6">
                    <BookOpen className="w-8 h-8 text-gray-300" />
                  </div>
                  <h4 className="text-gray-900 font-bold mb-2">Ready to Create</h4>
                  <p className="text-sm">
                    Chat with the designer on the left to refine your concept, then click Generate below.
                  </p>
                </div>
              )}

              {/* IMAGE DISPLAY */}
              {coverUrl && (
                <div className="relative w-full h-full">
                  <img
                    src={coverUrl}
                    alt="Book cover"
                    className="w-full h-full object-contain bg-gray-100" 
                  />
                  {/* Spine Indicator Overlay (Optional) */}
                  <div className="absolute top-0 bottom-0 left-1/2 w-px bg-white/30 border-l border-r border-black/10" />
                  
                  <div className="absolute bottom-4 left-4 bg-black/50 backdrop-blur text-white text-[10px] font-bold px-3 py-1 rounded-full">
                    BACK COVER
                  </div>
                  <div className="absolute bottom-4 right-4 bg-black/50 backdrop-blur text-white text-[10px] font-bold px-3 py-1 rounded-full">
                    FRONT COVER
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="mt-4 px-2 pb-2">
              <button
                onClick={generateCover}
                disabled={generating || messages.length < 1}
                className={`w-full relative overflow-hidden py-4 rounded-xl font-bold text-lg shadow-xl transition-all active:scale-[0.98] flex items-center justify-center gap-3
                  ${messages.length < 1 ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-gray-900 text-white hover:bg-black hover:shadow-2xl'}
                `}
              >
                {generating ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Generating...</span>
                  </>
                ) : coverUrl ? (
                  <>
                    <RefreshCcw className="w-5 h-5" />
                    <span>Regenerate Cover</span>
                  </>
                ) : (
                  <>
                    <Wand2 className="w-5 h-5" />
                    <span>Generate Cover</span>
                  </>
                )}
              </button>
              
              {!coverUrl && messages.length > 0 && (
                <p className="text-center text-xs text-gray-400 mt-3 font-medium">
                  Click generate whenever you're happy with the plan.
                </p>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}