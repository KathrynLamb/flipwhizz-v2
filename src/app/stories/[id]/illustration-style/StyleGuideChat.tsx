"use client";

// ─────────────────────────────────────────────────────────────────────────────
// StyleGuideChat.tsx
// Drop-in chat component for the Design step.
// Place at: src/app/stories/[id]/illustration-style/StyleGuideChat.tsx
//
// Usage in IllustrationStyleClient:
//   import StyleGuideChat from "./StyleGuideChat";
//
//   // Add to state:
//   const [mode, setMode] = useState<"suggest" | "customise" | "chat">("suggest");
//
//   // Add button in suggest card actions:
//   <button onClick={() => setMode("chat")}>Describe it to me</button>
//
//   // Add in AnimatePresence alongside suggest/customise:
//   {mode === "chat" && (
//     <StyleGuideChat
//       storyId={storyId}
//       onResolved={(styleGuide) => {
//         // Save to DB then continue
//         fetch(`/api/stories/${storyId}/style-guide`, {
//           method: "POST",
//           headers: { "Content-Type": "application/json" },
//           body: JSON.stringify({
//             summary: styleGuide.summary,
//             artStyle: styleGuide.artStyle,
//             visualThemes: styleGuide.visualThemes,
//             colorPalette: styleGuide.colorPalette,
//             promptBase: styleGuide.promptBase,
//             negativePrompt: styleGuide.negativePrompt,
//           }),
//         }).then(handleAcceptAndContinue);
//       }}
//       onBack={() => setMode("suggest")}
//     />
//   )}
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Loader2, Paintbrush, Check, Sparkles, ArrowLeft } from "lucide-react";

type Message = { role: "user" | "assistant"; content: string };

type ResolvedStyleGuide = {
  resolved: true;
  summary: string;
  artStyle: string;
  visualThemes: string;
  colorPalette: {
    primary: string;
    secondary: string;
    accent: string;
    mood: string;
    hex: string[];
  };
  promptBase: string;
  negativePrompt: string;
};

const FONT = "'Bricolage Grotesque', system-ui, sans-serif";

const STARTER_PROMPTS = [
  "Bold and graphic, like a comic book",
  "Soft and dreamy, like a classic picture book",
  "Bright and modern, like Bluey",
  "Magical and ethereal, lots of stars and glow",
];

