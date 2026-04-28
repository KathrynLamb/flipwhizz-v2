// src/app/stories/[id]/cover/MobileCoverChat.tsx
"use client";

import { useState, useRef, useEffect } from "react";
import {
  Send, Loader2, Sparkles, Wand2, Check,
  ImagePlus, ZoomIn, X, ChevronRight,
  Type, Heart, UserCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import type { StepKey } from "@/lib/storySteps";

/* -------------------------------------------------------------------------- */
/*  TYPES (mirrored from parent)                                               */
/* -------------------------------------------------------------------------- */

type ChatMsg = { role: "user" | "assistant"; content: string };
type CoverStage = "greeting" | "title" | "image" | "backcover" | "author" | "ready";

type Story = {
  id: string;
  projectId: string;
  title: string;
  coverSpreadUrl: string | null;
  status: string | null;
  pdfUrl: string | null;
  coverPlan: any;
};

type WorldCharacter = {
  id: string; name: string; description: string | null; appearance: string | null;
  portraitImageUrl: string | null; imageUrl: string | null; role: string | null;
};

type WorldLocation = {
  id: string; name: string; description: string | null;
  portraitImageUrl: string | null; imageUrl: string | null; significance: string | null;
};

type Props = {
  storyId: string;
  projectId: string;
  story: Story;
  initialMessages: ChatMsg[];
  currentStep?: StepKey;
  completedSteps?: StepKey[];
  paymentStatus?: string | null;
  coverSpreadUrl?: string | null;
  initialCharacterIds?: string[];
  initialLocationIds?: string[];
};

/* -------------------------------------------------------------------------- */
/*  STAGE CONFIG                                                               */
/* -------------------------------------------------------------------------- */

const STAGES: { key: CoverStage; icon: any; label: string }[] = [
  { key: "title",     icon: Type,       label: "Title"     },
  { key: "image",     icon: ImagePlus,  label: "Art"       },
  { key: "backcover", icon: Heart,      label: "Back"      },
  { key: "author",    icon: UserCircle, label: "Author"    },
  { key: "ready",     icon: Check,      label: "Generate"  },
];

const PLACEHOLDERS: Record<CoverStage, string> = {
  greeting:  "Type your message…",
  title:     "Your title, or ask for suggestions…",
  image:     "Describe your vision for the cover…",
  backcover: "A dedication or message for the back…",
  author:    "Who wrote this book?",
  ready:     "Any final tweaks?",
};

/* -------------------------------------------------------------------------- */
/*  LIGHTBOX                                                                   */
/* -------------------------------------------------------------------------- */

function Lightbox({ src, onClose }: { src: string; onClose: () => void }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-md"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-5 right-5 z-10 w-10 h-10 rounded-full bg-white/15 flex items-center justify-center"
      >
        <X className="w-5 h-5 text-white" />
      </button>
      <motion.img
        initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        src={src} alt="Cover preview"
        className="max-w-[95vw] max-h-[88vh] object-contain rounded-2xl shadow-2xl"
        onClick={e => e.stopPropagation()}
      />
    </motion.div>
  );
}

/* -------------------------------------------------------------------------- */
/*  STAGE PROGRESS BAR                                                         */
/* -------------------------------------------------------------------------- */

