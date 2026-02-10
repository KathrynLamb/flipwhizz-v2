// src/app/stories/[id]/cover/CoverDesignChat.tsx
"use client";

import { useState, useRef, useEffect } from "react";
import {
  Send,
  Loader2,
  Sparkles,
  Wand2,
  Check,
  ChevronLeft,
  RefreshCw,
  ImagePlus,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

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
  coverSpreadUrl: string | null;
  status: string | null;
  pdfUrl: string | null;
};

type Props = {
  storyId: string;
  projectId: string;
  story: Story;
  initialMessages: ChatMsg[];
};

/* -------------------------------------------------------------------------- */
/*                              MAIN COMPONENT                                */
/* -------------------------------------------------------------------------- */

export default function CoverDesignChat({
  storyId,
  story,
  projectId,
  initialMessages,
}: Props) {
  const router = useRouter();
  
  /* ----------------------------- LOCAL STATE ----------------------------- */

  const [localStory, setLocalStory] = useState<Story>(story);
  const [messages, setMessages] = useState<ChatMsg[]>(initialMessages);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isFinalising, setIsFinalising] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const hasStartedChatRef = useRef(false);

  /* ----------------------------- DERIVED STATE ---------------------------- */

  const hasCovers = !!localStory.coverSpreadUrl;
  const isGeneratingCovers = localStory.status === "generating_covers";

  /* ----------------------------- AUTO SCROLL ------------------------------ */

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  /* ------------------------------ POLLING --------------------------------- */

  useEffect(() => {
    if (!isGeneratingCovers) return;

    const interval = setInterval(async () => {
      const res = await fetch(`/api/stories/${storyId}`);
      const data = await res.json();

      if (data.story?.coverSpreadUrl) {
        clearInterval(interval);
        setLocalStory(data.story);

        // Add auto-message when cover is ready
        const autoMessage: ChatMsg = {
          role: "assistant",
          content: "🎉 Your cover is ready! Take a look at the preview on the right. What do you think? Feel free to ask for any changes you'd like!",
        };
        
        setMessages(prev => [...prev, autoMessage]);

        // Save to database
        fetch("/api/stories/cover-chat/save-message", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            storyId,
            role: "assistant",
            content: autoMessage.content,
          }),
        }).catch(() => {});
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [isGeneratingCovers, storyId]);

  /* ----------------------------- START CHAT ONCE -------------------------- */

  useEffect(() => {
    if (hasStartedChatRef.current) return;
    if (!storyId) return;
    
    if (initialMessages.length > 0) {
      hasStartedChatRef.current = true;
      return;
    }

    if (hasCovers) return;

    hasStartedChatRef.current = true;
    setIsLoading(true);

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
            content: "Sorry — something went wrong starting the cover chat.",
          },
        ]);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [storyId, hasCovers, initialMessages.length]);

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

      const updated = await fetch(`/api/stories/${storyId}`).then(r => r.json());
      setLocalStory(updated.story);

      const lockMessage: ChatMsg = {
        role: "assistant",
        content: "Perfect — your cover design is locked. I'll start generating the artwork now. This may take 30-60 seconds...",
      };

      setMessages((m) => [...m, lockMessage]);

      // Save message
      fetch("/api/stories/cover-chat/save-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storyId,
          role: "assistant",
          content: lockMessage.content,
        }),
      }).catch(() => {});

      await triggerCoverGeneration();
    } catch {
      alert("Failed to finalise cover design.");
    } finally {
      setIsFinalising(false);
    }
  }

  /* ------------------------- TRIGGER/REGENERATE ----------------------------- */

  async function triggerCoverGeneration() {
    try {
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

  async function handleRegenerateWithFeedback(feedback: string) {
    // Add user feedback as a message
    const feedbackMsg: ChatMsg = {
      role: "user",
      content: feedback,
    };

    setMessages(prev => [...prev, feedbackMsg]);

    // Save feedback message
    await fetch("/api/stories/cover-chat/save-message", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        storyId,
        role: "user",
        content: feedback,
      }),
    }).catch(() => {});

    // Update cover plan with feedback
    try {
      await fetch("/api/stories/generate-cover-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storyId,
          conversationHistory: [...messages, feedbackMsg],
          feedback,
          mode: "regenerate",
        }),
      });

      const regenMsg: ChatMsg = {
        role: "assistant",
        content: "Got it! I'll regenerate the cover with your feedback. This will take about 30-60 seconds...",
      };

      setMessages(prev => [...prev, regenMsg]);

      // Save assistant response
      await fetch("/api/stories/cover-chat/save-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storyId,
          role: "assistant",
          content: regenMsg.content,
        }),
      }).catch(() => {});

      await triggerCoverGeneration();
    } catch {
      alert("Failed to process feedback.");
    }
  }

  /* ----------------------------- APPROVE ------------------------------- */

  function handleApprove() {
    router.push(`/stories/${storyId}/studio`);
  }

  /* -------------------------------------------------------------------------- */
  /*                                   RENDER                                   */
  /* -------------------------------------------------------------------------- */

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50">
      
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-purple-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            
            <Link 
              href={`/stories/${storyId}/studio`}
              className="flex items-center gap-2 text-gray-700 hover:text-purple-600 transition-colors font-medium"
            >
              <ChevronLeft className="w-5 h-5" />
              <span>Back to Studio</span>
            </Link>

            <h1 className="text-lg font-black bg-gradient-to-r from-pink-500 to-purple-500 bg-clip-text text-transparent">
              Cover Design
            </h1>

            <button
              onClick={() => router.refresh()}
              className="p-2 hover:bg-purple-100 rounded-lg transition-colors"
              title="Refresh"
            >
              <RefreshCw className="w-5 h-5 text-purple-600" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* CHAT COLUMN */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-3xl shadow-xl overflow-hidden">
              
              {/* Messages */}
              <div className="h-[500px] overflow-y-auto p-6 space-y-4 bg-gray-50">
                {messages.length === 0 && isLoading && (
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center">
                      <Loader2 className="animate-spin w-5 h-5 text-purple-600" />
                    </div>
                    <div className="bg-white rounded-2xl px-4 py-3 border border-gray-100">
                      <p className="text-sm text-gray-600">Starting our conversation...</p>
                    </div>
                  </div>
                )}

                {messages.length === 0 && !isLoading && (
                  <div className="flex flex-col items-center justify-center h-full text-center">
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center mb-6">
                      <Sparkles className="w-10 h-10 text-purple-400" />
                    </div>
                    <h3 className="text-2xl font-black text-gray-900 mb-3">
                      Let's Design Your Cover!
                    </h3>
                    <p className="text-gray-600 max-w-md">
                      I'll help you create the perfect cover by asking about your vision and style preferences.
                    </p>
                  </div>
                )}

                {messages.map((m, i) => (
                  <div
                    key={i}
                    className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[80%] p-4 rounded-2xl ${
                        m.role === "user"
                          ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white"
                          : "bg-white text-gray-900 border border-gray-100"
                      }`}
                    >
                      <p className="text-sm leading-relaxed">{m.content}</p>
                    </div>
                  </div>
                ))}

                {isLoading && messages.length > 0 && (
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center">
                      <Loader2 className="animate-spin w-5 h-5 text-purple-600" />
                    </div>
                    <div className="bg-white rounded-2xl px-4 py-3 border border-gray-100">
                      <p className="text-sm text-gray-600">Thinking...</p>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Input Area */}
              <div className="border-t border-gray-100 p-6 bg-white">
                {!hasCovers ? (
                  <div className="space-y-3">
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
                        className="flex-1 border-2 border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-purple-400 text-sm"
                        placeholder="Describe your cover vision..."
                        disabled={isLoading || isFinalising || isGeneratingCovers}
                      />
                      <button
                        onClick={sendMessage}
                        disabled={!input.trim() || isLoading || isFinalising || isGeneratingCovers}
                        className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Send className="w-5 h-5" />
                      </button>
                    </div>

                    <button
                      onClick={finalizeCoverPlan}
                      disabled={isFinalising || messages.length < 2 || isGeneratingCovers}
                      className="w-full py-4 rounded-xl bg-gradient-to-r from-pink-500 to-purple-500 text-white font-bold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {isFinalising || isGeneratingCovers ? (
                        <>
                          <Loader2 className="animate-spin w-5 h-5" />
                          {isGeneratingCovers ? "Generating..." : "Creating Design..."}
                        </>
                      ) : (
                        <>
                          <Wand2 className="w-5 h-5" />
                          Finalize & Generate Cover
                        </>
                      )}
                    </button>
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
                          if (input.trim()) {
                            handleRegenerateWithFeedback(input);
                            setInput("");
                          }
                        }
                      }}
                      className="flex-1 border-2 border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-purple-400 text-sm"
                      placeholder="Request changes to the cover..."
                      disabled={isLoading || isGeneratingCovers}
                    />
                    <button
                      onClick={() => {
                        if (input.trim()) {
                          handleRegenerateWithFeedback(input);
                          setInput("");
                        }
                      }}
                      disabled={!input.trim() || isLoading || isGeneratingCovers}
                      className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all disabled:opacity-50"
                    >
                      {isGeneratingCovers ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <Send className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* PREVIEW SIDEBAR */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-3xl shadow-xl p-6 sticky top-24">
              <h3 className="text-xl font-black text-gray-900 mb-4 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-500" />
                Cover Preview
              </h3>

              {hasCovers && !isGeneratingCovers ? (
                <div className="space-y-4">
                  <div className="relative rounded-2xl overflow-hidden shadow-md">
                    <img 
                      src={localStory.coverSpreadUrl!} 
                      alt="Cover"
                      className="w-full"
                    />
                  </div>

                  <button
                    onClick={handleApprove}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 text-white font-bold hover:shadow-lg transition-all"
                  >
                    <Check className="w-5 h-5" />
                    Approve & Continue to Export
                  </button>

                  <p className="text-xs text-center text-gray-500">
                    or request changes in the chat
                  </p>
                </div>
              ) : isGeneratingCovers ? (
                <div className="bg-gradient-to-br from-purple-100 to-pink-100 rounded-2xl h-64 animate-pulse flex items-center justify-center">
                  <div className="text-center">
                    <Wand2 className="w-12 h-12 text-purple-400 mx-auto mb-3 animate-spin" />
                    <p className="text-purple-700 font-bold">Creating magic...</p>
                  </div>
                </div>
              ) : (
                <div className="bg-gray-50 rounded-2xl p-8 text-center">
                  <ImagePlus className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 text-sm">
                    Your cover will appear here once generated
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}