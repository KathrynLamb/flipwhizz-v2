// src/app/stories/[id]/cover/CoverDesignChat.tsx
"use client";

import { useState, useRef, useEffect } from "react";
import {
  Send,
  Loader2,
  Sparkles,
  Wand2,
  Check,
  ImagePlus,
  MessageCircle,
  User,
  MapPin,
  ChevronDown,
  ChevronUp,
  X,
  ZoomIn,
  BookOpen,
  Type,
  Heart,
  UserCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import type { StepKey } from "@/lib/storySteps";
import UnifiedStoryHeader from "@/app/stories/components/StoryHeader";

/* -------------------------------------------------------------------------- */
/*                                   TYPES                                    */
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
  storyId: string; projectId: string; story: Story;
  initialMessages: ChatMsg[];
  currentStep?: StepKey; completedSteps?: StepKey[];
  paymentStatus?: string | null; coverSpreadUrl?: string | null;
  initialCharacterIds?: string[]; initialLocationIds?: string[];
};

const FONT = "'Bricolage Grotesque', system-ui, sans-serif";

/* -------------------------------------------------------------------------- */
/*                            LIGHTBOX                                        */
/* -------------------------------------------------------------------------- */

function Lightbox({ src, onClose }: { src: string; onClose: () => void }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm cursor-pointer" onClick={onClose}>
      <button onClick={onClose} className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center">
        <X className="w-5 h-5 text-white" />
      </button>
      <motion.img initial={{ scale: 0.9 }} animate={{ scale: 1 }} src={src} alt="Cover"
        className="max-w-[95vw] max-h-[90vh] object-contain rounded-lg shadow-2xl cursor-default" onClick={e => e.stopPropagation()} />
    </motion.div>
  );
}

/* -------------------------------------------------------------------------- */
/*                            STAGE PROGRESS                                  */
/* -------------------------------------------------------------------------- */