export default function StyleGuideChat({
  storyId,
  onResolved,
  onBack,
}: {
  storyId: string;
  onResolved: (styleGuide: ResolvedStyleGuide) => void;
  onBack: () => void;
}) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Let's find the perfect illustration style for your book! Tell me — what kind of look do you imagine? You can describe a feeling, name a book or show you love, or just say what you definitely don't want.",
    },
  ]);
  const [conversationHistory, setConversationHistory] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [resolved, setResolved] = useState<ResolvedStyleGuide | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showStarters, setShowStarters] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend(text?: string) {
    const content = (text ?? input).trim();
    if (!content || isLoading) return;

    setInput("");
    setShowStarters(false);
    setIsLoading(true);

    const userMsg: Message = { role: "user", content };
    setMessages(prev => [...prev, userMsg]);

    try {
      const res = await fetch(`/api/stories/${storyId}/style-guide/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: content,
          conversationHistory,
        }),
      });

      const data = await res.json();

      if (data.resolved && data.styleGuide) {
        setResolved(data.styleGuide);
        setConversationHistory(data.conversationHistory ?? []);
        // Show a resolved message in chat
        setMessages(prev => [
          ...prev,
          {
            role: "assistant",
            content: `Perfect — I've got everything I need! Here's what I came up with for your style. Take a look below and confirm when you're happy.`,
          },
        ]);
      } else {
        setMessages(prev => [...prev, { role: "assistant", content: data.reply }]);
        setConversationHistory(data.conversationHistory ?? []);
      }
    } catch {
      setMessages(prev => [
        ...prev,
        { role: "assistant", content: "Sorry — something went wrong. Try again?" },
      ]);
    } finally {
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }

  async function handleConfirm() {
    if (!resolved) return;
    setIsSaving(true);
    try {
      await fetch(`/api/stories/${storyId}/style-guide`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          summary: resolved.summary,
          artStyle: resolved.artStyle,
          visualThemes: resolved.visualThemes,
          colorPalette: resolved.colorPalette,
          promptBase: resolved.promptBase,
          negativePrompt: resolved.negativePrompt,
        }),
      });
      onResolved(resolved);
    } catch {
      alert("Failed to save style. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div
      className="rounded-[22px] border overflow-hidden flex flex-col"
      style={{
        background: "white",
        borderColor: "rgba(180,150,210,0.12)",
        boxShadow: "0 2px 8px rgba(100,60,140,0.05), 0 12px 40px rgba(100,60,140,0.07)",
        maxHeight: "calc(100vh - 180px)",
        fontFamily: FONT,
      }}
    >
      {/* ── Header ── */}
      <div
        className="px-5 py-4 flex items-center justify-between border-b flex-shrink-0"
        style={{ borderColor: "rgba(180,150,210,0.1)" }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #E8D5FF, #FFD5E5)" }}
          >
            <Paintbrush className="w-4 h-4" style={{ color: "#B05CE6" }} />
          </div>
          <div>
            <h3 className="text-[15px] font-bold" style={{ color: "#2D2235" }}>
              Describe your style
            </h3>
            <p className="text-[11px]" style={{ color: "#A897BD" }}>
              Chat with your art director
            </p>
          </div>
        </div>
        <button
          onClick={onBack}
          className="text-[11px] font-semibold border rounded-lg px-2.5 py-1 transition-all hover:border-[#C77DFF] hover:text-[#7B5EA7]"
          style={{
            background: "transparent",
            borderColor: "rgba(180,150,210,0.15)",
            color: "#A897BD",
            cursor: "pointer",
            fontFamily: FONT,
          }}
        >
          ← Back
        </button>
      </div>

      {/* ── Messages ── */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-2.5 min-h-0">
        {messages.map((m, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.2 }}
            className={`max-w-[88%] px-4 py-3 text-[13.5px] leading-[1.65] ${
              m.role === "user" ? "self-end" : "self-start"
            }`}
            style={{
              background:
                m.role === "user"
                  ? "linear-gradient(135deg, #B05CE6, #D45DA0)"
                  : "#F6F0FF",
              color: m.role === "user" ? "white" : "#4A3D5E",
              borderRadius:
                m.role === "user" ? "18px 18px 6px 18px" : "18px 18px 18px 6px",
            }}
          >
            {m.content}
          </motion.div>
        ))}

        {/* Loading dots */}
        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="self-start px-5 py-3.5 rounded-[18px] rounded-bl-[6px] flex gap-[5px]"
            style={{ background: "#F6F0FF" }}
          >
            {[0, 1, 2].map(i => (
              <motion.div
                key={i}
                className="w-[7px] h-[7px] rounded-full"
                style={{ background: "#C7B8DA" }}
                animate={{ y: [0, -5, 0], opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 1.3, repeat: Infinity, delay: i * 0.15 }}
              />
            ))}
          </motion.div>
        )}

        {/* Starter prompts */}
        <AnimatePresence>
          {showStarters && !isLoading && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="self-start flex flex-col gap-2 mt-1"
            >
              <p className="text-[11px] font-semibold px-1" style={{ color: "#A897BD" }}>
                Quick starts:
              </p>
              {STARTER_PROMPTS.map(p => (
                <button
                  key={p}
                  onClick={() => handleSend(p)}
                  className="text-left text-[12px] font-medium px-3 py-2 rounded-xl border transition-all hover:border-[#C77DFF] hover:bg-[rgba(199,125,255,0.04)]"
                  style={{
                    borderColor: "rgba(180,150,210,0.2)",
                    color: "#6B5C80",
                    background: "rgba(200,180,220,0.04)",
                    cursor: "pointer",
                    fontFamily: FONT,
                  }}
                >
                  {p}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        <div ref={messagesEndRef} />
      </div>

      {/* ── Resolved style card ── */}
      <AnimatePresence>
        {resolved && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mx-4 mb-3 rounded-[16px] border p-4 flex-shrink-0"
            style={{
              background: "linear-gradient(135deg, rgba(232,213,255,0.3), rgba(255,213,229,0.3))",
              borderColor: "rgba(180,150,210,0.2)",
            }}
          >
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-3.5 h-3.5" style={{ color: "#B05CE6" }} />
              <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: "#8B5CB8" }}>
                Your style
              </span>
            </div>
            <p className="text-[13px] font-bold mb-0.5" style={{ color: "#2D2235" }}>
              {resolved.artStyle}
            </p>
            <p className="text-[12px] leading-relaxed" style={{ color: "#6B5C80" }}>
              {resolved.summary}
            </p>
            {resolved.colorPalette?.hex?.length > 0 && (
              <div className="flex gap-1.5 mt-2.5">
                {resolved.colorPalette.hex.slice(0, 5).map((hex, i) => (
                  <div
                    key={i}
                    className="w-5 h-5 rounded-full border-2 border-white shadow-sm"
                    style={{ background: hex }}
                    title={hex}
                  />
                ))}
                <span className="text-[11px] self-center ml-1" style={{ color: "#A897BD" }}>
                  {resolved.colorPalette.mood}
                </span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Input ── */}
      <div
        className="flex-shrink-0 px-4 py-3.5 border-t flex flex-col gap-2.5"
        style={{ borderColor: "rgba(180,150,210,0.1)" }}
      >
        {resolved ? (
          <button
            onClick={handleConfirm}
            disabled={isSaving}
            className="w-full py-3.5 rounded-[14px] text-sm font-bold text-white flex items-center justify-center gap-2 transition-all hover:-translate-y-px disabled:opacity-60 relative overflow-hidden"
            style={{
              background: "linear-gradient(135deg, #B05CE6, #D45DA0)",
              boxShadow: "0 4px 16px rgba(176,92,230,0.25)",
              border: "none",
              cursor: "pointer",
              fontFamily: FONT,
            }}
          >
            <div
              className="absolute inset-0 rounded-[inherit]"
              style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.15), transparent)" }}
            />
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin relative z-10" />
            ) : (
              <Check className="w-4 h-4 relative z-10" />
            )}
            <span className="relative z-10">
              {isSaving ? "Saving…" : "Use this style — continue"}
            </span>
          </button>
        ) : (
          <div className="flex gap-2">
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSend()}
              placeholder="Describe the style you're imagining…"
              disabled={isLoading}
              className="flex-1 py-2.5 px-4 rounded-xl border text-[13px] outline-none transition-all"
              style={{
                borderColor: "rgba(180,150,210,0.18)",
                background: "#FDFBFF",
                color: "#2D2235",
                fontFamily: FONT,
              }}
            />
            <button
              onClick={() => handleSend()}
              disabled={!input.trim() || isLoading}
              className="w-10 h-10 rounded-xl text-white flex items-center justify-center transition-all hover:scale-105 disabled:opacity-30 flex-shrink-0"
              style={{
                background: "linear-gradient(135deg, #B05CE6, #D45DA0)",
                boxShadow: "0 3px 12px rgba(176,92,230,0.2)",
                border: "none",
                cursor: "pointer",
              }}
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}