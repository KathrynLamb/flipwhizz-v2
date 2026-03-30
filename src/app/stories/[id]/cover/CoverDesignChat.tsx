// src/app/stories/[id]/cover/CoverDesignChat.tsx
"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Send,
  Loader2,
  Sparkles,
  Wand2,
  Check,
  ImagePlus,
  Palette,
  MessageCircle,
  User,
  MapPin,
  Shirt,
  ChevronDown,
  ChevronUp,
  X,
  ZoomIn,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import type { StepKey } from "@/lib/storySteps";
import UnifiedStoryHeader from "@/app/stories/components/StoryHeader";

/* -------------------------------------------------------------------------- */
/*                                   TYPES                                    */
/* -------------------------------------------------------------------------- */

type ChatMsg = { role: "user" | "assistant"; content: string };

type Story = {
  id: string;
  projectId: string;
  title: string;
  coverSpreadUrl: string | null;
  status: string | null;
  pdfUrl: string | null;
};

type CharacterOutfit = {
  characterId: string;
  outfitKey: string;
  outfitDescription: string;
  isDefault: boolean;
};

type WorldCharacter = {
  id: string;
  name: string;
  description: string | null;
  appearance: string | null;
  portraitImageUrl: string | null;
  referenceImageUrl: string | null;
  imageUrl: string | null;
  role: string | null;
  outfits: CharacterOutfit[];
};

type WorldLocation = {
  id: string;
  name: string;
  description: string | null;
  portraitImageUrl: string | null;
  referenceImageUrl: string | null;
  imageUrl: string | null;
  significance: string | null;
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
/*                              FONT LOADER                                   */
/* -------------------------------------------------------------------------- */

function FontLoader() {
  return (
    <link
      href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,300;12..96,400;12..96,600;12..96,700;12..96,800&family=Lora:ital,wght@0,400;0,500;0,600;1,400;1,500&display=swap"
      rel="stylesheet"
    />
  );
}

/* -------------------------------------------------------------------------- */
/*                            LIGHTBOX COMPONENT                              */
/* -------------------------------------------------------------------------- */

function Lightbox({ src, onClose }: { src: string; onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm cursor-pointer"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
      >
        <X className="w-5 h-5 text-white" />
      </button>
      <motion.img
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300 }}
        src={src}
        alt="Cover preview"
        className="max-w-[95vw] max-h-[90vh] object-contain rounded-lg shadow-2xl cursor-default"
        onClick={(e) => e.stopPropagation()}
      />
    </motion.div>
  );
}

/* -------------------------------------------------------------------------- */
/*                              MAIN COMPONENT                                */
/* -------------------------------------------------------------------------- */