function StageProgress({ current }: { current: CoverStage }) {
  const stages: { key: CoverStage; icon: any; label: string }[] = [
    { key: "title", icon: Type, label: "Title" },
    { key: "image", icon: ImagePlus, label: "Cover Art" },
    { key: "backcover", icon: Heart, label: "Back Cover" },
    { key: "author", icon: UserCircle, label: "Author" },
    { key: "ready", icon: Check, label: "Generate" },
  ];
  const currentIdx = stages.findIndex(s => s.key === current);

  return (
    <div className="flex items-center justify-center gap-1 px-4 py-2">
      {stages.map((s, i) => {
        const isDone = i < currentIdx;
        const isActive = s.key === current;
        const Icon = s.icon;
        return (
          <div key={s.key} className="flex items-center gap-1">
            <div className="flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold" style={{
              background: isDone ? "rgba(67,184,156,0.1)" : isActive ? "rgba(176,92,230,0.1)" : "rgba(180,150,210,0.06)",
              color: isDone ? "#2FA482" : isActive ? "#B05CE6" : "#C4B5D4",
            }}>
              {isDone ? <Check className="w-3 h-3" /> : <Icon className="w-3 h-3" />}
              <span className="hidden sm:inline">{s.label}</span>
            </div>
            {i < stages.length - 1 && <div className="w-3 h-px" style={{ background: "rgba(180,150,210,0.15)" }} />}
          </div>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                              MAIN COMPONENT                                */
/* -------------------------------------------------------------------------- */

export default function CoverDesignChat({
  storyId, story, projectId, initialMessages,
  currentStep = "cover", completedSteps = [], paymentStatus,
  initialCharacterIds, initialLocationIds,
}: Props) {
  const router = useRouter();

  const [localStory, setLocalStory] = useState<Story>(story);
  const [messages, setMessages] = useState<ChatMsg[]>(initialMessages);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [stage, setStage] = useState<CoverStage>("greeting");

  // Cover plan
  const [confirmedTitle, setConfirmedTitle] = useState(story.title);
  const [coverCharacterIds, setCoverCharacterIds] = useState<Set<string>>(new Set(initialCharacterIds));
  const [coverLocationIds, setCoverLocationIds] = useState<Set<string>>(new Set(initialLocationIds));
// FIXED — seed from cover plan if it exists
const plan = story.coverPlan as any;
const [backCoverContent, setBackCoverContent] = useState(
  plan?.back?.blurbText ?? plan?.back?.dedicationText ?? ""
);
const [authorCredit, setAuthorCredit] = useState(
  plan?.front?.authorText ?? ""
);

  // World
  const [worldCharacters, setWorldCharacters] = useState<WorldCharacter[]>([]);
  const [worldLocations, setWorldLocations] = useState<WorldLocation[]>([]);
  const [worldLoading, setWorldLoading] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const hasStartedRef = useRef(false);
  const knownCoverUrlRef = useRef<string | null>(localStory.coverSpreadUrl);

  const hasCovers = !!localStory.coverSpreadUrl;
  const isGeneratingCovers = localStory.status === "generating_covers";

  /* ── Fetch world ── */
  useEffect(() => {
    if (!storyId) return;
    fetch(`/api/stories/${storyId}/world`).then(r => r.json()).then(d => {
      setWorldCharacters(d.characters ?? []); setWorldLocations(d.locations ?? []);
    }).catch(() => {}).finally(() => setWorldLoading(false));
  }, [storyId]);

  /* ── Auto scroll ── */
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, isLoading]);

  /* ── Poll for cover generation ── */
// FIXED — handles same-URL regeneration + status-based completion
/* ── Poll for cover generation ── */
useEffect(() => {
  if (!isGeneratingCovers) return;
  let pollCount = 0;
  const interval = setInterval(async () => {
    try {
      pollCount++;
      const res = await fetch(`/api/stories/${storyId}`);
      const data = await res.json();
      const newUrl = data.story?.coverSpreadUrl;
      const newStatus = data.story?.status;

      const urlChanged = newUrl && newUrl !== knownCoverUrlRef.current;
      const statusDone = newStatus && newStatus !== "generating_covers";

      if (urlChanged || (statusDone && newUrl)) {
        // Normal completion — URL changed or status updated
        knownCoverUrlRef.current = newUrl;
        setLocalStory(prev => ({
          ...prev,
          coverSpreadUrl: newUrl,
          status: "covers_complete",
        }));
        addAssistantMsg("Your cover is ready! Click the preview to see it full-size. Want any changes, or shall we go with this?");
        clearInterval(interval);
      } else if (statusDone && !newUrl) {
        // Generation finished but no image
        setLocalStory(prev => ({ ...prev, status: newStatus }));
        addAssistantMsg("Cover generation finished but something went wrong — no image was created. Try hitting Generate Cover again.");
        clearInterval(interval);
      } else if (newUrl && pollCount >= 3) {
        // Defensive: URL exists, status stuck on generating_covers
        // Backend likely forgot to update status — treat as complete
        knownCoverUrlRef.current = newUrl;
        setLocalStory(prev => ({
          ...prev,
          coverSpreadUrl: newUrl,
          status: "covers_complete",
        }));
        addAssistantMsg("Your cover is ready! Click the preview to see it full-size. Want any changes, or shall we go with this?");
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
      // Restore stage heuristically
      const all = initialMessages.map(m => m.content).join(" ").toLowerCase();
      if (all.includes("author") || all.includes("written by")) setStage("ready");
      else if (all.includes("dedication") || all.includes("back cover")) setStage("author");
      else if (all.includes("front cover") || all.includes("who should")) setStage("backcover");
      else if (all.includes("title")) setStage("image");
      else setStage("title");
      return;
    }

    if (hasCovers) {
      setStage("ready");
      setMessages([{ role: "assistant", content: "Here's your current cover! Click it to see it full-size. If you'd like changes, just let me know." }]);
      return;
    }

    setIsLoading(true);
    sendToBackend("__START__", "greeting").then(reply => {
      if (reply) { setMessages([{ role: "assistant", content: reply.message }]); if (reply.stage) setStage(reply.stage); }
    }).finally(() => setIsLoading(false));
  }, [storyId, worldLoading]);

  console.log("Messages", messages)

  /* ── Helpers ── */

  function addAssistantMsg(content: string) {
    const msg: ChatMsg = { role: "assistant", content };
    setMessages(prev => [...prev, msg]);
    // fetch("/api/stories/cover-chat/save-message", {
    //   method: "POST", headers: { "Content-Type": "application/json" },
    //   body: JSON.stringify({ storyId, role: "assistant", content }),
    // }).catch(() => {});
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
            locations: worldLocations.map(l => ({ id: l.id, name: l.name })),
          },
          coverCharacterIds: [...coverCharacterIds],
          coverLocationIds: [...coverLocationIds],
        }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      // Handle both old shape (reply) and new shape (message)
      if (!data.message && data.reply) {
        data.message = data.reply;
      }
      return data;
    } catch { return null; }
  }

  /* ── Send message ── */

  async function handleSend() {
    if (!input.trim() || isLoading) return;
    const text = input.trim();
    const userMsg: ChatMsg = { role: "user", content: text };
    setMessages(prev => [...prev, userMsg]);
    // fetch("/api/stories/cover-chat/save-message", {
    //   method: "POST", headers: { "Content-Type": "application/json" },
    //   body: JSON.stringify({ storyId, role: "user", content: text }),
    // }).catch(() => {});
    setInput("");
    setIsLoading(true);



    const reply = await sendToBackend(text, stage);

    if (reply) {
      addAssistantMsg(reply.message);

      if (reply.stage && reply.stage !== stage) setStage(reply.stage);

      if (reply.confirmedTitle) {
        setConfirmedTitle(reply.confirmedTitle);
        fetch(`/api/stories/${storyId}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: reply.confirmedTitle }),
        }).catch(() => {});
      }

      if (reply.coverCharacterIds) setCoverCharacterIds(new Set(reply.coverCharacterIds));
      if (reply.coverLocationIds) setCoverLocationIds(new Set(reply.coverLocationIds));
      if (reply.backCoverContent) setBackCoverContent(reply.backCoverContent);
      if (reply.authorCredit) setAuthorCredit(reply.authorCredit);

      console.log("DEBUG cover state:", {
        charIds: reply.coverCharacterIds,
        worldChars: worldCharacters.map(c => c.id),
        match: reply.coverCharacterIds?.filter((id: string) => worldCharacters.some(c => c.id === id)),
      });
    } else {
      addAssistantMsg("Sorry — something went wrong. Please try again.");
    }

    setIsLoading(false);
  }

  /* ── Generate ── */

  async function handleGenerate() {
    setIsLoading(true);
    try {
      const res = await fetch("/api/stories/generate-cover-prompt", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storyId, conversationHistory: messages,
          mode: hasCovers ? "regenerate" : "generate",
          characters: worldCharacters, locations: worldLocations,
          coverCharacterIds: [...coverCharacterIds], coverLocationIds: [...coverLocationIds],
          confirmedTitle, backCoverContent, authorCredit,
        }),
      });
      if (!res.ok) throw new Error(); 

      addAssistantMsg("Generating your cover now — about 30–60 seconds…");

      setLocalStory(s => ({ ...s, status: "generating_covers" }));
      await fetch(`/api/stories/${storyId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "generating_covers" }),
      }).catch(() => {});

      await fetch("/api/inngest/trigger-covers", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storyId }),
      });
    } catch { alert("Failed to start cover generation."); }
    finally { setIsLoading(false); }
  }

  /* ── Placeholders ── */

  const placeholders: Record<CoverStage, string> = {
    greeting: "Type your message…",
    title: "Type your preferred title, or ask for suggestions…",
    image: "Describe your vision for the front cover…",
    backcover: "Write a dedication, blurb, or character message…",
    author: "Who wrote this book?",
    ready: "Any final tweaks before we generate?",
  };

  /* -------------------------------------------------------------------------- */
  /*                                   RENDER                                   */
  /* -------------------------------------------------------------------------- */

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,300;12..96,400;12..96,600;12..96,700;12..96,800&family=Lora:ital,wght@0,400;0,500;0,600;1,400;1,500&display=swap" rel="stylesheet" />
      <AnimatePresence>{lightboxSrc && <Lightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}</AnimatePresence>

      <div className="min-h-screen h-screen flex flex-col" style={{ fontFamily: FONT }}>
        <div className="fixed inset-0 -z-10" style={{ background: `radial-gradient(ellipse 80% 60% at 20% 10%, rgba(232,190,255,0.3) 0%, transparent 60%), radial-gradient(ellipse 70% 50% at 85% 80%, rgba(255,182,210,0.25) 0%, transparent 55%), #F9F5FF` }}>
          <div className="absolute inset-0 opacity-50" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23c4b5d4' fill-opacity='0.04'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")` }} />
        </div>
        <style jsx global>{`.scrollbar-hide{-ms-overflow-style:none;scrollbar-width:none}.scrollbar-hide::-webkit-scrollbar{display:none}`}</style>

        <UnifiedStoryHeader storyId={storyId} title={confirmedTitle} currentStep={currentStep} completedSteps={completedSteps} paymentStatus={paymentStatus} coverSpreadUrl={localStory.coverSpreadUrl} />

        {!hasCovers && stage !== "greeting" && <StageProgress current={stage} />}

        <main className="flex-1 min-h-0 max-w-[1400px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-2">
          <div className="h-full grid grid-cols-1 lg:grid-cols-5 gap-4">

            {/* ── CHAT ── */}
            <div className="lg:col-span-3 flex flex-col min-h-0">
              <div className="flex-1 flex flex-col min-h-0 overflow-hidden rounded-[22px]" style={{ background: "white", border: "1px solid rgba(180,150,210,0.12)", boxShadow: "0 2px 12px rgba(100,60,140,0.06)" }}>
                <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3 scrollbar-hide" style={{ background: "rgba(249,245,255,0.25)" }}>
                  {messages.length === 0 && isLoading && (
                    <div className="flex items-start gap-2.5"><Avatar side="assistant" /><Bubble side="left"><Loader2 className="w-4 h-4 animate-spin" style={{ color: "#B05CE6" }} /></Bubble></div>
                  )}
                  {messages.length === 0 && !isLoading && (
                    <div className="flex flex-col items-center justify-center h-full text-center">
                      <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ background: "rgba(199,125,255,0.1)" }}>
                        <BookOpen className="w-7 h-7" style={{ color: "#C77DFF" }} />
                      </div>
                      <h3 className="text-lg font-extrabold mb-1" style={{ color: "#2D2235" }}>Design Your Cover</h3>
                      <p className="text-sm max-w-sm" style={{ color: "#7B6E90" }}>Loading your story world…</p>
                    </div>
                  )}
                  {messages.map((m, i) => (
                    <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className={`flex items-start gap-2.5 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
                      <Avatar side={m.role} />
                      <Bubble side={m.role === "user" ? "right" : "left"}>
                        <p className="whitespace-pre-wrap text-[13px] leading-relaxed">{m.content}</p>
                      </Bubble>
                    </motion.div>
                  ))}
                  {isLoading && messages.length > 0 && (
                    <div className="flex items-start gap-2.5"><Avatar side="assistant" /><Bubble side="left">
                      <div className="flex items-center gap-1.5">{[0, 150, 300].map(d => <span key={d} className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: "#C4A8E0", animationDelay: `${d}ms` }} />)}</div>
                    </Bubble></div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div className="p-3 flex-shrink-0 space-y-2" style={{ borderTop: "1px solid rgba(180,150,210,0.08)" }}>
                  <div className="flex gap-2">
                    <input type="text" value={input} onChange={e => setInput(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                      className="flex-1 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none"
                      style={{ background: "rgba(249,245,255,0.6)", border: "1.5px solid rgba(180,150,210,0.15)", color: "#2D2235", fontFamily: "inherit" }}
                      placeholder={placeholders[stage]} disabled={isLoading || isGeneratingCovers} />
                    <button onClick={handleSend} disabled={!input.trim() || isLoading || isGeneratingCovers}
                      className="w-11 h-11 flex-shrink-0 rounded-xl flex items-center justify-center text-white disabled:opacity-40 active:scale-95"
                      style={{ background: "linear-gradient(135deg, #B05CE6, #D45DA0)", border: "none" }}>
                      <Send className="w-4 h-4" />
                    </button>
                  </div>

                  {(stage === "ready" || hasCovers) && !isGeneratingCovers && (
                    <button onClick={handleGenerate} disabled={isLoading}
                      className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-white disabled:opacity-40 active:scale-[0.98]"
                      style={{ background: "linear-gradient(135deg, #B05CE6, #D45DA0)", boxShadow: "0 4px 16px rgba(176,92,230,0.25)", border: "none", fontFamily: "inherit" }}>
                      <Wand2 className="w-4 h-4" /> {hasCovers ? "Regenerate Cover" : "Generate Cover"}
                    </button>
                  )}
                  {isGeneratingCovers && (
                    <button disabled className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-white opacity-70"
                      style={{ background: "rgba(176,92,230,0.5)", border: "none", fontFamily: "inherit" }}>
                      <Loader2 className="w-4 h-4 animate-spin" /> Generating…
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* ── PREVIEW + PLAN ── */}
            <div className="lg:col-span-2 flex flex-col gap-4 min-h-0 overflow-y-auto scrollbar-hide">
              {/* Cover image */}
              <div className="overflow-hidden rounded-[22px] flex-shrink-0" style={{ background: "white", border: "1px solid rgba(180,150,210,0.12)", boxShadow: "0 2px 12px rgba(100,60,140,0.06)" }}>
                <div className="flex items-center gap-3 px-5 py-3" style={{ borderBottom: "1px solid rgba(180,150,210,0.08)", background: "rgba(249,245,255,0.5)" }}>
                  <Sparkles className="w-4 h-4" style={{ color: "#B05CE6" }} />
                  <p className="text-sm font-bold" style={{ color: "#2D2235" }}>Cover Preview</p>
                </div>
                <div className="p-4">
                  {hasCovers && !isGeneratingCovers ? (
                    <div className="space-y-3">
                      <div className="relative overflow-hidden rounded-xl cursor-pointer group" onClick={() => setLightboxSrc(localStory.coverSpreadUrl!)}
                        style={{ boxShadow: "0 4px 20px rgba(100,60,140,0.1)", border: "1px solid rgba(180,150,210,0.1)" }}>
                        <img src={localStory.coverSpreadUrl!} alt="Cover" className="w-full" />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 backdrop-blur-sm rounded-full p-2.5 shadow-lg">
                            <ZoomIn className="w-5 h-5" style={{ color: "#6B5C80" }} />
                          </div>
                        </div>
                      </div>
                      <button onClick={() => router.push(`/stories/${storyId}/print`)}
                        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-white active:scale-[0.98]"
                        style={{ background: "linear-gradient(135deg, #43B89C, #2FA482)", border: "none", fontFamily: "inherit" }}>
                        <Check className="w-4 h-4" /> Approve & Continue
                      </button>
                    </div>
                  ) : isGeneratingCovers ? (
                    <div className="flex flex-col items-center justify-center py-12 rounded-xl" style={{ background: "rgba(249,245,255,0.5)", border: "1px solid rgba(180,150,210,0.1)" }}>
                      <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
                        className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3"
                        style={{ background: "linear-gradient(135deg, #B05CE6, #D45DA0)" }}>
                        <Wand2 className="w-5 h-5 text-white" />
                      </motion.div>
                      <p className="text-sm font-bold" style={{ color: "#2D2235" }}>Creating your cover…</p>
                      <p className="text-[11px] mt-1" style={{ color: "#A897BD" }}>About 30–60 seconds</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-10 rounded-xl" style={{ border: "2px dashed rgba(180,150,210,0.2)", background: "rgba(249,245,255,0.3)" }}>
                      <ImagePlus className="w-8 h-8 mb-2" style={{ color: "#D4C6E6" }} />
                      <p className="text-sm font-medium" style={{ color: "#A897BD" }}>Cover will appear here</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Cover plan summary */}
              {stage !== "greeting" && (
                <div className="rounded-[22px] overflow-hidden flex-shrink-0" style={{ background: "white", border: "1px solid rgba(180,150,210,0.12)" }}>
                  <div className="px-5 py-3" style={{ borderBottom: "1px solid rgba(180,150,210,0.08)", background: "rgba(249,245,255,0.5)" }}>
                    <p className="text-sm font-bold" style={{ color: "#2D2235" }}>Cover Plan</p>
                  </div>
                  <div className="p-4 space-y-2.5 text-[12px]">
                    <PlanRow label="Title" value={confirmedTitle} done={["image", "backcover", "author", "ready"].includes(stage)} />
                    <PlanRow 
                        label="Front Cover" 
                        value={
                          coverCharacterIds.size > 0 
                            ? worldCharacters.filter(c => coverCharacterIds.has(c.id)).map(c => c.name).join(", ") || `${coverCharacterIds.size} characters selected`
                            : ["backcover", "author", "ready"].includes(stage) 
                              ? "Discussed in chat" 
                              : ""
                        } 
                        done={["backcover", "author", "ready"].includes(stage)} 
                      />    
                      <PlanRow label="Back Cover" 
                          value={backCoverContent ? (backCoverContent.length > 50 ? backCoverContent.slice(0, 50) + "…" : backCoverContent) : ""} 
                          done={!!backCoverContent || ["author", "ready"].includes(stage)} 
                        />
                        <PlanRow label="Author" 
                          value={authorCredit} 
                          done={!!authorCredit || stage === "ready"} 
                        />
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/*  SUB-COMPONENTS                                                             */
/* -------------------------------------------------------------------------- */

function PlanRow({ label, value, done }: { label: string; value: string; done: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0" style={{
        background: done ? "rgba(67,184,156,0.1)" : "rgba(180,150,210,0.08)",
        border: done ? "1.5px solid #43B89C" : "1.5px solid rgba(180,150,210,0.15)",
      }}>
        {done && <Check className="w-3 h-3" style={{ color: "#2FA482" }} />}
      </div>
      <span className="font-bold" style={{ color: "#6B5C80" }}>{label}:</span>
      <span className="flex-1 truncate" style={{ color: value ? "#2D2235" : "#C4B5D4" }}>{value || "Not set yet"}</span>
    </div>
  );
}

function Avatar({ side }: { side: string }) {
  if (side === "assistant" || side === "left") {
    return (
      <div className="w-7 h-7 flex-shrink-0 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, #B05CE6, #D45DA0)" }}>
        <Sparkles className="w-3.5 h-3.5 text-white" />
      </div>
    );
  }
  return (
    <div className="w-7 h-7 flex-shrink-0 rounded-lg flex items-center justify-center" style={{ background: "rgba(199,125,255,0.1)" }}>
      <span className="text-[9px] font-bold" style={{ color: "#9B59D0" }}>You</span>
    </div>
  );
}

function Bubble({ side, children }: { side: "left" | "right"; children: React.ReactNode }) {
  return (
    <div className={`max-w-[80%] px-3.5 py-2.5 text-[13px] leading-relaxed ${side === "right" ? "rounded-2xl rounded-tr-md text-white" : "rounded-2xl rounded-tl-md"}`}
      style={side === "right" ? { background: "linear-gradient(135deg, #B05CE6, #D45DA0)" } : { background: "white", color: "#2D2235", border: "1px solid rgba(180,150,210,0.12)" }}>
      {children}
    </div>
  );
}