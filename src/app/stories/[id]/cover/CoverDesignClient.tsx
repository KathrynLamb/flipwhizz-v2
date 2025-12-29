'use client'
import { useState, useRef, useEffect } from "react";
import {
  Send,
  Sparkles,
  Loader2,
  BookOpen,
  Camera,
  CheckCircle2,
  Palette,
  Image as ImageIcon,
} from "lucide-react";
import { ExportGelatoButton } from "@/app/stories/[id]/design/components/ExportGelatoPDF";
import Link from "next/link";

export type DesignBriefSummary = {
  frontCover?: { mood?: string; scene?: string };
  backCover?: { strategy?: string };
  titlePage?: { style?: string };
};

export type Story = {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  tone: string | null;
  length: number | null;
  fullDraft: string | null;
  coverImageUrl: string | null;
  status: string | null; // ✅ allow null
  storyConfirmed: boolean;
  paymentStatus: string | null;
  paymentId: string | null;
  pdfUrl: string | null;
  frontCoverPrompt: string | null;
  backCoverPrompt: string | null;
  frontCoverUrl: string | null;
  backCoverUrl: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
};


type ChatMsg = {
  role: "user" | "assistant";
  content: string;
};

type CoverDesignChatProps = {
  storyId: string;
  projectId: string;
  onComplete: (data: unknown) => void;
  story: Story;
};