export default function CoverDesignChat({
  storyId,
  story,
  projectId,
  initialMessages,
  currentStep = "cover",
  completedSteps = [],
  paymentStatus,
  coverSpreadUrl: initialCoverUrl,
  initialCharacterIds,
  initialLocationIds,
}: Props) {
  const router = useRouter();

  /* ----------------------------- LOCAL STATE ----------------------------- */

  const [localStory, setLocalStory] = useState<Story>(story);
  const [messages, setMessages] = useState<ChatMsg[]>(initialMessages);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isFinalising, setIsFinalising] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  // World data
  const [worldCharacters, setWorldCharacters] = useState<WorldCharacter[]>([]);
  const [worldLocations, setWorldLocations] = useState<WorldLocation[]>([]);
  const [worldLoading, setWorldLoading] = useState(true);

  const [mentionedCharacterIds, setMentionedCharacterIds] = useState<Set<string>>(
    new Set(initialCharacterIds)
  );
  const [mentionedLocationIds, setMentionedLocationIds] = useState<Set<string>>(
    new Set(initialLocationIds)
  );

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const hasStartedChatRef = useRef(false);

  // Track the cover URL we know about so we can detect changes
  const knownCoverUrlRef = useRef<string | null>(localStory.coverSpreadUrl);

  /* ----------------------------- DERIVED STATE ---------------------------- */

  const hasCovers = !!localStory.coverSpreadUrl;
  const isGeneratingCovers = localStory.status === "generating_covers";

  /* ----------------------------- FETCH WORLD ------------------------------ */

  useEffect(() => {
    if (!storyId) return;
    (async () => {
      try {
        const res = await fetch(`/api/stories/${storyId}/world`);
        if (!res.ok) throw new Error("Failed to fetch world");
        const data = await res.json();
        setWorldCharacters(data.characters ?? []);
        setWorldLocations(data.locations ?? []);
      } catch (err) {
        console.warn("⚠️ Could not load world data:", err);
      } finally {
        setWorldLoading(false);
      }
    })();
  }, [storyId]);

  /* ----------------------------- AUTO SCROLL ------------------------------ */

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  /* ------------------------------ POLLING --------------------------------- */

  useEffect(() => {
    if (!isGeneratingCovers) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/stories/${storyId}`);
        const data = await res.json();
        const newUrl = data.story?.coverSpreadUrl;
        const newStatus = data.story?.status;

        // Detect if cover URL actually changed (not just truthy)
        if (newUrl && newUrl !== knownCoverUrlRef.current) {
          knownCoverUrlRef.current = newUrl;
          setLocalStory((prev) => ({
            ...prev,
            coverSpreadUrl: newUrl,
            status: newStatus ?? prev.status,
          }));

          const autoMessage: ChatMsg = {
            role: "assistant",
            content: "Your cover is ready! Take a look — click it to see it full-size. Want any changes?",
          };
          setMessages((prev) => [...prev, autoMessage]);
          fetch("/api/stories/cover-chat/save-message", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ storyId, role: "assistant", content: autoMessage.content }),
          }).catch(() => {});

          clearInterval(interval);
        } else if (newStatus && newStatus !== "generating_covers") {
          // Status changed but no new cover — generation may have failed
          setLocalStory((prev) => ({ ...prev, status: newStatus }));
          clearInterval(interval);
        }
      } catch {
        // Network error — keep polling
      }
    }, 3000);

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

    if (hasCovers) {
      hasStartedChatRef.current = true;
      setMessages([{
        role: "assistant",
        content: "Here's your current cover! Click it to see it full-size. If you'd like changes — different characters, new background, updated text — just let me know.",
      }]);
      return;
    }

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
            world: {
              characters: worldCharacters.map((c) => ({ id: c.id, name: c.name, role: c.role })),
              locations: worldLocations.map((l) => ({ id: l.id, name: l.name })),
            },
          }),
        });
        const data = await res.json();
        setMessages([{ role: "assistant", content: data.reply }]);
        if (data.mentionedCharacterIds?.length) setMentionedCharacterIds(new Set(data.mentionedCharacterIds));
        if (data.mentionedLocationIds?.length) setMentionedLocationIds(new Set(data.mentionedLocationIds));
      } catch {
        setMessages([{ role: "assistant", content: "Sorry — something went wrong starting the cover chat." }]);
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
          mode: hasCovers ? "revision" : "design",
          message: userMsg.content,
          history: messages,
          world: {
            characters: worldCharacters.map((c) => ({ id: c.id, name: c.name, role: c.role })),
            locations: worldLocations.map((l) => ({ id: l.id, name: l.name })),
          },
        }),
      });
      const data = await res.json();
      setMessages([...nextMessages, { role: "assistant", content: data.reply }]);

      if (data.mentionedCharacterIds?.length) {
        setMentionedCharacterIds((prev) => {
          const next = new Set(prev);
          data.mentionedCharacterIds.forEach((id: string) => next.add(id));
          return next;
        });
      }
      if (data.mentionedLocationIds?.length) {
        setMentionedLocationIds((prev) => {
          const next = new Set(prev);
          data.mentionedLocationIds.forEach((id: string) => next.add(id));
          return next;
        });
      }
    } catch {
      setMessages([...nextMessages, { role: "assistant", content: "Sorry — something went wrong." }]);
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
          characters: worldCharacters,
          locations: worldLocations,
          coverCharacterIds: [...mentionedCharacterIds],
          coverLocationIds: [...mentionedLocationIds],
        }),
      });
      if (!res.ok) throw new Error();

      const lockMessage: ChatMsg = {
        role: "assistant",
        content: "Perfect — generating your cover now. This takes 30–60 seconds…",
      };
      setMessages((m) => [...m, lockMessage]);
      fetch("/api/stories/cover-chat/save-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storyId, role: "assistant", content: lockMessage.content }),
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
      // Set generating status BOTH locally and on the server
      setLocalStory((s) => ({ ...s, status: "generating_covers" }));

      await fetch(`/api/stories/${storyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "generating_covers" }),
      }).catch(() => {});

      await fetch("/api/inngest/trigger-covers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storyId }),
      });
    } catch {
      alert("Failed to start cover generation.");
      setLocalStory((s) => ({ ...s, status: null }));
    }
  }

  async function handleRegenerateWithFeedback(feedback: string) {
    const feedbackMsg: ChatMsg = { role: "user", content: feedback };
    setMessages((prev) => [...prev, feedbackMsg]);

    await fetch("/api/stories/cover-chat/save-message", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storyId, role: "user", content: feedback }),
    }).catch(() => {});

    try {
      await fetch("/api/stories/generate-cover-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storyId,
          conversationHistory: [...messages, feedbackMsg],
          feedback,
          mode: "regenerate",
          characters: worldCharacters,
          locations: worldLocations,
          coverCharacterIds: [...mentionedCharacterIds],
          coverLocationIds: [...mentionedLocationIds],
        }),
      });

      const regenMsg: ChatMsg = {
        role: "assistant",
        content: "Got it! Regenerating your cover — about 30–60 seconds…",
      };
      setMessages((prev) => [...prev, regenMsg]);
      await fetch("/api/stories/cover-chat/save-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storyId, role: "assistant", content: regenMsg.content }),
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
    <>
      <FontLoader />

      {/* Lightbox */}
      <AnimatePresence>
        {lightboxSrc && <Lightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}
      </AnimatePresence>

      <div className="min-h-screen h-screen flex flex-col relative" style={{ fontFamily: "'Bricolage Grotesque', system-ui, sans-serif" }}>
        {/* Background */}
        <div className="fixed inset-0 -z-10" style={{ background: `radial-gradient(ellipse 80% 60% at 20% 10%, rgba(232,190,255,0.3) 0%, transparent 60%), radial-gradient(ellipse 70% 50% at 85% 80%, rgba(255,182,210,0.25) 0%, transparent 55%), radial-gradient(ellipse 50% 40% at 50% 50%, rgba(200,210,255,0.15) 0%, transparent 50%), #F9F5FF` }}>
          <div className="absolute inset-0 opacity-50" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23c4b5d4' fill-opacity='0.04'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")` }} />
        </div>

        <style jsx global>{`
          .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
          .scrollbar-hide::-webkit-scrollbar { display: none; }
        `}</style>

        {/* Header */}
        <UnifiedStoryHeader storyId={storyId} title={story.title || "Cover Design"} currentStep={currentStep} completedSteps={completedSteps} paymentStatus={paymentStatus} coverSpreadUrl={localStory.coverSpreadUrl} />

        {/* Body — fills remaining height, no scroll on desktop */}
        <main className="flex-1 min-h-0 max-w-[1400px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="h-full grid grid-cols-1 lg:grid-cols-5 gap-4">

            {/* ── CHAT (3/5) ── */}
            <div className="lg:col-span-3 flex flex-col min-h-0">
              <div className="flex-1 flex flex-col min-h-0 overflow-hidden rounded-[22px]" style={{ background: "white", border: "1px solid rgba(180,150,210,0.12)", boxShadow: "0 2px 12px rgba(100,60,140,0.06)" }}>
                {/* Chat bar */}
                <div className="flex items-center gap-3 px-5 py-3 flex-shrink-0" style={{ borderBottom: "1px solid rgba(180,150,210,0.08)", background: "rgba(249,245,255,0.5)" }}>
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "rgba(199,125,255,0.1)" }}>
                    <MessageCircle className="w-4 h-4" style={{ color: "#B05CE6" }} />
                  </div>
                  <div>
                    <p className="text-sm font-bold" style={{ color: "#2D2235" }}>Design Conversation</p>
                    <p className="text-[11px]" style={{ color: "#A897BD" }}>Describe your perfect cover</p>
                  </div>
                </div>

                {/* Messages — scrollable, takes remaining space */}
                <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3 scrollbar-hide" style={{ background: "rgba(249,245,255,0.25)" }}>
                  {messages.length === 0 && isLoading && (
                    <div className="flex items-start gap-3">
                      <AvatarAssistant />
                      <Bubble side="left"><Loader2 className="w-4 h-4 animate-spin" style={{ color: "#B05CE6" }} /></Bubble>
                    </div>
                  )}
                  {messages.length === 0 && !isLoading && (
                    <div className="flex flex-col items-center justify-center h-full text-center">
                      <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ background: "rgba(199,125,255,0.1)" }}>
                        <Sparkles className="w-7 h-7" style={{ color: "#C77DFF" }} />
                      </div>
                      <h3 className="text-lg font-extrabold mb-1" style={{ color: "#2D2235" }}>Let's Design Your Cover</h3>
                      <p className="text-sm max-w-sm leading-relaxed" style={{ color: "#7B6E90" }}>Tell me about your vision and I'll create it.</p>
                    </div>
                  )}
                  {messages.map((m, i) => (
                    <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className={`flex items-start gap-2.5 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
                      {m.role === "assistant" ? <AvatarAssistant /> : <AvatarUser />}
                      <Bubble side={m.role === "user" ? "right" : "left"}><p className="whitespace-pre-wrap text-[13px] leading-relaxed">{m.content}</p></Bubble>
                    </motion.div>
                  ))}
                  {isLoading && messages.length > 0 && (
                    <div className="flex items-start gap-2.5">
                      <AvatarAssistant />
                      <Bubble side="left">
                        <div className="flex items-center gap-1.5">
                          {[0, 150, 300].map((delay) => (<span key={delay} className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: "#C4A8E0", animationDelay: `${delay}ms` }} />))}
                        </div>
                      </Bubble>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input — fixed at bottom of chat */}
                <div className="p-3 flex-shrink-0" style={{ borderTop: "1px solid rgba(180,150,210,0.08)" }}>
                  {!hasCovers ? (
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <InputField value={input} onChange={setInput} onSubmit={sendMessage} placeholder="Describe your cover vision…" disabled={isLoading || isFinalising || isGeneratingCovers} />
                        <SendButton onClick={sendMessage} disabled={!input.trim() || isLoading || isFinalising || isGeneratingCovers} loading={false} />
                      </div>
                      <button onClick={finalizeCoverPlan} disabled={isFinalising || messages.length < 2 || isGeneratingCovers} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-40 active:scale-[0.98]" style={{ background: "linear-gradient(135deg, #B05CE6, #D45DA0)", boxShadow: "0 4px 16px rgba(176,92,230,0.25)", border: "none", fontFamily: "inherit" }}>
                        {isFinalising || isGeneratingCovers ? (<><Loader2 className="w-4 h-4 animate-spin" />{isGeneratingCovers ? "Generating…" : "Creating…"}</>) : (<><Wand2 className="w-4 h-4" />Finalise &amp; Generate Cover</>)}
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <InputField value={input} onChange={setInput} onSubmit={sendMessage} placeholder="Describe what needs changing…" disabled={isLoading || isGeneratingCovers} />
                        <SendButton onClick={sendMessage} disabled={!input.trim() || isLoading || isGeneratingCovers} loading={false} />
                      </div>
                      <button
                        onClick={() => handleRegenerateWithFeedback(messages.filter(m => m.role === "user").slice(-1)[0]?.content || "Apply the discussed changes")}
                        disabled={isLoading || isGeneratingCovers || messages.filter(m => m.role === "user").length < 1}
                        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-40 active:scale-[0.98]"
                        style={{ background: "linear-gradient(135deg, #B05CE6, #D45DA0)", boxShadow: "0 4px 16px rgba(176,92,230,0.25)", border: "none", fontFamily: "inherit" }}
                      >
                        {isGeneratingCovers ? (<><Loader2 className="w-4 h-4 animate-spin" />Regenerating…</>) : (<><Wand2 className="w-4 h-4" />Regenerate Cover</>)}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ── PREVIEW + WORLD (2/5) ── */}
            <div className="lg:col-span-2 flex flex-col gap-4 min-h-0 overflow-y-auto scrollbar-hide">

              {/* Cover Preview */}
              <div className="overflow-hidden rounded-[22px] flex-shrink-0" style={{ background: "white", border: "1px solid rgba(180,150,210,0.12)", boxShadow: "0 2px 12px rgba(100,60,140,0.06)" }}>
                <div className="flex items-center gap-3 px-5 py-3" style={{ borderBottom: "1px solid rgba(180,150,210,0.08)", background: "rgba(249,245,255,0.5)" }}>
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "rgba(199,125,255,0.1)" }}>
                    <Sparkles className="w-4 h-4" style={{ color: "#B05CE6" }} />
                  </div>
                  <p className="text-sm font-bold" style={{ color: "#2D2235" }}>Cover Preview</p>
                </div>
                <div className="p-4">
                  {hasCovers && !isGeneratingCovers ? (
                    <div className="space-y-3">
                      <div
                        className="relative overflow-hidden rounded-xl cursor-pointer group"
                        onClick={() => setLightboxSrc(localStory.coverSpreadUrl!)}
                        style={{ boxShadow: "0 4px 20px rgba(100,60,140,0.1)", border: "1px solid rgba(180,150,210,0.1)" }}
                      >
                        <img src={localStory.coverSpreadUrl!} alt="Cover preview" className="w-full" />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 backdrop-blur-sm rounded-full p-2.5 shadow-lg">
                            <ZoomIn className="w-5 h-5" style={{ color: "#6B5C80" }} />
                          </div>
                        </div>
                      </div>
                      <button onClick={handleApprove} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-white transition-all active:scale-[0.98]" style={{ background: "linear-gradient(135deg, #43B89C, #2FA482)", boxShadow: "0 4px 16px rgba(67,184,156,0.25)", border: "none", fontFamily: "inherit" }}>
                        <Check className="w-4 h-4" /> Approve &amp; Continue
                      </button>
                      <p className="text-center text-[11px]" style={{ color: "#A897BD" }}>or request changes in the chat</p>
                    </div>
                  ) : isGeneratingCovers ? (
                    <div className="flex flex-col items-center justify-center py-12 rounded-xl" style={{ background: "linear-gradient(135deg, rgba(249,245,255,0.8), rgba(255,240,248,0.6))", border: "1px solid rgba(180,150,210,0.1)" }}>
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
                        className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3"
                        style={{ background: "linear-gradient(135deg, #B05CE6, #D45DA0)", boxShadow: "0 4px 16px rgba(176,92,230,0.25)" }}
                      >
                        <Wand2 className="w-5 h-5 text-white" />
                      </motion.div>
                      <p className="text-sm font-bold" style={{ color: "#2D2235" }}>Creating your cover…</p>
                      <p className="text-[11px] mt-1" style={{ color: "#A897BD" }}>About 30–60 seconds</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-10 rounded-xl" style={{ border: "2px dashed rgba(180,150,210,0.2)", background: "rgba(249,245,255,0.3)" }}>
                      <ImagePlus className="w-8 h-8 mb-2" style={{ color: "#D4C6E6" }} />
                      <p className="text-sm font-medium" style={{ color: "#A897BD" }}>Cover will appear here</p>
                      <p className="text-[11px] mt-0.5" style={{ color: "#C4B5D4" }}>once you finalise the design</p>
                    </div>
                  )}
                </div>
              </div>

              {/* World Reference Panel */}
              <WorldReferencePanel
                characters={
                  hasCovers && mentionedCharacterIds.size === 0
                    ? worldCharacters
                    : mentionedCharacterIds.size > 0
                      ? worldCharacters.filter((c) => mentionedCharacterIds.has(c.id))
                      : []
                }
                locations={
                  hasCovers && mentionedLocationIds.size === 0
                    ? worldLocations
                    : mentionedLocationIds.size > 0
                      ? worldLocations.filter((l) => mentionedLocationIds.has(l.id))
                      : []
                }
                loading={worldLoading}
              />
            </div>
          </div>
        </main>
      </div>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/*  WORLD REFERENCE PANEL                                                      */
/* -------------------------------------------------------------------------- */

function WorldReferencePanel({ characters, locations, loading }: { characters: WorldCharacter[]; locations: WorldLocation[]; loading: boolean }) {
  const [expanded, setExpanded] = useState(false);

  if (loading) {
    return (
      <div className="rounded-[22px] p-4" style={{ background: "white", border: "1px solid rgba(180,150,210,0.12)" }}>
        <div className="flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" style={{ color: "#B05CE6" }} />
          <span className="text-xs" style={{ color: "#A897BD" }}>Loading story world…</span>
        </div>
      </div>
    );
  }

  if (characters.length === 0 && locations.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-[22px] flex-shrink-0" style={{ background: "white", border: "1px solid rgba(180,150,210,0.12)" }}>
      <button onClick={() => setExpanded((e) => !e)} className="w-full flex items-center justify-between gap-3 px-5 py-3 text-left" style={{ borderBottom: expanded ? "1px solid rgba(180,150,210,0.08)" : "none", background: "rgba(249,245,255,0.5)" }}>
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "rgba(199,125,255,0.1)" }}>
            <User className="w-3.5 h-3.5" style={{ color: "#B05CE6" }} />
          </div>
          <p className="text-sm font-bold" style={{ color: "#2D2235" }}>
            Story World
            <span className="text-[11px] font-normal ml-2" style={{ color: "#A897BD" }}>
              {characters.length} character{characters.length !== 1 && "s"}
              {locations.length > 0 && ` · ${locations.length} location${locations.length !== 1 ? "s" : ""}`}
            </span>
          </p>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4" style={{ color: "#A897BD" }} /> : <ChevronDown className="w-4 h-4" style={{ color: "#A897BD" }} />}
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
            <div className="p-3 space-y-2 max-h-[250px] overflow-y-auto scrollbar-hide">
              {characters.map((c) => (<CharacterCard key={c.id} character={c} />))}
              {locations.map((l) => (<LocationCard key={l.id} location={l} />))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  CHARACTER / LOCATION CARDS (compact)                                       */
/* -------------------------------------------------------------------------- */

function CharacterCard({ character }: { character: WorldCharacter }) {
  return (
    <div className="flex gap-2.5 p-2.5 rounded-xl" style={{ background: "rgba(249,245,255,0.5)", border: "1px solid rgba(180,150,210,0.08)" }}>
      {character.imageUrl ? (
        <img src={character.imageUrl} alt={character.name} className="w-10 h-10 rounded-lg object-cover flex-shrink-0" style={{ border: "1px solid rgba(180,150,210,0.15)" }} />
      ) : (
        <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "rgba(199,125,255,0.1)" }}>
          <User className="w-4 h-4" style={{ color: "#C4A8E0" }} />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="text-[13px] font-bold truncate" style={{ color: "#2D2235" }}>{character.name}</p>
          {character.role && (<span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold flex-shrink-0" style={{ background: "rgba(199,125,255,0.1)", color: "#9B59D0" }}>{character.role}</span>)}
        </div>
        {character.appearance && (<p className="text-[10px] mt-0.5 line-clamp-1 leading-relaxed" style={{ color: "#7B6E90" }}>{character.appearance}</p>)}
      </div>
    </div>
  );
}

function LocationCard({ location }: { location: WorldLocation }) {
  return (
    <div className="flex gap-2.5 p-2.5 rounded-xl" style={{ background: "rgba(249,245,255,0.5)", border: "1px solid rgba(180,150,210,0.08)" }}>
      {location.imageUrl ? (
        <img src={location.imageUrl} alt={location.name} className="w-10 h-10 rounded-lg object-cover flex-shrink-0" style={{ border: "1px solid rgba(180,150,210,0.15)" }} />
      ) : (
        <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "rgba(67,184,156,0.08)" }}>
          <MapPin className="w-4 h-4" style={{ color: "#43B89C" }} />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-bold truncate" style={{ color: "#2D2235" }}>{location.name}</p>
        {location.description && (<p className="text-[10px] mt-0.5 line-clamp-1 leading-relaxed" style={{ color: "#7B6E90" }}>{location.description}</p>)}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  SHARED SUB-COMPONENTS                                                      */
/* -------------------------------------------------------------------------- */

function AvatarAssistant() {
  return (
    <div className="w-7 h-7 flex-shrink-0 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, #B05CE6, #D45DA0)", boxShadow: "0 2px 8px rgba(176,92,230,0.2)" }}>
      <Sparkles className="w-3.5 h-3.5 text-white" />
    </div>
  );
}

function AvatarUser() {
  return (
    <div className="w-7 h-7 flex-shrink-0 rounded-lg flex items-center justify-center" style={{ background: "rgba(199,125,255,0.1)" }}>
      <span className="text-[9px] font-bold" style={{ color: "#9B59D0" }}>You</span>
    </div>
  );
}

function Bubble({ side, children }: { side: "left" | "right"; children: React.ReactNode }) {
  return (
    <div className={`max-w-[80%] px-3.5 py-2.5 text-[13px] leading-relaxed ${side === "right" ? "rounded-2xl rounded-tr-md text-white" : "rounded-2xl rounded-tl-md"}`}
      style={side === "right" ? { background: "linear-gradient(135deg, #B05CE6, #D45DA0)", boxShadow: "0 2px 8px rgba(176,92,230,0.15)" } : { background: "white", color: "#2D2235", border: "1px solid rgba(180,150,210,0.12)", boxShadow: "0 1px 3px rgba(100,60,140,0.04)" }}>
      {children}
    </div>
  );
}

function InputField({ value, onChange, onSubmit, placeholder, disabled }: { value: string; onChange: (v: string) => void; onSubmit: () => void; placeholder: string; disabled: boolean }) {
  return (
    <input type="text" value={value} onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSubmit(); } }}
      className="flex-1 rounded-xl px-3.5 py-2.5 text-sm transition-all focus:outline-none"
      style={{ background: "rgba(249,245,255,0.6)", border: "1.5px solid rgba(180,150,210,0.15)", color: "#2D2235", fontFamily: "inherit" }}
      placeholder={placeholder} disabled={disabled} />
  );
}

function SendButton({ onClick, disabled, loading }: { onClick: () => void; disabled: boolean; loading: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className="w-11 h-11 flex-shrink-0 rounded-xl flex items-center justify-center text-white transition-all disabled:opacity-40 active:scale-95"
      style={{ background: "linear-gradient(135deg, #B05CE6, #D45DA0)", boxShadow: "0 2px 8px rgba(176,92,230,0.15)", border: "none", fontFamily: "inherit" }}>
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
    </button>
  );
}