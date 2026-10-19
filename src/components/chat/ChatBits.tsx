// src/components/chat/ChatBits.tsx
"use client";

// Shared pieces of the story chat, used by the start page (/projects/create)
// and the signed-in story studio (/chat). Same bubbles, typing dots and
// composer as the homepage's chat starter, so the whole journey looks like
// one conversation.

import type { ReactNode, RefObject } from "react";
import { motion } from "framer-motion";
import { Loader2, ArrowUp } from "lucide-react";

export function ChatBubble({ from, children }: { from: "fw" | "you"; children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.25, ease: [0.3, 1.4, 0.5, 1] }}
      className={`flex ${from === "you" ? "justify-end" : "justify-start"}`}
    >
      <p
        className={`m-0 max-w-[88%] whitespace-pre-wrap break-words px-5 py-3.5 text-[17px] font-medium leading-[1.5] sm:max-w-[80%] ${
          from === "you"
            ? "origin-bottom-right rounded-[22px] rounded-br-[6px] bg-[#FBD3E0] text-[#24182F]"
            : "origin-bottom-left rounded-[22px] rounded-bl-[6px] bg-[#6F4BB0] text-white"
        }`}
      >
        {children}
      </p>
    </motion.div>
  );
}

export function TypingBubble() {
  return (
    <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex justify-start">
      <div aria-label="FlipWhizz is typing" className="flex gap-1.5 rounded-[22px] rounded-bl-[6px] bg-[#6F4BB0] px-5 py-[18px]">
        {[0, 0.15, 0.3].map((d) => (
          <motion.span
            key={d}
            animate={{ y: [0, -5, 0], opacity: [0.55, 1, 0.55] }}
            transition={{ repeat: Infinity, duration: 1, delay: d, ease: "easeInOut" }}
            className="block h-2 w-2 rounded-full bg-white"
          />
        ))}
      </div>
    </motion.div>
  );
}

export function StatusBubble({ children }: { children: ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex justify-start">
      <div className="flex items-center gap-2.5 rounded-[22px] rounded-bl-[6px] bg-[#6F4BB0] px-5 py-3.5 text-[17px] font-medium text-white">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        {children}
      </div>
    </motion.div>
  );
}

/** Free replies left in the demo, shown as dots rather than a warning. */
export function RepliesLeft({ remaining, total }: { remaining: number; total: number }) {
  return (
    <div className="mb-2.5 flex items-center justify-center gap-2.5 text-[14px] font-semibold text-[#6A5E73]">
      <span className="flex gap-1" aria-hidden="true">
        {Array.from({ length: total }, (_, i) => (
          <span key={i} className={`h-2 w-2 rounded-full transition-colors ${i < total - remaining ? "bg-[#E8455C]" : "bg-[#E4DCF0]"}`} />
        ))}
      </span>
      {remaining} more {remaining === 1 ? "reply" : "replies"} to shape the story
    </div>
  );
}

export function ChatComposer({
  textareaRef,
  value,
  onChange,
  onSend,
  placeholder,
  disabled,
  loading,
  maxHeight = 140,
}: {
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  placeholder: string;
  disabled: boolean;
  loading: boolean;
  maxHeight?: number;
}) {
  const canSend = Boolean(value.trim()) && !disabled && !loading;
  return (
    <div className="flex items-end gap-2 rounded-[28px] border-[1.5px] border-[#E4DCF0] bg-white p-1.5 pl-5 shadow-[0_16px_40px_-24px_rgba(36,24,47,0.45)] transition focus-within:border-[#A270C9] focus-within:ring-4 focus-within:ring-[#A270C9]/15">
      <label className="sr-only" htmlFor="story-chat-input">Your reply</label>
      <textarea
        id="story-chat-input"
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && canSend) {
            e.preventDefault();
            onSend();
          }
        }}
        placeholder={placeholder}
        disabled={disabled}
        rows={1}
        className="min-h-[44px] w-full resize-none border-0 bg-transparent py-[11px] text-[17px] leading-[1.4] text-[#24182F] outline-none placeholder:text-[#8B7F95] focus:ring-0 disabled:cursor-not-allowed disabled:opacity-60"
        style={{ maxHeight }}
      />
      <button
        type="button"
        onClick={onSend}
        disabled={!canSend}
        aria-label="Send"
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-all duration-200 active:scale-90 disabled:cursor-not-allowed ${
          canSend ? "bg-[#E8455C] text-white shadow-[0_8px_18px_-6px_rgba(232,69,92,0.6)]" : "bg-[#F1ECF7] text-[#B5A9C2]"
        }`}
      >
        {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ArrowUp className="h-5 w-5" strokeWidth={2.5} />}
      </button>
    </div>
  );
}

/** Shown when the free demo replies are used up: carry on into the real book. */
export function ContinueCard({
  title,
  body,
  onContinue,
  onReset,
  busy,
  continueDisabled,
}: {
  title: string;
  body: string;
  onContinue: () => void;
  onReset: () => void;
  busy: boolean;
  continueDisabled?: boolean;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="relative overflow-hidden rounded-[28px] bg-[#FFE7C2] p-6 sm:p-7">
      <span aria-hidden="true" className="absolute -right-10 -top-10 h-36 w-36 rounded-[46%_54%_50%_50%/54%_46%_54%_46%] bg-[#FBD3E0]" />
      <div className="relative">
        <h2 className="m-0 text-[24px] font-bold leading-tight tracking-[-0.02em] text-[#24182F]">{title}</h2>
        <p className="mb-0 mt-2 max-w-[44ch] text-[16px] leading-[1.55] text-[#4E4259]">{body}</p>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onContinue}
            disabled={busy || continueDisabled}
            className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-full bg-[#E8455C] px-6 text-[16px] font-bold text-white shadow-[0_10px_24px_-8px_rgba(232,69,92,0.55)] transition-transform hover:-translate-y-0.5 active:scale-[0.97] disabled:opacity-60"
          >
            {busy ? (<><Loader2 className="h-4 w-4 animate-spin" /> Creating your book…</>) : "Continue and create my book"}
          </button>
          <button
            type="button"
            onClick={onReset}
            disabled={busy}
            className="min-h-[48px] rounded-full px-3 text-[15px] font-semibold text-[#24182F] underline underline-offset-4 disabled:opacity-60"
          >
            Start again
          </button>
        </div>
      </div>
    </motion.div>
  );
}