function MobileStageProgress({ current }: { current: CoverStage }) {
  const currentIdx = STAGES.findIndex(s => s.key === current);

  return (
    <div className="flex items-center px-4 py-2 gap-1 overflow-x-auto scrollbar-hide">
      {STAGES.map((s, i) => {
        const isDone   = i < currentIdx;
        const isActive = s.key === current;
        const Icon     = s.icon;

        return (
          <div key={s.key} className="flex items-center gap-1 flex-shrink-0">
            <div
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[11px] font-bold transition-all"
              style={{
                background: isDone
                  ? "rgba(67,184,156,0.12)"
                  : isActive
                    ? "rgba(176,92,230,0.12)"
                    : "rgba(180,150,210,0.06)",
                color: isDone ? "#2FA482" : isActive ? "#B05CE6" : "#C4B5D4",
                border: isActive ? "1.5px solid rgba(176,92,230,0.25)" : "1.5px solid transparent",
              }}
            >
              {isDone
                ? <Check className="w-3 h-3" />
                : <Icon className="w-3 h-3" />
              }
              <span>{s.label}</span>
            </div>
            {i < STAGES.length - 1 && (
              <ChevronRight className="w-3 h-3 flex-shrink-0" style={{ color: "rgba(180,150,210,0.3)" }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  COVER THUMBNAIL (inline in chat)                                           */
/* -------------------------------------------------------------------------- */

function CoverThumbnail({ url, onTap, onApprove }: {
  url: string;
  onTap: () => void;
  onApprove: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 24 }}
      className="mx-2 my-1 rounded-2xl overflow-hidden"
      style={{
        background: "white",
        border: "1px solid rgba(180,150,210,0.15)",
        boxShadow: "0 4px 20px rgba(100,60,140,0.1)",
      }}
    >
      <div className="relative cursor-pointer group" onClick={onTap}>
        <img src={url} alt="Your cover" className="w-full rounded-t-2xl" />
        <div className="absolute inset-0 bg-black/0 group-active:bg-black/10 transition-colors flex items-center justify-center">
          <div className="opacity-0 group-active:opacity-100 bg-white/90 rounded-full p-2.5 shadow-lg">
            <ZoomIn className="w-5 h-5" style={{ color: "#6B5C80" }} />
          </div>
        </div>
        <div
          className="absolute bottom-0 left-0 right-0 flex items-center justify-center gap-1 py-1.5 text-[10px] font-semibold"
          style={{ background: "rgba(0,0,0,0.35)", color: "rgba(255,255,255,0.8)", backdropFilter: "blur(4px)" }}
        >
          <ZoomIn className="w-3 h-3" /> Tap to expand
        </div>
      </div>
      <div className="p-3">
        <button
          onClick={onApprove}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-white active:scale-[0.98] transition-transform"
          style={{ background: "linear-gradient(135deg, #43B89C, #2FA482)", border: "none" }}
        >
          <Check className="w-4 h-4" /> Approve & Continue
        </button>
      </div>
    </motion.div>
  );
}

/* -------------------------------------------------------------------------- */
/*  GENERATING INDICATOR (inline in chat)                                      */
/* -------------------------------------------------------------------------- */

function GeneratingCard() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-2 my-1 rounded-2xl overflow-hidden p-4 flex items-center gap-3"
      style={{
        background: "linear-gradient(135deg, rgba(176,92,230,0.08), rgba(212,93,160,0.08))",
        border: "1px solid rgba(176,92,230,0.15)",
      }}
    >
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: "linear-gradient(135deg, #B05CE6, #D45DA0)" }}
      >
        <Wand2 className="w-4 h-4 text-white" />
      </motion.div>
      <div>
        <p className="text-sm font-bold" style={{ color: "#2D2235" }}>Creating your cover…</p>
        <p className="text-[11px] mt-0.5" style={{ color: "#A897BD" }}>About 30–60 seconds</p>
      </div>
    </motion.div>
  );
}

/* -------------------------------------------------------------------------- */
/*  MAIN COMPONENT                                                             */
/* -------------------------------------------------------------------------- */

export default function MobileCoverChat({
  storyId, story, projectId, initialMessages,
  currentStep = "cover", completedSteps = [],
  paymentStatus, initialCharacterIds, initialLocationIds,
}: Props) {
  const router = useRouter();

  const [localStory,        setLocalStory]        = useState<Story>(story);
  const [messages,          setMessages]          = useState<ChatMsg[]>(initialMessages);
  const [input,             setInput]             = useState("");
  const [isLoading,         setIsLoading]         = useState(false);
  const [stage,             setStage]             = useState<CoverStage>("greeting");
  const [lightboxSrc,       setLightboxSrc]       = useState<string | null>(null);
  const [worldCharacters,   setWorldCharacters]   = useState<WorldCharacter[]>([]);
  const [worldLocations,    setWorldLocations]    = useState<WorldLocation[]>([]);
  const [worldLoading,      setWorldLoading]      = useState(true);

  // Cover plan
  const plan = story.coverPlan as any;
  const [confirmedTitle,    setConfirmedTitle]    = useState(story.title);
  const [coverCharacterIds, setCoverCharacterIds] = useState<Set<string>>(new Set(initialCharacterIds));
  const [coverLocationIds,  setCoverLocationIds]  = useState<Set<string>>(new Set(initialLocationIds));
  const [backCoverContent,  setBackCoverContent]  = useState(plan?.back?.blurbText ?? plan?.back?.dedicationText ?? "");
  const [authorCredit,      setAuthorCredit]      = useState(plan?.front?.authorText ?? "");

  const messagesEndRef        = useRef<HTMLDivElement>(null);
  const inputRef              = useRef<HTMLInputElement>(null);
  const hasStartedRef         = useRef(false);
  const knownCoverUrlRef      = useRef<string | null>(localStory.coverSpreadUrl);

  const hasCovers         = !!localStory.coverSpreadUrl;
  const isGeneratingCovers = localStory.status === "generating_covers";

  /* ── Fetch world ── */
  useEffect(() => {
    if (!storyId) return;
    fetch(`/api/stories/${storyId}/world`)
      .then(r => r.json())
      .then(d => {
        setWorldCharacters(d.characters ?? []);
        setWorldLocations(d.locations ?? []);
      })
      .catch(() => {})
      .finally(() => setWorldLoading(false));
  }, [storyId]);

  /* ── Auto scroll ── */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  /* ── Poll for cover ── */
  useEffect(() => {
    if (!isGeneratingCovers) return;
    let pollCount = 0;
    const interval = setInterval(async () => {
      try {
        pollCount++;
        const res  = await fetch(`/api/stories/${storyId}`);
        const data = await res.json();
        const newUrl    = data.story?.coverSpreadUrl;
        const newStatus = data.story?.status;

        const urlChanged  = newUrl && newUrl !== knownCoverUrlRef.current;
        const statusDone  = newStatus && newStatus !== "generating_covers";

        if (urlChanged || (statusDone && newUrl)) {
          knownCoverUrlRef.current = newUrl;
          setLocalStory(prev => ({ ...prev, coverSpreadUrl: newUrl, status: "covers_complete" }));
          addAssistantMsg("Your cover is ready! Tap to see it full-size. Want any changes, or shall we go with this?");
          clearInterval(interval);
        } else if (statusDone && !newUrl) {
          setLocalStory(prev => ({ ...prev, status: newStatus }));
          addAssistantMsg("Cover generation finished but something went wrong — no image was created. Try generating again.");
          clearInterval(interval);
        } else if (newUrl && pollCount >= 3) {
          knownCoverUrlRef.current = newUrl;
          setLocalStory(prev => ({ ...prev, coverSpreadUrl: newUrl, status: "covers_complete" }));
          addAssistantMsg("Your cover is ready! Tap to see it full-size. Want any changes, or shall we go with this?");
          clearInterval(interval);
        }
      } catch {}
    }, 3000);
    return () => clearInterval(interval);
  }, [isGeneratingCovers, storyId]);

  /* ── Start chat ── */
  useEffect(() => {
    if (hasStartedRef.current || !storyId || worldLoading) return;
    hasStartedRef.current = true;

    if (initialMessages.length > 0) {
      const all = initialMessages.map(m => m.content).join(" ").toLowerCase();
      if      (all.includes("author") || all.includes("written by")) setStage("ready");
      else if (all.includes("dedication") || all.includes("back cover")) setStage("author");
      else if (all.includes("front cover") || all.includes("who should")) setStage("backcover");
      else if (all.includes("title")) setStage("image");
      else setStage("title");
      return;
    }

    if (hasCovers) {
      setStage("ready");
      setMessages([{ role: "assistant", content: "Here's your current cover! Tap it to see full-size. Let me know if you'd like any changes." }]);
      return;
    }

    setIsLoading(true);
    sendToBackend("__START__", "greeting").then(reply => {
      if (reply) {
        setMessages([{ role: "assistant", content: reply.message }]);
        if (reply.stage) setStage(reply.stage);
      }
    }).finally(() => setIsLoading(false));
  }, [storyId, worldLoading]);

  /* ── Helpers ── */

  function addAssistantMsg(content: string) {
    setMessages(prev => [...prev, { role: "assistant", content }]);
  }

  async function sendToBackend(userMessage: string, currentStage: CoverStage) {
    try {
      const res = await fetch("/api/stories/cover-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storyId, message: userMessage, stage: currentStage,
          history: messages, confirmedTitle, backCoverContent, authorCredit,
          world: {
            title: confirmedTitle,
            characters: worldCharacters.map(c => ({ id: c.id, name: c.name, role: c.role })),
            locations:  worldLocations.map(l => ({ id: l.id, name: l.name })),
          },
          coverCharacterIds: [...coverCharacterIds],
          coverLocationIds:  [...coverLocationIds],
        }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      if (!data.message && data.reply) data.message = data.reply;
      return data;
    } catch { return null; }
  }

  /* ── Send ── */

  async function handleSend() {
    if (!input.trim() || isLoading) return;
    const text   = input.trim();
    const userMsg: ChatMsg = { role: "user", content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    const reply = await sendToBackend(text, stage);

    if (reply) {
      addAssistantMsg(reply.message);
      if (reply.stage && reply.stage !== stage)  setStage(reply.stage);
      if (reply.confirmedTitle) {
        setConfirmedTitle(reply.confirmedTitle);
        fetch(`/api/stories/${storyId}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: reply.confirmedTitle }),
        }).catch(() => {});
      }
      if (reply.coverCharacterIds) setCoverCharacterIds(new Set(reply.coverCharacterIds));
      if (reply.coverLocationIds)  setCoverLocationIds(new Set(reply.coverLocationIds));
      if (reply.backCoverContent)  setBackCoverContent(reply.backCoverContent);
      if (reply.authorCredit)      setAuthorCredit(reply.authorCredit);
    } else {
      addAssistantMsg("Sorry — something went wrong. Please try again.");
    }

    setIsLoading(false);
  }

  /* ── Generate ── */

  async function handleGenerate() {
    setIsLoading(true);
    try {
      const strategyReply = await sendToBackend("Please generate the cover now", stage);
      if (strategyReply?.message) addAssistantMsg(strategyReply.message);

      setLocalStory(s => ({ ...s, status: "generating_covers" }));
      await fetch(`/api/stories/${storyId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "generating_covers" }),
      }).catch(() => {});

      await fetch("/api/inngest/trigger-covers", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storyId }),
      });
    } catch {
      addAssistantMsg("Something went wrong starting cover generation. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  /* -------------------------------------------------------------------------- */
  /*  RENDER                                                                     */
  /* -------------------------------------------------------------------------- */

  return (
    <>
      <AnimatePresence>
        {lightboxSrc && <Lightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}
      </AnimatePresence>

      <div
        className="flex flex-col bg-[#F9F5FF]"
        style={{ height: "100dvh", fontFamily: "'Bricolage Grotesque', system-ui, sans-serif" }}
      >
        {/* ── Header ── */}
        <div
          className="flex-shrink-0 flex items-center gap-3 px-4 pt-3 pb-2"
          style={{ borderBottom: "1px solid rgba(180,150,210,0.12)", background: "rgba(255,255,255,0.9)", backdropFilter: "blur(12px)" }}
        >
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "linear-gradient(135deg, #B05CE6, #D45DA0)" }}
          >
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-extrabold truncate" style={{ color: "#2D2235" }}>Design Your Cover</p>
            <p className="text-[11px]" style={{ color: "#A897BD" }}>{confirmedTitle}</p>
          </div>
        </div>

        {/* ── Stage progress ── */}
        {stage !== "greeting" && (
          <div className="flex-shrink-0" style={{ borderBottom: "1px solid rgba(180,150,210,0.08)", background: "rgba(255,255,255,0.6)" }}>
            <MobileStageProgress current={stage} />
          </div>
        )}

        {/* ── Messages ── */}
        <div className="flex-1 min-h-0 overflow-y-auto px-2 py-3 space-y-2">

          {/* Empty state */}
          {messages.length === 0 && !isLoading && (
            <div className="flex flex-col items-center justify-center h-full text-center px-6">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                style={{ background: "linear-gradient(135deg, rgba(176,92,230,0.1), rgba(212,93,160,0.1))" }}
              >
                <ImagePlus className="w-7 h-7" style={{ color: "#B05CE6" }} />
              </div>
              <p className="text-base font-extrabold mb-1" style={{ color: "#2D2235" }}>Let's design your cover</p>
              <p className="text-sm" style={{ color: "#A897BD" }}>Loading your story world…</p>
            </div>
          )}

          {/* Initial loading */}
          {messages.length === 0 && isLoading && (
            <div className="flex items-start gap-2 px-2">
              <BotAvatar />
              <div
                className="px-3.5 py-2.5 rounded-2xl rounded-tl-md flex items-center gap-2"
                style={{ background: "white", border: "1px solid rgba(180,150,210,0.12)" }}
              >
                <Loader2 className="w-4 h-4 animate-spin" style={{ color: "#B05CE6" }} />
                <span className="text-sm" style={{ color: "#A897BD" }}>Just a moment…</span>
              </div>
            </div>
          )}

          {/* Message list */}
          {messages.map((m, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className={`flex items-end gap-2 ${m.role === "user" ? "flex-row-reverse" : ""}`}
            >
              {m.role === "assistant" && <BotAvatar />}
              <div
                className={`max-w-[82%] px-3.5 py-2.5 text-[14px] leading-relaxed ${
                  m.role === "user"
                    ? "rounded-2xl rounded-br-md text-white"
                    : "rounded-2xl rounded-bl-md"
                }`}
                style={
                  m.role === "user"
                    ? { background: "linear-gradient(135deg, #B05CE6, #D45DA0)" }
                    : { background: "white", color: "#2D2235", border: "1px solid rgba(180,150,210,0.12)" }
                }
              >
                <p className="whitespace-pre-wrap">{m.content}</p>
              </div>
            </motion.div>
          ))}

          {/* Typing indicator */}
          {isLoading && messages.length > 0 && (
            <div className="flex items-end gap-2">
              <BotAvatar />
              <div
                className="px-3.5 py-3 rounded-2xl rounded-bl-md flex gap-1.5"
                style={{ background: "white", border: "1px solid rgba(180,150,210,0.12)" }}
              >
                {[0, 150, 300].map(d => (
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

          {/* Generating card — inline in chat */}
          {isGeneratingCovers && <GeneratingCard />}

          {/* Cover thumbnail — inline in chat */}
          {hasCovers && !isGeneratingCovers && (
            <CoverThumbnail
              url={localStory.coverSpreadUrl!}
              onTap={() => setLightboxSrc(localStory.coverSpreadUrl!)}
              onApprove={() => router.push(`/stories/${storyId}/print`)}
            />
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* ── Input bar ── */}
        <div
          className="flex-shrink-0 px-3 pt-2 pb-3 space-y-2"
          style={{
            borderTop: "1px solid rgba(180,150,210,0.1)",
            background: "rgba(255,255,255,0.95)",
            backdropFilter: "blur(12px)",
            paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))",
          }}
        >
          {/* Generate button — above input when ready */}
          {(stage === "ready" || hasCovers) && !isGeneratingCovers && (
            <button
              onClick={handleGenerate}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm font-bold text-white disabled:opacity-40 active:scale-[0.98] transition-transform"
              style={{
                background: "linear-gradient(135deg, #B05CE6, #D45DA0)",
                boxShadow: "0 4px 20px rgba(176,92,230,0.3)",
                border: "none",
              }}
            >
              <Wand2 className="w-4 h-4" />
              {hasCovers ? "Regenerate Cover" : "Generate Cover"}
            </button>
          )}

          {/* Text input row */}
          <div className="flex gap-2 items-end">
            <div
              className="flex-1 flex items-center rounded-2xl px-3.5"
              style={{ background: "rgba(249,245,255,0.8)", border: "1.5px solid rgba(180,150,210,0.18)", minHeight: 44 }}
            >
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleSend(); } }}
                placeholder={PLACEHOLDERS[stage]}
                disabled={isLoading || isGeneratingCovers}
                className="flex-1 bg-transparent border-0 focus:outline-none text-[15px] py-2.5 disabled:opacity-50"
                style={{ color: "#2D2235", fontFamily: "inherit" }}
              />
            </div>
            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoading || isGeneratingCovers}
              className="w-11 h-11 rounded-2xl flex items-center justify-center text-white disabled:opacity-30 active:scale-90 transition-transform flex-shrink-0"
              style={{ background: "linear-gradient(135deg, #B05CE6, #D45DA0)", border: "none" }}
            >
              {isLoading
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Send className="w-4 h-4" style={{ transform: "translateX(1px)" }} />
              }
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/*  SUB-COMPONENTS                                                             */
/* -------------------------------------------------------------------------- */

function BotAvatar() {
  return (
    <div
      className="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0 self-end mb-0.5"
      style={{ background: "linear-gradient(135deg, #B05CE6, #D45DA0)" }}
    >
      <Sparkles className="w-3.5 h-3.5 text-white" />
    </div>
  );
}