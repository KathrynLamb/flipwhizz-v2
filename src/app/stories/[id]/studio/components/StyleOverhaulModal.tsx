"use client";

// src/app/stories/[id]/studio/components/StyleOverhaulModal.tsx
//
// Full-story style overhaul modal.
// User describes what's wrong → AI diagnoses root causes and rewrites
// style guide, scene summaries, and illustration prompts →
// generates one sample spread → user accepts or iterates →
// full redraw fires.

import { useState, useRef, useEffect } from "react";
import {
  X,
  Loader2,
  Sparkles,
  Wand2,
  CheckCircle,
  AlertTriangle,
  RefreshCcw,
  ChevronRight,
  Paintbrush,
  Eye,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

/* -------------------------------------------------------------------------- */
/* TYPES                                                                       */
/* -------------------------------------------------------------------------- */

type Message = { id: string; role: "user" | "assistant"; content: string };

type StyleMutation =
  | { type: "update_style_guide"; fields: Record<string, any> }
  | { type: "update_spread_scene"; spreadId: string; fields: Record<string, any> }
  | { type: "update_spread_summary"; spreadId: string; sceneSummary: string }
  | { type: "null_location_images" }
  | { type: "null_style_ref" };

type StyleOverhaulPlan = {
  diagnosis: string[];
  mutations: StyleMutation[];
  sampleSpreadIndex: number;
  notesToUser: string;
  readyForFullRedraw: boolean;
};

/* -------------------------------------------------------------------------- */
/* SUB-COMPONENTS                                                              */
/* -------------------------------------------------------------------------- */

function DiagnosisCard({ diagnosis }: { diagnosis: string[] }) {
  return (
    <div
      className="rounded-2xl p-4 space-y-2"
      style={{
        background: "rgba(176,92,230,0.06)",
        border: "1px solid rgba(176,92,230,0.15)",
      }}
    >
      <div className="flex items-center gap-2 mb-1">
        <AlertTriangle className="w-4 h-4 flex-shrink-0" style={{ color: "#B05CE6" }} />
        <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "#6B5C80" }}>
          What I found
        </p>
      </div>
      {diagnosis.map((d, i) => (
        <p key={i} className="text-sm leading-relaxed" style={{ color: "#4A3D5E" }}>
          • {d}
        </p>
      ))}
    </div>
  );
}

function MutationSummary({ mutations }: { mutations: StyleMutation[] }) {
  const labels: Record<string, string> = {
    update_style_guide: "Rewrite style guide",
    update_spread_scene: "Rewrite spread prompts",
    update_spread_summary: "Rewrite spread descriptions",
    null_location_images: "Remove location reference images",
    null_style_ref: "Remove style reference image",
  };

  const counts: Record<string, number> = {};
  for (const m of mutations) {
    counts[m.type] = (counts[m.type] ?? 0) + 1;
  }

  return (
    <div className="space-y-1.5">
      {Object.entries(counts).map(([type, count]) => (
        <div
          key={type}
          className="flex items-center gap-2 px-3 py-2 rounded-xl"
          style={{ background: "rgba(67,184,156,0.06)", border: "1px solid rgba(67,184,156,0.15)" }}
        >
          <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#2FA482" }} />
          <span className="text-xs" style={{ color: "#2D2235" }}>
            {labels[type] ?? type}
            {count > 1 ? ` (${count})` : ""}
          </span>
        </div>
      ))}
    </div>
  );
}

