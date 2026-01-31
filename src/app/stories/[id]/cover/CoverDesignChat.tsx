"use client";

import { useState, useRef, useEffect } from "react";
import {
  Send,
  Loader2,
  Sparkles,
  Palette,
  Wand2,
  Check,
} from "lucide-react";

/* -------------------------------------------------------------------------- */
/*                                   TYPES                                    */
/* -------------------------------------------------------------------------- */

type ChatMsg = {
  role: "user" | "assistant";
  content: string;
};

type Story = {
  id: string;
  projectId: string;
  title: string;

  // ✅ SINGLE COVER MODEL
  coverSpreadUrl: string | null;

  status: string | null;
  pdfUrl: string | null;
};


type Props = {
  storyId: string;
  projectId: string;
  story: Story;
  onComplete: (data: Story) => void;
};

/* -------------------------------------------------------------------------- */
/*                              MAIN COMPONENT                                */
/* -------------------------------------------------------------------------- */

export default function CoverDesignChat({
  storyId,
  story,
  projectId,
  onComplete,
}: Props) {
  /* ----------------------------- LOCAL STATE ----------------------------- */

  const [localStory, setLocalStory] = useState<Story>(story);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isFinalising, setIsFinalising] = useState(false);
  const [isPolling, setIsPolling] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const hasStartedChatRef = useRef(false);

  /* ----------------------------- DERIVED STATE ---------------------------- */

  const hasPrompts =
    !!localStory.coverSpreadUrl ;

  const hasCovers =
    !!localStory.coverSpreadUrl

  const isGeneratingCovers =
    localStory.status === "generating_covers";

  /* ----------------------------- AUTO SCROLL ------------------------------ */

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  /* ----------------------------- START CHAT ONCE -------------------------- */

  useEffect(() => {
    if (hasStartedChatRef.current) return;
    if (!storyId || hasPrompts) return;

    hasStartedChatRef.current = true;

    (async () => {
      try {
        const res = await fetch("/api/stories/cover-chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            storyId,
            message: "Let's design the perfect cover for this story!",
            history: [],
          }),
        });

        const data = await res.json();
        setMessages([{ role: "assistant", content: data.reply }]);
      } catch {
        setMessages([
          {
            role: "assistant",
            content:
              "Sorry — something went wrong starting the cover chat.",
          },
        ]);
      }
    })();
  }, [storyId, hasPrompts]);

  /* ----------------------------- SEND MESSAGE ----------------------------- */

  async function sendMessage() {
    if (!input.trim() || isLoading) return;

    const userMsg: ChatMsg = { role: "user", content: input };
    const nextMessages = [...messages, userMsg];

    setMessages(nextMessages);
    setInput("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/stories/cover-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storyId,
          message: userMsg.content,
          history: messages,
        }),
      });

      const data = await res.json();
      setMessages([...nextMessages, { role: "assistant", content: data.reply }]);
    } catch {
      setMessages([
        ...nextMessages,
        {
          role: "assistant",
          content: "Sorry — something went wrong.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  /* -------------------------- FINALISE COVER PLAN ------------------------- */

  async function finalizeCoverPlan() {
    setIsFinalising(true);

    try {
      const res = await fetch("/api/stories/generate-cover-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storyId,
          conversationHistory: messages,
          mode: "generate",
        }),
      });

      if (!res.ok) throw new Error();

      // Refresh story so prompts are present
      const updated = await fetch(`/api/stories/${storyId}`).then(r => r.json());
      setLocalStory(updated.story);

      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content:
            "Perfect — your cover design is locked. I'll start generating the artwork now.",
        },
      ]);

      await triggerCoverGeneration(updated.story);
    } catch {
      alert("Failed to finalise cover design.");
    } finally {
      setIsFinalising(false);
    }
  }

  /* ------------------------- TRIGGER IMAGE GEN ----------------------------- */

  async function triggerCoverGeneration(updatedStory?: Story) {
    try {
      // Optimistically update local status
      setLocalStory((s) => ({
        ...s,
        status: "generating_covers",
      }));

      await fetch("/api/inngest/trigger-covers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storyId }),
      });
    } catch {
      alert("Failed to start cover generation.");
    }
  }

  /* ------------------------------ POLLING --------------------------------- */

  useEffect(() => {
    if (!isGeneratingCovers || hasCovers) return;

    setIsPolling(true);

    const interval = setInterval(async () => {
      const res = await fetch(`/api/stories/${storyId}`);
      const data = await res.json();

      if (
        data.story?.coverSpreadUrl
      ) {
        clearInterval(interval);
        setIsPolling(false);
        setLocalStory(data.story);
        onComplete(data.story);
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [isGeneratingCovers, hasCovers, storyId, onComplete]);

  /* -------------------------------------------------------------------------- */
  /*                                   RENDER                                   */
  /* -------------------------------------------------------------------------- */

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50 p-4 md:p-8">
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&family=Inter:wght@400;500;600&display=swap');
        
        .cover-chat-container {
          font-family: 'Inter', sans-serif;
        }
        
        .cover-chat-title {
          font-family: 'Fredoka', sans-serif;
        }
        
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
        
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 20px rgba(236, 72, 153, 0.3); }
          50% { box-shadow: 0 0 40px rgba(236, 72, 153, 0.5); }
        }
        
        @keyframes slide-in {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .message-bubble {
          animation: slide-in 0.3s ease-out;
        }
        
        .float-animation {
          animation: float 3s ease-in-out infinite;
        }
        
        .pulse-glow {
          animation: pulse-glow 2s ease-in-out infinite;
        }
      `}</style>

      <div className="cover-chat-container max-w-7xl mx-auto">
        {/* HEADER */}
        <div className="mb-8">
          <h1 className="cover-chat-title text-5xl md:text-6xl font-bold text-pink-500 mb-3">
            Cover Design Studio
          </h1>
          <p className="text-xl text-gray-600">
            Let's create magical book covers together! ✨
          </p>
        </div>

        {/* MAIN CONTAINER */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          {/* CHAT COLUMN */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-[2rem] shadow-lg overflow-hidden">
              {/* CHAT MESSAGES */}
              <div className="h-[500px] md:h-[600px] overflow-y-auto p-6 md:p-8 space-y-6 bg-gradient-to-br from-pink-50/50 via-purple-50/50 to-blue-50/50">
                {messages.length === 0 && !isLoading && (
                  <div className="flex flex-col items-center justify-center h-full text-center">
                    <div className="w-24 h-24 bg-gradient-to-br from-pink-400 to-purple-500 rounded-full flex items-center justify-center mb-6 float-animation">
                      <Sparkles className="text-white w-12 h-12" />
                    </div>
                    <h3 className="cover-chat-title text-2xl font-bold text-gray-800 mb-2">
                      Ready to Create Magic?
                    </h3>
                    <p className="text-gray-600 max-w-md">
                      I'll help you design the perfect book covers by asking about your vision, characters, and style preferences.
                    </p>
                  </div>
                )}

                {messages.map((m, i) => (
                  <div
                    key={i}
                    className={`flex ${m.role === "user" ? "justify-end" : "justify-start"} message-bubble`}
                  >
                    <div
                      className={`max-w-[85%] md:max-w-[75%] p-5 rounded-3xl ${
                        m.role === "user"
                          ? "bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-md"
                          : "bg-white text-gray-800 shadow-sm"
                      }`}
                    >
                      <p className="leading-relaxed">{m.content}</p>
                    </div>
                  </div>
                ))}

                {isLoading && (
                  <div className="flex items-center gap-3 message-bubble">
                    <div className="w-12 h-12 bg-gradient-to-br from-pink-400 to-purple-500 rounded-full flex items-center justify-center">
                      <Loader2 className="animate-spin w-5 h-5 text-white" />
                    </div>
                    <div className="bg-white rounded-3xl px-6 py-3 shadow-sm">
                      <p className="text-gray-600 font-medium">Thinking of creative ideas...</p>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* ACTION AREA */}
              <div className="border-t p-6 md:p-8 bg-white">
                {!hasPrompts ? (
                  <button
                    onClick={finalizeCoverPlan}
                    disabled={isFinalising}
                    className="w-full py-5 rounded-[2rem] bg-gradient-to-r from-pink-500 to-purple-600 text-white font-bold text-lg shadow-lg hover:shadow-xl transition-all hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isFinalising ? (
                      <span className="flex items-center justify-center gap-3">
                        <Loader2 className="animate-spin w-5 h-5" />
                        Creating Your Cover Design...
                      </span>
                    ) : (
                      <span className="flex items-center justify-center gap-3">
                        <Wand2 className="w-5 h-5" />
                        Finalize My Cover Design
                      </span>
                    )}
                  </button>
                ) : !hasCovers ? (
                  <div className="text-center">
                    <div className="inline-flex items-center gap-3 bg-gradient-to-r from-pink-100 to-purple-100 px-8 py-4 rounded-[2rem]">
                      <Loader2 className="animate-spin w-6 h-6 text-pink-600" />
                      <span className="text-pink-700 font-bold text-lg">
                        Generating your beautiful covers...
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-3">
                    <input
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          sendMessage();
                        }
                      }}
                      className="flex-1 border-2 border-gray-200 rounded-[2rem] px-6 py-4 focus:outline-none focus:border-pink-400 focus:ring-4 focus:ring-pink-100 transition-all text-lg"
                      placeholder="Want to make any changes?"
                    />
                    <button
                      onClick={sendMessage}
                      disabled={!input.trim() || isLoading}
                      className="px-8 py-4 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-[2rem] shadow-lg hover:shadow-xl transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Send className="w-6 h-6" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* PREVIEW SIDEBAR */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-[2rem] shadow-lg p-6 md:p-8 sticky top-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-gradient-to-br from-pink-400 to-purple-500 rounded-2xl flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <h3 className="cover-chat-title text-2xl font-bold text-gray-800">
                  Your Covers
                </h3>
              </div>

              {hasCovers ? (
                <div className="space-y-6">
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                        <Check className="w-4 h-4 text-white" />
                      </div>
                      <p className="font-bold text-gray-700">Front Cover</p>
                    </div>
                    <img 
                      src={localStory.coverSpreadUrl!} 
                      alt="Front cover"
                      className="w-full rounded-2xl shadow-md"
                    />
                  </div>
        

                  <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-5">
                    <p className="text-green-700 font-bold text-center">
                      🎉 Covers Complete!
                    </p>
                  </div>
                </div>
              ) : isGeneratingCovers ? (
                <div className="space-y-4">
                  <div className="bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50 rounded-2xl p-8 text-center">
                    <div className="w-16 h-16 bg-gradient-to-br from-pink-400 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-4 float-animation">
                      <Wand2 className="w-8 h-8 text-white" />
                    </div>
                    <p className="text-pink-700 font-bold mb-2">Creating Magic...</p>
                    <p className="text-sm text-gray-600">
                      Your beautiful covers are being generated
                    </p>
                  </div>
                  
                  <div className="space-y-3">
                    {[1, 2].map((i) => (
                      <div key={i} className="bg-gradient-to-br from-pink-100 via-purple-100 to-blue-100 rounded-2xl h-64 animate-pulse" />
                    ))}
                  </div>
                </div>
              ) : (
                <div className="bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50 rounded-2xl p-8 text-center">
                  <div className="w-16 h-16 bg-gradient-to-br from-gray-300 to-gray-400 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Palette className="w-8 h-8 text-white" />
                  </div>
                  <p className="text-gray-600 font-medium mb-2">Cover Preview</p>
                  <p className="text-sm text-gray-500">
                    Your designs will appear here once we finalize the plan
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}