export default function CoverDesignChat({
  storyId,
  onComplete,
  projectId,
  story
}: CoverDesignChatProps) {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [conversationStage, setConversationStage] = useState<string>("intro");
  const [suggestedReplies, setSuggestedReplies] = useState<string[]>([]);
  const [designBrief, setDesignBrief] = useState<DesignBriefSummary>({});

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Check if we have prompts but not images yet
  const hasPrompts = story.frontCoverPrompt && story.backCoverPrompt;
  const hasCovers = story.frontCoverUrl && story.backCoverUrl;
  const isGeneratingCovers = story.status === "generating_covers";

  // --- Initial Chat Start ---
  useEffect(() => {
    async function startChat() {
      try {
        const hRes = await fetch(`/api/chat/history?projectId=${projectId}`);
        const hData = await hRes.json();
        const history = hData.messages || [];

        const res = await fetch("/api/stories/cover-chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            storyId,
            history,
            message: "We've just finished the story — let's design the cover!",
          }),
        });

        const data = await res.json();

        setMessages([
          ...history,
          { role: "assistant", content: data.reply },
        ]);
      } catch (err) {
        console.error("Failed to start chat:", err);
      }
    }

    startChat();
  }, [storyId, projectId]);

  useEffect(() => {
    console.log("Story", story)
  }, [story])

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // --- Send Message Handler ---
  async function sendMessage(textOverride?: string) {
    const textToSend = textOverride || input;
    if (!textToSend.trim() || isLoading) return;

    const userMessage: ChatMsg = { role: "user", content: textToSend };
    const newMessages = [...messages, userMessage];

    setMessages(newMessages);
    setInput("");
    setIsLoading(true);
    setSuggestedReplies([]);

    try {
      const res = await fetch("/api/stories/generate-cover-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storyId,
          conversationHistory: newMessages,
          mode: "chat",
        }),
      });

      const data = await res.json();

      setMessages([
        ...newMessages,
        { role: "assistant", content: data.message },
      ]);

      setConversationStage(data.stage);
      setSuggestedReplies(data.suggestedReplies || []);
      setDesignBrief((prev) => ({ ...prev, ...data.briefSummary }));
    } catch (err) {
      console.error("Chat error:", err);
      setMessages([
        ...newMessages,
        {
          role: "assistant",
          content: "Sorry, I had trouble processing that. Could you try again?",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  // --- Generate Prompts Handler ---
  async function generatePrompts() {
    setIsGenerating(true);
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

      const data = await res.json();
      
      if (!res.ok) {
        alert("Failed to generate cover prompts. Please try again.");
        return;
      }

      // Refresh the page or update story state
      window.location.reload();
      
    } catch (err) {
      console.error("Generation error:", err);
      alert("Something went wrong. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  }

  // --- Trigger Cover Image Generation Handler ---
  async function triggerCoverGeneration() {
    setIsGenerating(true);
    try {
      const inngestRes = await fetch("/api/inngest/trigger-covers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storyId }),
      });

      if (!inngestRes.ok) {
        alert("Failed to start cover generation.");
        return;
      }
      console.log("inngest res", inngestRes)
      // Refresh to show generating status
      window.location.reload();
      
    } catch (err) {
      console.error("Generation error:", err);
      alert("Something went wrong. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  }

  const isReadyToGenerate = conversationStage === "ready";

  return (
    <div className="flex h-[calc(100vh-6rem)] max-w-7xl mx-auto bg-white rounded-3xl shadow-2xl overflow-hidden border border-stone-100 font-sans">
      {/* ----- LEFT MAIN COLUMN (Chat & Input) ----- */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="flex-shrink-0 bg-white border-b border-stone-100 p-5 flex items-center gap-4">
          <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-fuchsia-500 rounded-xl flex items-center justify-center shadow-sm">
            <BookOpen className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-stone-800">
              Cover Design Studio
            </h2>
            <p className="text-stone-500 text-sm">
              Collaborate with AI to design your book covers.
            </p>
          </div>
        </div>

        {/* Chat History */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-stone-50/50 scrollbar-thin scrollbar-thumb-stone-200 scrollbar-track-transparent">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex ${
                msg.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[85%] rounded-2xl p-5 shadow-sm ${
                  msg.role === "user"
                    ? "bg-violet-600 text-white rounded-br-none"
                    : "bg-white text-stone-800 border border-stone-100 rounded-bl-none"
                }`}
              >
                {msg.role === "assistant" && (
                  <div className="flex items-center gap-2 mb-3 pb-2 border-b border-stone-100/80">
                    <Sparkles className="w-4 h-4 text-violet-500" />
                    <span className="text-xs font-bold text-violet-600 uppercase tracking-wider">
                      Design Partner
                    </span>
                  </div>
                )}
                <div className="whitespace-pre-wrap leading-relaxed text-[15px]">
                  {msg.content}
                </div>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-stone-100 flex items-center gap-3 text-stone-600 rounded-bl-none">
                <Loader2 className="w-5 h-5 animate-spin text-violet-500" />
                <span className="text-sm font-medium">Thinking...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input / Action Area */}
        <div className="flex-shrink-0 bg-white border-t border-stone-100 p-5">
          {/* Suggested Replies */}
          {!isReadyToGenerate && !hasPrompts && suggestedReplies.length > 0 && !isLoading && (
            <div className="mb-4 flex flex-wrap gap-2">
              {suggestedReplies.map((reply, idx) => (
                <button
                  key={idx}
                  onClick={() => sendMessage(reply)}
                  className="px-4 py-2 bg-violet-50 hover:bg-violet-100 text-violet-700 text-sm font-medium rounded-full border border-violet-200 transition-colors"
                >
                  {reply}
                </button>
              ))}
            </div>
          )}

          {/* Ready to Generate Prompts */}
          {isReadyToGenerate && !hasPrompts ? (
            <div className="bg-gradient-to-r from-violet-50 to-fuchsia-50 rounded-2xl p-6 text-center border border-violet-100">
              <Sparkles className="w-8 h-8 text-violet-600 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-stone-800 mb-2">
                Ready to finalize your design!
              </h3>
              <p className="text-stone-600 mb-6 text-sm max-w-md mx-auto">
                Review your design brief on the right. Click below to save your cover design decisions.
              </p>
              <button
                onClick={generatePrompts}
                disabled={isGenerating}
                className="inline-flex items-center gap-3 px-8 py-4 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white font-bold text-lg shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all disabled:opacity-70"
              >
                {isGenerating ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-6 h-6" />
                )}
                {isGenerating ? "Saving..." : "Save Cover Design"}
              </button>
            </div>
          ) : hasPrompts && !hasCovers && !isGeneratingCovers ? (
            /* Prompts saved, ready to generate images */
            <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-2xl p-6 text-center border border-emerald-100">
              <Camera className="w-8 h-8 text-emerald-600 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-stone-800 mb-2">
                Design saved! Ready to generate covers
              </h3>
              <p className="text-stone-600 mb-6 text-sm max-w-md mx-auto">
                Your cover design is finalized. Click below to generate the actual cover images using AI. This will take a few minutes.
              </p>
              <button
                onClick={triggerCoverGeneration}
                disabled={isGenerating}
                className="inline-flex items-center gap-3 px-8 py-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold text-lg shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all disabled:opacity-70"
              >
                {isGenerating ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : (
                  <ImageIcon className="w-6 h-6" />
                )}
                {isGenerating ? "Starting Generation..." : "Generate Cover Images"}
              </button>
            </div>
          ) : isGeneratingCovers ? (
            /* Covers are being generated */
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-6 text-center border border-blue-100">
              <Loader2 className="w-8 h-8 text-blue-600 mx-auto mb-3 animate-spin" />
              <h3 className="text-lg font-bold text-stone-800 mb-2">
                Generating your covers...
              </h3>
              <p className="text-stone-600 text-sm max-w-md mx-auto">
                AI is creating your beautiful cover images. This usually takes 2-3 minutes. You can refresh the page to check progress.
              </p>
            </div>
          ) : hasCovers ? (
            /* Covers are complete */
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl p-6 text-center border border-green-100">
              <CheckCircle2 className="w-8 h-8 text-green-600 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-stone-800 mb-2">
                Covers ready! 🎉
              </h3>
              <p className="text-stone-600 text-sm max-w-md mx-auto">
                Your front and back covers have been generated successfully.
              </p>
            </div>
          ) : (
            /* Standard Input Field */
            <div className="flex gap-3 relative">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder="Type your ideas here..."
                disabled={isLoading}
                rows={1}
                className="flex-1 px-5 py-4 rounded-xl border-2 border-stone-200 focus:border-violet-500 focus:ring-4 focus:ring-violet-100 focus:outline-none text-base resize-none max-h-32 scrollbar-thin transition-all shadow-sm"
                style={{ minHeight: "60px" }}
              />
              <button
                onClick={() => sendMessage()}
                disabled={!input.trim() || isLoading}
                className="absolute right-3 bottom-3 p-3 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-40 disabled:hover:bg-violet-600 transition-colors shadow-md flex items-center justify-center"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ----- RIGHT SIDEBAR (Live Design Brief) ----- */}
      <div className="w-80 flex-shrink-0 bg-stone-50 border-l border-stone-100 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-stone-200">
        <div className="flex items-center gap-2 mb-6">
          <Palette className="w-5 h-5 text-violet-600" />
          <h3 className="text-lg font-bold text-stone-800">Design Brief</h3>
        </div>

        <div className="space-y-8">
          {/* Front Cover Brief */}
          <section>
            <h4 className="flex items-center gap-2 text-xs font-bold text-stone-500 uppercase tracking-wider mb-3">
              {designBrief.frontCover?.mood || story.frontCoverPrompt ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              ) : (
                <div className="w-4 h-4 rounded-full border-2 border-stone-300" />
              )}
              Front Cover
            </h4>
            {designBrief.frontCover?.mood || designBrief.frontCover?.scene ? (
              <div className="bg-white p-4 rounded-xl shadow-sm border border-stone-100 space-y-3">
                {designBrief.frontCover.mood && (
                  <div>
                    <p className="text-xs font-semibold text-stone-400 mb-1">
                      Mood & Vibe
                    </p>
                    <p className="text-sm text-stone-800 font-medium leading-snug">
                      {designBrief.frontCover.mood}
                    </p>
                  </div>
                )}
                {designBrief.frontCover.scene && (
                  <div>
                    <p className="text-xs font-semibold text-stone-400 mb-1">
                      Key Scene
                    </p>
                    <p className="text-sm text-stone-800 font-medium leading-snug">
                      {designBrief.frontCover.scene}
                    </p>
                  </div>
                )}
              </div>
            ) : story.frontCoverPrompt ? (
              <div className="bg-white p-4 rounded-xl shadow-sm border border-stone-100">
                <p className="text-xs font-semibold text-stone-400 mb-1">
                  Design Saved ✓
                </p>
                <p className="text-xs text-stone-500 leading-snug">
                  Front cover design has been finalized
                </p>
              </div>
            ) : (
              <p className="text-sm text-stone-400 italic pl-6">
                Not yet decided...
              </p>
            )}
          </section>

          {/* Back Cover Brief */}
          <section>
            <h4 className="flex items-center gap-2 text-xs font-bold text-stone-500 uppercase tracking-wider mb-3">
              {designBrief.backCover?.strategy || story.backCoverPrompt ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              ) : (
                <div className="w-4 h-4 rounded-full border-2 border-stone-300" />
              )}
              Back Cover
            </h4>
            {designBrief.backCover?.strategy ? (
              <div className="bg-white p-4 rounded-xl shadow-sm border border-stone-100">
                <p className="text-xs font-semibold text-stone-400 mb-1">
                  Strategy
                </p>
                <p className="text-sm text-stone-800 font-medium capitalize leading-snug">
                  {designBrief.backCover.strategy}
                </p>
              </div>
            ) : story.backCoverPrompt ? (
              <div className="bg-white p-4 rounded-xl shadow-sm border border-stone-100">
                <p className="text-xs font-semibold text-stone-400 mb-1">
                  Design Saved ✓
                </p>
                <p className="text-xs text-stone-500 leading-snug">
                  Back cover design has been finalized
                </p>
              </div>
            ) : (
              <p className="text-sm text-stone-400 italic pl-6">
                Not yet decided...
              </p>
            )}
          </section>

          {/* Cover Generation Status */}
          {hasPrompts && (
            <section className="pt-4 border-t border-stone-200">
              <h4 className="flex items-center gap-2 text-xs font-bold text-stone-500 uppercase tracking-wider mb-3">
                <ImageIcon className="w-4 h-4 text-violet-600" />
                Cover Images
              </h4>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  {story.frontCoverUrl ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  ) : isGeneratingCovers ? (
                    <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border-2 border-stone-300" />
                  )}
                  <span className="text-stone-600">Front Cover</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  {story.backCoverUrl ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  ) : isGeneratingCovers ? (
                    <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border-2 border-stone-300" />
                  )}
                  <span className="text-stone-600">Back Cover</span>
                </div>
              </div>
            </section>
          )}


        {story.pdfUrl ? (
          <Link href={`/stories/${storyId}/checkout`}>
          Proceed to Checkout
        </Link>
        ):
          <ExportGelatoButton storyId={storyId} />
        }

        </div>
      </div>
    </div>
  );
}