function SampleSpreadPreview({
  imageUrl,
  spreadIndex,
  isGenerating,
}: {
  imageUrl: string | null;
  spreadIndex: number;
  isGenerating: boolean;
}) {
  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ border: "1px solid rgba(180,150,210,0.15)" }}
    >
      <div
        className="flex items-center gap-2 px-4 py-2.5"
        style={{
          background: "rgba(249,245,255,0.8)",
          borderBottom: "1px solid rgba(180,150,210,0.1)",
        }}
      >
        <Eye className="w-3.5 h-3.5" style={{ color: "#B05CE6" }} />
        <p className="text-xs font-bold" style={{ color: "#2D2235" }}>
          Sample — Spread {spreadIndex}
        </p>
      </div>

      <div className="aspect-[2/1] bg-gray-100 relative">
        {isGenerating ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
              className="w-10 h-10 rounded-2xl flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #B05CE6, #D45DA0)" }}
            >
              <Wand2 className="w-5 h-5 text-white" />
            </motion.div>
            <p className="text-sm font-medium" style={{ color: "#7B6E90" }}>
              Generating sample…
            </p>
            <p className="text-xs" style={{ color: "#A897BD" }}>
              About 30–60 seconds
            </p>
          </div>
        ) : imageUrl ? (
          <img src={imageUrl} alt="Sample spread" className="w-full h-full object-contain" />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <Paintbrush className="w-8 h-8" style={{ color: "#D4C6E6" }} />
            <p className="text-sm" style={{ color: "#A897BD" }}>
              Sample will appear here
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* MAIN MODAL                                                                  */
/* -------------------------------------------------------------------------- */

export default function StyleOverhaulModal({
  isOpen,
  onClose,
  storyId,
  storyTitle,
  spreads,
  onTriggerSampleRedraw,
  onTriggerFullRedraw,
}: {
  isOpen: boolean;
  onClose: () => void;
  storyId: string;
  storyTitle: string;
  spreads: Array<{
    id: string;
    spreadId: string | null;
    spreadIndex: number;
    left: { id: string; imageUrl: string | null };
    right: { id: string; imageUrl: string | null } | null;
  }>;
  onTriggerSampleRedraw: (spreadId: string, pageIds: string[]) => void;
  onTriggerFullRedraw: () => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [plan, setPlan] = useState<StyleOverhaulPlan | null>(null);
  const [isApplyingPlan, setIsApplyingPlan] = useState(false);
  const [planApplied, setPlanApplied] = useState(false);
  const [sampleGenerating, setSampleGenerating] = useState(false);
  const [sampleImageUrl, setSampleImageUrl] = useState<string | null>(null);
  const [sampleSpreadIndex, setSampleSpreadIndex] = useState<number>(1);
  const [phase, setPhase] = useState<"chat" | "sample" | "done">("chat");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    if (messages.length === 0) {
      setMessages([
        {
          id: "intro",
          role: "assistant",
          content:
            "I'm your style overhaul assistant. Tell me what's wrong with the current illustrations — the look, the feel, the composition, anything. I can diagnose the root causes and rewrite everything from the style guide to the individual spread prompts. What's not working?",
        },
      ]);
    }
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSending]);

  // Poll for sample image
  useEffect(() => {
    if (!sampleGenerating) return;

    const sampleSpread = spreads.find((s) => s.spreadIndex === sampleSpreadIndex);
    if (!sampleSpread) return;

    const targetPageId = sampleSpread.left.id;

    const interval = setInterval(async () => {
      const res = await fetch(`/api/stories/${storyId}/pages`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const pages: Array<{ id: string; imageUrl: string | null }> = await res.json();
      const page = pages.find((p) => p.id === targetPageId);
      if (page?.imageUrl) {
        setSampleImageUrl(page.imageUrl);
        setSampleGenerating(false);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [sampleGenerating, sampleSpreadIndex, storyId, spreads]);

  async function sendMessage() {
    if (!input.trim() || isSending) return;
    const text = input.trim();
    setInput("");

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: text,
    };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setIsSending(true);

    try {
      const res = await fetch(`/api/stories/${storyId}/style-overhaul`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages }),
      });

      const data = await res.json();
      if (data.assistantMessage) {
        setMessages((prev) => [...prev, data.assistantMessage]);
      }
      if (data.plan) {
        setPlan(data.plan);
        if (data.plan.sampleSpreadIndex) {
          setSampleSpreadIndex(data.plan.sampleSpreadIndex);
        }
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: "assistant",
          content: "Something went wrong. Please try again.",
        },
      ]);
    } finally {
      setIsSending(false);
    }
  }

  async function applyAndGenerateSample() {
    if (!plan) return;
    setIsApplyingPlan(true);

    try {
      // Apply mutations
      await fetch(`/api/stories/${storyId}/style-overhaul`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [], applyPlan: plan }),
      });

      setPlanApplied(true);
      setPhase("sample");

      // Find the sample spread
      const sampleSpread = spreads.find(
        (s) => s.spreadIndex === (plan.sampleSpreadIndex ?? 1)
      ) ?? spreads[0];

      if (sampleSpread) {
        const pageIds = [
          sampleSpread.left.id,
          ...(sampleSpread.right ? [sampleSpread.right.id] : []),
        ];
        setSampleGenerating(true);
        setSampleImageUrl(null);
        onTriggerSampleRedraw(sampleSpread.spreadId ?? sampleSpread.left.id, pageIds);
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `applied-${Date.now()}`,
          role: "assistant",
          content: `Changes applied. Generating a sample from spread ${plan.sampleSpreadIndex} so you can see the difference. Take a look and tell me if it's heading in the right direction — or what still needs adjusting.`,
        },
      ]);
    } finally {
      setIsApplyingPlan(false);
    }
  }

  function acceptSampleAndRedrawAll() {
    setPhase("done");
    onTriggerFullRedraw();
    onClose();
  }

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end md:items-center justify-center p-0 md:p-6"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ opacity: 0, y: 32 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 32 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="bg-white shadow-2xl w-full md:max-w-4xl md:rounded-2xl rounded-t-2xl overflow-hidden border border-gray-200/50 flex flex-col"
        style={{ maxHeight: "92vh", fontFamily: "'Bricolage Grotesque', system-ui, sans-serif" }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 md:hidden">
          <div className="w-10 h-1 rounded-full bg-gray-300" />
        </div>

        {/* Header */}
        <div
          className="px-5 py-4 flex items-center justify-between flex-shrink-0"
          style={{ borderBottom: "1px solid rgba(180,150,210,0.1)" }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #B05CE6, #D45DA0)" }}
            >
              <Paintbrush className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="text-base font-bold" style={{ color: "#2D2235" }}>
                Style Overhaul
              </h3>
              <p className="text-xs" style={{ color: "#A897BD" }}>
                {storyTitle}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {messages.length > 1 && (
              <button
                onClick={() => {
                  setMessages([
                    {
                      id: "intro",
                      role: "assistant",
                      content:
                        "I'm your style overhaul assistant. Tell me what's wrong with the current illustrations — the look, the feel, the composition, anything. What's not working?",
                    },
                  ]);
                  setPlan(null);
                  setPlanApplied(false);
                  setSampleImageUrl(null);
                  setPhase("chat");
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                style={{ border: "1px solid rgba(180,150,210,0.2)", color: "#8B7BA0" }}
              >
                <RefreshCcw className="w-3.5 h-3.5" />
                Start over
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-[1fr_320px]">

          {/* Chat column */}
          <div className="flex flex-col min-h-0" style={{ borderRight: "1px solid rgba(180,150,210,0.1)" }}>
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
              {messages.map((m) => (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex items-end gap-2 ${m.role === "user" ? "flex-row-reverse" : ""}`}
                >
                  {m.role === "assistant" && (
                    <div
                      className="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0 self-end mb-0.5"
                      style={{ background: "linear-gradient(135deg, #B05CE6, #D45DA0)" }}
                    >
                      <Sparkles className="w-3.5 h-3.5 text-white" />
                    </div>
                  )}
                  <div
                    className={`max-w-[85%] px-3.5 py-2.5 text-sm leading-relaxed rounded-2xl ${
                      m.role === "user" ? "rounded-br-md text-white" : "rounded-bl-md"
                    }`}
                    style={
                      m.role === "user"
                        ? { background: "linear-gradient(135deg, #B05CE6, #D45DA0)" }
                        : {
                            background: "rgba(249,245,255,0.8)",
                            color: "#2D2235",
                            border: "1px solid rgba(180,150,210,0.12)",
                          }
                    }
                  >
                    <p className="whitespace-pre-wrap">{m.content}</p>
                  </div>
                </motion.div>
              ))}

              {isSending && (
                <div className="flex items-end gap-2">
                  <div
                    className="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: "linear-gradient(135deg, #B05CE6, #D45DA0)" }}
                  >
                    <Sparkles className="w-3.5 h-3.5 text-white" />
                  </div>
                  <div
                    className="px-3.5 py-3 rounded-2xl rounded-bl-md flex gap-1.5"
                    style={{
                      background: "rgba(249,245,255,0.8)",
                      border: "1px solid rgba(180,150,210,0.12)",
                    }}
                  >
                    {[0, 150, 300].map((d) => (
                      <motion.span
                        key={d}
                        className="w-2 h-2 rounded-full block"
                        style={{ background: "#C4A8E0" }}
                        animate={{ y: [0, -5, 0] }}
                        transition={{ repeat: Infinity, duration: 0.9, delay: d / 1000 }}
                      />
                    ))}
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div
              className="p-3 flex-shrink-0"
              style={{ borderTop: "1px solid rgba(180,150,210,0.08)" }}
            >
              <div className="flex gap-2 items-end">
                <div
                  className="flex-1 rounded-xl px-3.5 py-2"
                  style={{
                    background: "rgba(249,245,255,0.8)",
                    border: "1.5px solid rgba(180,150,210,0.18)",
                    minHeight: 44,
                  }}
                >
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => {
                      setInput(e.target.value);
                      e.target.style.height = "auto";
                      e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                      }
                    }}
                    placeholder="Describe what's wrong with the style…"
                    disabled={isSending}
                    rows={1}
                    className="w-full bg-transparent border-0 focus:outline-none resize-none text-sm leading-relaxed"
                    style={{
                      color: "#2D2235",
                      fontFamily: "inherit",
                      fontSize: 14,
                      paddingTop: 6,
                      paddingBottom: 6,
                      maxHeight: 120,
                    }}
                  />
                </div>
                <button
                  onClick={sendMessage}
                  disabled={!input.trim() || isSending}
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-white disabled:opacity-30 active:scale-95 transition-transform flex-shrink-0"
                  style={{
                    background: "linear-gradient(135deg, #B05CE6, #D45DA0)",
                    border: "none",
                  }}
                >
                  {isSending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Right panel — plan + sample */}
          <div className="flex flex-col gap-4 p-4 overflow-y-auto min-h-0">
            {!plan && (
              <div className="flex flex-col items-center justify-center h-full text-center py-8 px-4">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
                  style={{ background: "rgba(176,92,230,0.08)" }}
                >
                  <Wand2 className="w-7 h-7" style={{ color: "#B05CE6" }} />
                </div>
                <p className="text-sm font-semibold mb-2" style={{ color: "#2D2235" }}>
                  Tell me what's wrong
                </p>
                <p className="text-xs leading-relaxed" style={{ color: "#A897BD" }}>
                  Describe the style problem in plain language. I'll diagnose the root cause and show you exactly what I'll change before touching anything.
                </p>
              </div>
            )}

            {plan && (
              <>
                {/* Diagnosis */}
                {plan.diagnosis?.length > 0 && (
                  <DiagnosisCard diagnosis={plan.diagnosis} />
                )}

                {/* What will change */}
                {plan.mutations?.length > 0 && !planApplied && (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: "#6B5C80" }}>
                      What I'll change
                    </p>
                    <MutationSummary mutations={plan.mutations} />
                  </div>
                )}

                {/* Notes to user */}
                {plan.notesToUser && (
                  <div
                    className="px-3 py-2.5 rounded-xl text-sm leading-relaxed"
                    style={{
                      background: "rgba(180,150,210,0.06)",
                      border: "1px solid rgba(180,150,210,0.12)",
                      color: "#4A3D5E",
                    }}
                  >
                    {plan.notesToUser}
                  </div>
                )}

                {/* Sample spread preview */}
                {phase !== "chat" && (
                  <SampleSpreadPreview
                    imageUrl={sampleImageUrl}
                    spreadIndex={sampleSpreadIndex}
                    isGenerating={sampleGenerating}
                  />
                )}

                {/* Actions */}
                {plan.readyForFullRedraw && !planApplied && (
                  <button
                    onClick={applyAndGenerateSample}
                    disabled={isApplyingPlan}
                    className="w-full py-3.5 rounded-2xl text-sm font-bold text-white flex items-center justify-center gap-2 disabled:opacity-40 active:scale-[0.98] transition-transform"
                    style={{
                      background: "linear-gradient(135deg, #B05CE6, #D45DA0)",
                      boxShadow: "0 4px 16px rgba(176,92,230,0.25)",
                      border: "none",
                    }}
                  >
                    {isApplyingPlan ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Applying changes…
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        Apply & generate sample
                      </>
                    )}
                  </button>
                )}

                {phase === "sample" && !sampleGenerating && sampleImageUrl && (
                  <div className="space-y-2">
                    <button
                      onClick={acceptSampleAndRedrawAll}
                      className="w-full py-3.5 rounded-2xl text-sm font-bold text-white flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
                      style={{
                        background: "linear-gradient(135deg, #43B89C, #2FA482)",
                        boxShadow: "0 4px 16px rgba(67,184,156,0.25)",
                        border: "none",
                      }}
                    >
                      <CheckCircle className="w-4 h-4" />
                      Looks good — redraw all spreads
                    </button>
                    <p className="text-xs text-center" style={{ color: "#A897BD" }}>
                      Or keep chatting to refine further
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}