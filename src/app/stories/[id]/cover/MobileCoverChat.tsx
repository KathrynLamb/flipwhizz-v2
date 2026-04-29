// src/app/stories/[id]/cover/MobileCoverChat.tsx
"use client";

import { useState, useRef, useEffect } from "react";
import {
  Send, Loader2, Sparkles, Wand2, Check,
  ImagePlus, ZoomIn, X, ChevronDown, ChevronUp,
  Type, Heart, UserCircle, BookOpen,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import type { StepKey } from "@/lib/storySteps";

/* -------------------------------------------------------------------------- */
/*  TYPES                                                                      */
/* -------------------------------------------------------------------------- */

type ChatMsg = { role: "user" | "assistant"; content: string };
type CoverStage = "greeting" | "title" | "image" | "backcover" | "author" | "ready";

type Story = {
  id: string; projectId: string; title: string;
  coverSpreadUrl: string | null; status: string | null;
  pdfUrl: string | null; coverPlan: any;
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
  storyId: string; projectId: string; story: Story;
  initialMessages: ChatMsg[];
  currentStep?: StepKey; completedSteps?: StepKey[];
  paymentStatus?: string | null; coverSpreadUrl?: string | null;
  initialCharacterIds?: string[]; initialLocationIds?: string[];
};

/* -------------------------------------------------------------------------- */
/*  STAGE CONFIG                                                               */
/* -------------------------------------------------------------------------- */

const STAGES: { key: CoverStage; icon: any; label: string; emptyLabel: string }[] = [
  { key: "title",     icon: Type,       label: "Title",    emptyLabel: "Not set yet"   },
  { key: "image",     icon: ImagePlus,  label: "Art",      emptyLabel: "Not discussed" },
  { key: "backcover", icon: Heart,      label: "Back",     emptyLabel: "Not set yet"   },
  { key: "author",    icon: UserCircle, label: "Author",   emptyLabel: "Not set yet"   },
  { key: "ready",     icon: Check,      label: "Generate", emptyLabel: ""              },
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
      <button onClick={onClose} className="absolute top-5 right-5 z-10 w-10 h-10 rounded-full bg-white/15 flex items-center justify-center">
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
/*  STAGE PROGRESS — tappable chips with dropdown                              */
/* -------------------------------------------------------------------------- */

type StageData = {
  confirmedTitle: string;
  backCoverContent: string;
  authorCredit: string;
  coverCharacterNames: string[];
};

function MobileStageProgress({ current, stageData }: { current: CoverStage; stageData: StageData }) {
  const [openStage, setOpenStage] = useState<CoverStage | null>(null);
  const currentIdx = STAGES.findIndex(s => s.key === current);

  function getStageSummary(key: CoverStage): string | null {
    switch (key) {
      case "title":     return stageData.confirmedTitle || null;
      case "image":     return stageData.coverCharacterNames.length > 0 ? stageData.coverCharacterNames.join(", ") : null;
      case "backcover": return stageData.backCoverContent || null;
      case "author":    return stageData.authorCredit || null;
      default:          return null;
    }
  }

  function toggle(key: CoverStage) {
    setOpenStage(prev => prev === key ? null : key);
  }

  return (
    <div>
      <div className="flex items-center px-3 py-2 gap-1.5 overflow-x-auto scrollbar-hide">
        {STAGES.map((s, i) => {
          const isDone   = i < currentIdx;
          const isActive = s.key === current;
          const isOpen   = openStage === s.key;
          const tappable = (isDone || isActive) && s.key !== "ready";
          const Icon     = s.icon;

          return (
            <div key={s.key} className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={() => tappable && toggle(s.key)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[11px] font-bold transition-all"
                style={{
                  background: isDone ? "rgba(67,184,156,0.12)" : isActive ? "rgba(176,92,230,0.12)" : "rgba(180,150,210,0.06)",
                  color: isDone ? "#2FA482" : isActive ? "#B05CE6" : "#C4B5D4",
                  border: isOpen ? "1.5px solid rgba(67,184,156,0.35)" : isActive ? "1.5px solid rgba(176,92,230,0.25)" : "1.5px solid transparent",
                  cursor: tappable ? "pointer" : "default",
                }}
              >
                {isDone ? <Check className="w-3 h-3" /> : <Icon className="w-3 h-3" />}
                <span>{s.label}</span>
                {tappable && (isOpen ? <ChevronUp className="w-3 h-3 opacity-60" /> : <ChevronDown className="w-3 h-3 opacity-40" />)}
              </button>
              {i < STAGES.length - 1 && (
                <div className="w-2 h-px flex-shrink-0" style={{ background: "rgba(180,150,210,0.2)" }} />
              )}
            </div>
          );
        })}
      </div>

      <AnimatePresence>
        {openStage && openStage !== "ready" && (
          <motion.div
            key={openStage}
            initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mx-3 mb-2 px-3.5 py-2.5 rounded-xl" style={{ background: "rgba(249,245,255,0.9)", border: "1px solid rgba(180,150,210,0.12)" }}>
              {(() => {
                const summary = getStageSummary(openStage);
                const s = STAGES.find(x => x.key === openStage)!;
                return summary
                  ? <p className="text-[12px] leading-relaxed" style={{ color: "#4A3D5E" }}><span className="font-bold" style={{ color: "#7B5EA7" }}>{s.label}: </span>{summary}</p>
                  : <p className="text-[12px] italic" style={{ color: "#C4B5D4" }}>{s.emptyLabel}</p>;
              })()}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  COVER THUMBNAIL                                                            */
/* -------------------------------------------------------------------------- */

function CoverThumbnail({ url, onTap, onApprove }: { url: string; onTap: () => void; onApprove: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 24 }}
      className="mx-2 my-1 rounded-2xl overflow-hidden"
      style={{ background: "white", border: "1px solid rgba(180,150,210,0.15)", boxShadow: "0 4px 20px rgba(100,60,140,0.1)" }}
    >
      <div className="relative cursor-pointer" onClick={onTap}>
        <img src={url} alt="Your cover" className="w-full rounded-t-2xl" />
        <div className="absolute bottom-0 left-0 right-0 flex items-center justify-center gap-1 py-1.5 text-[10px] font-semibold"
          style={{ background: "rgba(0,0,0,0.35)", color: "rgba(255,255,255,0.85)", backdropFilter: "blur(4px)" }}>
          <ZoomIn className="w-3 h-3" /> Tap to expand
        </div>
      </div>
      <div className="p-3">
        <button onClick={onApprove}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-white active:scale-[0.98] transition-transform"
          style={{ background: "linear-gradient(135deg, #43B89C, #2FA482)", border: "none" }}>
          <Check className="w-4 h-4" /> Approve & Continue
        </button>
      </div>
    </motion.div>
  );
}

/* -------------------------------------------------------------------------- */
/*  GENERATING CARD                                                            */
/* -------------------------------------------------------------------------- */

function GeneratingCard() {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="mx-2 my-1 rounded-2xl p-4 flex items-center gap-3"
      style={{ background: "linear-gradient(135deg, rgba(176,92,230,0.08), rgba(212,93,160,0.08))", border: "1px solid rgba(176,92,230,0.15)" }}>
      <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: "linear-gradient(135deg, #B05CE6, #D45DA0)" }}>
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

  const plan = story.coverPlan as any;
  const [confirmedTitle,    setConfirmedTitle]    = useState(story.title);
  const [coverCharacterIds, setCoverCharacterIds] = useState<Set<string>>(new Set(initialCharacterIds));
  const [coverLocationIds,  setCoverLocationIds]  = useState<Set<string>>(new Set(initialLocationIds));
  const [backCoverContent,  setBackCoverContent]  = useState(plan?.back?.blurbText ?? plan?.back?.dedicationText ?? "");
  const [authorCredit,      setAuthorCredit]      = useState(plan?.front?.authorText ?? "");

  const messagesEndRef   = useRef<HTMLDivElement>(null);
  const inputRef         = useRef<HTMLTextAreaElement>(null);
  const hasStartedRef    = useRef(false);
  const knownCoverUrlRef = useRef<string | null>(localStory.coverSpreadUrl);

  const hasCovers          = !!localStory.coverSpreadUrl;
  const isGeneratingCovers = localStory.status === "generating_covers";

  /* ── Lock portrait + kill bounce ── */
  useEffect(() => {
    document.body.style.overflow             = "hidden";
    document.body.style.overscrollBehavior   = "none";
    document.documentElement.style.overflow  = "hidden";
    document.documentElement.style.overscrollBehavior = "none";
    try { (screen.orientation as any)?.lock?.("portrait"); } catch {}
    return () => {
      document.body.style.overflow             = "";
      document.body.style.overscrollBehavior   = "";
      document.documentElement.style.overflow  = "";
      document.documentElement.style.overscrollBehavior = "";
      try { (screen.orientation as any)?.unlock?.(); } catch {}
    };
  }, []);

  /* ── Fetch world ── */
  useEffect(() => {
    if (!storyId) return;
    fetch(`/api/stories/${storyId}/world`).then(r => r.json()).then(d => {
      setWorldCharacters(d.characters ?? []); setWorldLocations(d.locations ?? []);
    }).catch(() => {}).finally(() => setWorldLoading(false));
  }, [storyId]);

  /* ── Auto scroll ── */
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, isLoading]);

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
        const urlChanged = newUrl && newUrl !== knownCoverUrlRef.current;
        const statusDone = newStatus && newStatus !== "generating_covers";

        if (urlChanged) {
          knownCoverUrlRef.current = newUrl;
          setLocalStory(prev => ({ ...prev, coverSpreadUrl: newUrl, status: "covers_complete" }));
          addAssistantMsg("Your cover is ready! Tap to see it full-size. Want any changes, or shall we go with this?");
          clearInterval(interval);
        } else if (statusDone && !newUrl) {
          setLocalStory(prev => ({ ...prev, status: newStatus }));
          addAssistantMsg("Cover generation finished but something went wrong — no image was created. Try generating again.");
          clearInterval(interval);
        } 
        // else if (newUrl && pollCount >= 3) {
        //   knownCoverUrlRef.current = newUrl;
        //   setLocalStory(prev => ({ ...prev, coverSpreadUrl: newUrl, status: "covers_complete" }));
        //   addAssistantMsg("Your cover is ready! Tap to see it full-size. Want any changes, or shall we go with this?");
        //   clearInterval(interval);
        // }
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
      if (reply) { setMessages([{ role: "assistant", content: reply.message }]); if (reply.stage) setStage(reply.stage); }
    }).finally(() => setIsLoading(false));
  }, [storyId, worldLoading]);

  /* ── Helpers ── */

  function addAssistantMsg(content: string) {
    setMessages(prev => [...prev, { role: "assistant", content }]);
  }

  async function sendToBackend(userMessage: string, currentStage: CoverStage) {
    try {
      const res = await fetch("/api/stories/cover-chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
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

  async function handleSend() {
    if (!input.trim() || isLoading) return;
    const text = input.trim();
    setMessages(prev => [...prev, { role: "user", content: text }]);
    setInput("");
    setIsLoading(true);
    const reply = await sendToBackend(text, stage);
    if (reply) {
      addAssistantMsg(reply.message);
      if (reply.stage && reply.stage !== stage) setStage(reply.stage);
      if (reply.confirmedTitle) {
        setConfirmedTitle(reply.confirmedTitle);
        fetch(`/api/stories/${storyId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: reply.confirmedTitle }) }).catch(() => {});
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

  async function handleGenerate() {
    knownCoverUrlRef.current = localStory.coverSpreadUrl; // snapshot current before regenerating
    setLocalStory(s => ({ ...s, status: "generating_covers" }));
    setIsLoading(true);
    try {
      const strategyReply = await sendToBackend("Please generate the cover now", stage);
      if (strategyReply?.message) addAssistantMsg(strategyReply.message);
      setLocalStory(s => ({ ...s, status: "generating_covers" }));
      await fetch(`/api/stories/${storyId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "generating_covers" }) }).catch(() => {});
      await fetch("/api/inngest/trigger-covers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ storyId }) });
    } catch {
      addAssistantMsg("Something went wrong starting cover generation. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  const coverCharacterNames = worldCharacters.filter(c => coverCharacterIds.has(c.id)).map(c => c.name);

  /* -------------------------------------------------------------------------- */
  /*  RENDER                                                                     */
  /* -------------------------------------------------------------------------- */

  return (
    <>
      <style>{`
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
      `}</style>

      <AnimatePresence>
        {lightboxSrc && <Lightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}
      </AnimatePresence>

      {/* Root — fixed, no bounce, keyboard-aware via dvh */}
      <div
        className="fixed inset-0 flex flex-col"
        style={{ fontFamily: "'Bricolage Grotesque', system-ui, sans-serif", background: "#F9F5FF", overscrollBehavior: "none", height: "100dvh" }}
      >
        {/* ── FIXED HEADER ── */}
        <div
          className="flex-shrink-0 flex items-center gap-3 px-4 z-20"
          style={{
            paddingTop: "calc(0.75rem + env(safe-area-inset-top))",
            paddingBottom: "0.75rem",
            background: "rgba(255,255,255,0.97)",
            backdropFilter: "blur(16px)",
            borderBottom: "1px solid rgba(180,150,210,0.12)",
          }}
        >
          <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "linear-gradient(135deg, #B05CE6, #D45DA0)" }}>
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-extrabold truncate" style={{ color: "#2D2235" }}>Design Your Cover</p>
            <p className="text-[11px] truncate" style={{ color: "#A897BD" }}>{confirmedTitle}</p>
          </div>
          <BookOpen className="w-4 h-4 flex-shrink-0" style={{ color: "#C4B5D4" }} />
        </div>

        {/* ── STAGE PROGRESS ── */}
        {stage !== "greeting" && (
          <div className="flex-shrink-0 z-10" style={{ background: "rgba(255,255,255,0.9)", borderBottom: "1px solid rgba(180,150,210,0.08)" }}>
            <MobileStageProgress
              current={stage}
              stageData={{ confirmedTitle, backCoverContent, authorCredit, coverCharacterNames }}
            />
          </div>
        )}

        {/* ── MESSAGES ── */}
        <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide px-2 py-3 space-y-2" style={{ overscrollBehavior: "contain" }}>

          {messages.length === 0 && !isLoading && (
            <div className="flex flex-col items-center justify-center h-full text-center px-6">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: "linear-gradient(135deg, rgba(176,92,230,0.1), rgba(212,93,160,0.1))" }}>
                <ImagePlus className="w-7 h-7" style={{ color: "#B05CE6" }} />
              </div>
              <p className="text-base font-extrabold mb-1" style={{ color: "#2D2235" }}>Let's design your cover</p>
              <p className="text-sm" style={{ color: "#A897BD" }}>Loading your story world…</p>
            </div>
          )}

          {messages.length === 0 && isLoading && (
            <div className="flex items-start gap-2 px-2">
              <BotAvatar />
              <div className="px-3.5 py-2.5 rounded-2xl rounded-tl-md flex items-center gap-2" style={{ background: "white", border: "1px solid rgba(180,150,210,0.12)" }}>
                <Loader2 className="w-4 h-4 animate-spin" style={{ color: "#B05CE6" }} />
                <span className="text-sm" style={{ color: "#A897BD" }}>Just a moment…</span>
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}
              className={`flex items-end gap-2 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
              {m.role === "assistant" && <BotAvatar />}
              <div
                className={`max-w-[82%] px-3.5 py-2.5 text-[14px] leading-relaxed ${m.role === "user" ? "rounded-2xl rounded-br-md text-white" : "rounded-2xl rounded-bl-md"}`}
                style={m.role === "user" ? { background: "linear-gradient(135deg, #B05CE6, #D45DA0)" } : { background: "white", color: "#2D2235", border: "1px solid rgba(180,150,210,0.12)" }}
              >
                <p className="whitespace-pre-wrap">{m.content}</p>
              </div>
            </motion.div>
          ))}

          {isLoading && messages.length > 0 && (
            <div className="flex items-end gap-2">
              <BotAvatar />
              <div className="px-3.5 py-3 rounded-2xl rounded-bl-md flex gap-1.5" style={{ background: "white", border: "1px solid rgba(180,150,210,0.12)" }}>
                {[0, 150, 300].map(d => (
                  <motion.span key={d} className="w-2 h-2 rounded-full block" style={{ background: "#C4A8E0" }}
                    animate={{ y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 0.9, delay: d / 1000 }} />
                ))}
              </div>
            </div>
          )}

          {isGeneratingCovers && <GeneratingCard />}

          {hasCovers && !isGeneratingCovers && (
            <CoverThumbnail
              url={localStory.coverSpreadUrl!}
              onTap={() => setLightboxSrc(localStory.coverSpreadUrl!)}
              onApprove={() => router.push(`/stories/${storyId}/print`)}
            />
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* ── INPUT BAR ── */}
        <div
          className="flex-shrink-0 px-3 pt-2 space-y-2"
          style={{ borderTop: "1px solid rgba(180,150,210,0.1)", background: "rgba(255,255,255,0.97)", backdropFilter: "blur(16px)" }}
        >
          {(stage === "ready" || hasCovers) && !isGeneratingCovers && (
            <button onClick={handleGenerate} disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm font-bold text-white disabled:opacity-40 active:scale-[0.98] transition-transform"
              style={{ background: "linear-gradient(135deg, #B05CE6, #D45DA0)", boxShadow: "0 4px 20px rgba(176,92,230,0.3)", border: "none" }}>
              <Wand2 className="w-4 h-4" />
              {hasCovers ? "Regenerate Cover" : "Generate Cover"}
            </button>
          )}

          <div className="flex gap-2 items-end">
            <div className="flex-1 flex items-end rounded-2xl px-3.5 py-2" style={{ background: "rgba(249,245,255,0.8)", border: "1.5px solid rgba(180,150,210,0.18)", minHeight: 44 }}>
              <textarea
                ref={inputRef as any}
                value={input}
                onChange={e => {
                  setInput(e.target.value);
                  // Auto-grow: reset then set to scrollHeight
                  e.target.style.height = "auto";
                  e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
                }}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                placeholder={PLACEHOLDERS[stage]}
                disabled={isLoading || isGeneratingCovers}
                rows={1}
                className="flex-1 bg-transparent border-0 focus:outline-none resize-none disabled:opacity-50 leading-relaxed"
                style={{
                  color: "#2D2235",
                  fontFamily: "inherit",
                  fontSize: "16px", // prevents iOS zoom — must be exactly 16px
                  lineHeight: "1.4",
                  paddingTop: "6px",
                  paddingBottom: "6px",
                  maxHeight: "120px",
                  overflowY: "auto",
                }}
              />
            </div>
            <button onClick={handleSend} disabled={!input.trim() || isLoading || isGeneratingCovers}
              className="w-11 h-11 rounded-2xl flex items-center justify-center text-white disabled:opacity-30 active:scale-90 transition-transform flex-shrink-0 mb-0.5"
              style={{ background: "linear-gradient(135deg, #B05CE6, #D45DA0)", border: "none" }}>
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" style={{ transform: "translateX(1px)" }} />}
            </button>
          </div>
        </div>

        {/* ── FOOTER ── */}
        <div
          className="flex-shrink-0 flex items-center justify-between px-4 py-2"
          style={{
            background: "rgba(255,255,255,0.97)",
            paddingBottom: "calc(0.5rem + env(safe-area-inset-bottom))",
            borderTop: "1px solid rgba(180,150,210,0.06)",
          }}
        >
          <span className="text-[10px] font-bold tracking-widest" style={{ color: "#D4C6E6" }}>FLIPWHIZZ</span>
          <span className="text-[10px]" style={{ color: "#D4C6E6" }}>Cover Design</span>
          <span className="text-[10px]" style={{ color: "#D4C6E6" }}>flipwhizz.com</span>
        </div>
      </div>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/*  BOT AVATAR                                                                 */
/* -------------------------------------------------------------------------- */

function BotAvatar() {
  return (
    <div className="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0 self-end mb-0.5" style={{ background: "linear-gradient(135deg, #B05CE6, #D45DA0)" }}>
      <Sparkles className="w-3.5 h-3.5 text-white" />
    </div>
  );
}