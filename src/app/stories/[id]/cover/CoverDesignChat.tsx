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
  Palette,
  MessageCircle,
  User,
  MapPin,
  Shirt,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import type { StepKey } from "@/lib/storySteps";
import UnifiedStoryHeader from "@/app/stories/components/StoryHeader";

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
};

/* -------------------------------------------------------------------------- */
/*                              FONT LOADER                                   */
/* -------------------------------------------------------------------------- */

function FontLoader() {
  return (
    // eslint-disable-next-line @next/next/no-page-custom-font
    <link
      href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,300;12..96,400;12..96,600;12..96,700;12..96,800&family=Lora:ital,wght@0,400;0,500;0,600;1,400;1,500&display=swap"
      rel="stylesheet"
    />
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
}: Props) {
  const router = useRouter();

  /* ----------------------------- LOCAL STATE ----------------------------- */

  const [localStory, setLocalStory] = useState<Story>(story);
  const [messages, setMessages] = useState<ChatMsg[]>(initialMessages);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isFinalising, setIsFinalising] = useState(false);

  // World data
  const [worldCharacters, setWorldCharacters] = useState<WorldCharacter[]>([]);
  const [worldLocations, setWorldLocations] = useState<WorldLocation[]>([]);
  const [worldLoading, setWorldLoading] = useState(true);

  const [mentionedCharacterIds, setMentionedCharacterIds] = useState<Set<string>>(new Set());
  const [mentionedLocationIds, setMentionedLocationIds] = useState<Set<string>>(new Set());

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const hasStartedChatRef = useRef(false);

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
      const res = await fetch(`/api/stories/${storyId}`);
      const data = await res.json();

      if (data.story?.coverSpreadUrl) {
        clearInterval(interval);
        setLocalStory(data.story);

        const autoMessage: ChatMsg = {
          role: "assistant",
          content:
            "Your cover is ready! Take a look at the preview — what do you think? Feel free to ask for any changes.",
        };

        setMessages((prev) => [...prev, autoMessage]);

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
        
        if (data.mentionedCharacterIds?.length) {
          setMentionedCharacterIds(new Set(data.mentionedCharacterIds));
        }
        if (data.mentionedLocationIds?.length) {
          setMentionedLocationIds(new Set(data.mentionedLocationIds));
        }
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
          world: {
            characters: worldCharacters.map((c) => ({ id: c.id, name: c.name, role: c.role })),
            locations: worldLocations.map((l) => ({ id: l.id, name: l.name })),
          },
        }),
      });
      
      const data = await res.json();
      setMessages([...nextMessages, { role: "assistant", content: data.reply }]);
      
      // Accumulate mentioned IDs
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
      setMessages([
        ...nextMessages,
        { role: "assistant", content: "Sorry — something went wrong." },
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
          characters: worldCharacters,
          locations: worldLocations,
        }),
      });

      if (!res.ok) throw new Error();

      const updated = await fetch(`/api/stories/${storyId}`).then((r) =>
        r.json()
      );
      setLocalStory(updated.story);

      const lockMessage: ChatMsg = {
        role: "assistant",
        content:
          "Perfect — your cover design is locked. Generating artwork now, this may take 30–60 seconds…",
      };

      setMessages((m) => [...m, lockMessage]);

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
      setLocalStory((s) => ({ ...s, status: "generating_covers" }));

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
        }),
      });

      const regenMsg: ChatMsg = {
        role: "assistant",
        content:
          "Got it! Regenerating your cover with those changes — about 30–60 seconds…",
      };

      setMessages((prev) => [...prev, regenMsg]);

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
    <>
      <FontLoader />

      <div
        className="min-h-screen relative"
        style={{ fontFamily: "'Bricolage Grotesque', system-ui, sans-serif" }}
      >
        {/* ── Background ──────────────────────────────────────────────────── */}
        <div
          className="fixed inset-0 -z-10"
          style={{
            background: `
              radial-gradient(ellipse 80% 60% at 20% 10%, rgba(232,190,255,0.3) 0%, transparent 60%),
              radial-gradient(ellipse 70% 50% at 85% 80%, rgba(255,182,210,0.25) 0%, transparent 55%),
              radial-gradient(ellipse 50% 40% at 50% 50%, rgba(200,210,255,0.15) 0%, transparent 50%),
              #F9F5FF
            `,
          }}
        >
          <div
            className="absolute inset-0 opacity-50"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23c4b5d4' fill-opacity='0.04'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            }}
          />
        </div>

        <style jsx global>{`
          .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
          .scrollbar-hide::-webkit-scrollbar { display: none; }
        `}</style>

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <UnifiedStoryHeader
          storyId={storyId}
          title={story.title || "Cover Design"}
          currentStep={currentStep}
          completedSteps={completedSteps}
          paymentStatus={paymentStatus}
          coverSpreadUrl={localStory.coverSpreadUrl}
        />

        {/* ── Body ────────────────────────────────────────────────────────── */}
        <main className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          {/* Intro */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-8"
          >
            <div
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold mb-3"
              style={{ background: "rgba(199,125,255,0.1)", color: "#9B59D0" }}
            >
              <Palette className="w-3.5 h-3.5" />
              Cover Designer
            </div>
            <h2
              className="text-2xl sm:text-3xl font-extrabold mb-2"
              style={{ color: "#2D2235", letterSpacing: "-0.03em" }}
            >
              Design Your Cover
            </h2>
            <p
              className="text-sm sm:text-base max-w-lg mx-auto leading-relaxed"
              style={{ color: "#7B6E90" }}
            >
              Chat about your vision — colours, mood, layout — and I'll bring
              it to life.
            </p>
          </motion.div>

          {/* ── Main grid ─────────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
            {/* ── CHAT (3/5) ─────────────────────────────────────────────── */}
            <div className="lg:col-span-3">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="overflow-hidden rounded-[22px]"
                style={{
                  background: "white",
                  border: "1px solid rgba(180,150,210,0.12)",
                  boxShadow: "0 2px 12px rgba(100,60,140,0.06)",
                }}
              >
                {/* Chat bar */}
                <div
                  className="flex items-center gap-3 px-5 py-3.5"
                  style={{
                    borderBottom: "1px solid rgba(180,150,210,0.08)",
                    background: "rgba(249,245,255,0.5)",
                  }}
                >
                  <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center"
                    style={{ background: "rgba(199,125,255,0.1)" }}
                  >
                    <MessageCircle className="w-4 h-4" style={{ color: "#B05CE6" }} />
                  </div>
                  <div>
                    <p className="text-sm font-bold" style={{ color: "#2D2235" }}>
                      Design Conversation
                    </p>
                    <p className="text-[11px]" style={{ color: "#A897BD" }}>
                      Describe your perfect cover
                    </p>
                  </div>
                </div>

                {/* Messages */}
                <div
                  className="h-[480px] sm:h-[520px] overflow-y-auto p-5 space-y-4 scrollbar-hide"
                  style={{ background: "rgba(249,245,255,0.25)" }}
                >
                  {messages.length === 0 && isLoading && (
                    <div className="flex items-start gap-3">
                      <AvatarAssistant />
                      <Bubble side="left">
                        <Loader2 className="w-4 h-4 animate-spin" style={{ color: "#B05CE6" }} />
                      </Bubble>
                    </div>
                  )}

                  {messages.length === 0 && !isLoading && (
                    <div className="flex flex-col items-center justify-center h-full text-center">
                      <div
                        className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5"
                        style={{ background: "rgba(199,125,255,0.1)" }}
                      >
                        <Sparkles className="w-8 h-8" style={{ color: "#C77DFF" }} />
                      </div>
                      <h3 className="text-xl font-extrabold mb-2" style={{ color: "#2D2235" }}>
                        Let's Design Your Cover
                      </h3>
                      <p className="text-sm max-w-sm leading-relaxed" style={{ color: "#7B6E90" }}>
                        Tell me about your vision and I'll create a cover that brings your story to life.
                      </p>
                    </div>
                  )}

                  {messages.map((m, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25 }}
                      className={`flex items-start gap-3 ${m.role === "user" ? "flex-row-reverse" : ""}`}
                    >
                      {m.role === "assistant" ? <AvatarAssistant /> : <AvatarUser />}
                      <Bubble side={m.role === "user" ? "right" : "left"}>
                        <p className="whitespace-pre-wrap">{m.content}</p>
                      </Bubble>
                    </motion.div>
                  ))}

                  {isLoading && messages.length > 0 && (
                    <div className="flex items-start gap-3">
                      <AvatarAssistant />
                      <Bubble side="left">
                        <div className="flex items-center gap-1.5">
                          {[0, 150, 300].map((delay) => (
                            <span
                              key={delay}
                              className="w-2 h-2 rounded-full animate-bounce"
                              style={{ background: "#C4A8E0", animationDelay: `${delay}ms` }}
                            />
                          ))}
                        </div>
                      </Bubble>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div className="p-4" style={{ borderTop: "1px solid rgba(180,150,210,0.08)" }}>
                  {!hasCovers ? (
                    <div className="space-y-3">
                      <div className="flex gap-2.5">
                        <InputField
                          value={input}
                          onChange={setInput}
                          onSubmit={sendMessage}
                          placeholder="Describe your cover vision…"
                          disabled={isLoading || isFinalising || isGeneratingCovers}
                        />
                        <SendButton
                          onClick={sendMessage}
                          disabled={!input.trim() || isLoading || isFinalising || isGeneratingCovers}
                          loading={false}
                        />
                      </div>

                      <button
                        onClick={finalizeCoverPlan}
                        disabled={isFinalising || messages.length < 2 || isGeneratingCovers}
                        className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-40 active:scale-[0.98]"
                        style={{
                          background: "linear-gradient(135deg, #B05CE6, #D45DA0)",
                          boxShadow: "0 4px 16px rgba(176,92,230,0.25)",
                          border: "none",
                          fontFamily: "inherit",
                        }}
                      >
                        {isFinalising || isGeneratingCovers ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            {isGeneratingCovers ? "Generating…" : "Creating Design…"}
                          </>
                        ) : (
                          <>
                            <Wand2 className="w-4 h-4" />
                            Finalise &amp; Generate Cover
                          </>
                        )}
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2.5">
                      <InputField
                        value={input}
                        onChange={setInput}
                        onSubmit={() => {
                          if (input.trim()) {
                            handleRegenerateWithFeedback(input);
                            setInput("");
                          }
                        }}
                        placeholder="Request changes to the cover…"
                        disabled={isLoading || isGeneratingCovers}
                      />
                      <SendButton
                        onClick={() => {
                          if (input.trim()) {
                            handleRegenerateWithFeedback(input);
                            setInput("");
                          }
                        }}
                        disabled={!input.trim() || isLoading || isGeneratingCovers}
                        loading={isGeneratingCovers}
                      />
                    </div>
                  )}
                </div>
              </motion.div>
            </div>

            {/* ── PREVIEW (2/5) ──────────────────────────────────────────── */}
            <div className="lg:col-span-2">
              <div className="sticky top-24 space-y-4">
                {/* Cover preview card */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="overflow-hidden rounded-[22px]"
                  style={{
                    background: "white",
                    border: "1px solid rgba(180,150,210,0.12)",
                    boxShadow: "0 2px 12px rgba(100,60,140,0.06)",
                  }}
                >
                  <div
                    className="flex items-center gap-3 px-5 py-3.5"
                    style={{
                      borderBottom: "1px solid rgba(180,150,210,0.08)",
                      background: "rgba(249,245,255,0.5)",
                    }}
                  >
                    <div
                      className="w-8 h-8 rounded-xl flex items-center justify-center"
                      style={{ background: "rgba(199,125,255,0.1)" }}
                    >
                      <Sparkles className="w-4 h-4" style={{ color: "#B05CE6" }} />
                    </div>
                    <p className="text-sm font-bold" style={{ color: "#2D2235" }}>
                      Cover Preview
                    </p>
                  </div>

                  <div className="p-5">
                    {hasCovers && !isGeneratingCovers ? (
                      <div className="space-y-4">
                        <div
                          className="relative overflow-hidden rounded-2xl"
                          style={{
                            boxShadow:
                              "0 8px 30px rgba(100,60,140,0.12), 0 2px 8px rgba(100,60,140,0.06)",
                            border: "1px solid rgba(180,150,210,0.1)",
                          }}
                        >
                          <img
                            src={localStory.coverSpreadUrl!}
                            alt="Cover preview"
                            className="w-full"
                          />
                        </div>

                        <button
                          onClick={handleApprove}
                          className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-xl text-sm font-bold text-white transition-all active:scale-[0.98]"
                          style={{
                            background: "linear-gradient(135deg, #43B89C, #2FA482)",
                            boxShadow: "0 4px 16px rgba(67,184,156,0.25)",
                            border: "none",
                            fontFamily: "inherit",
                          }}
                        >
                          <Check className="w-4 h-4" />
                          Approve &amp; Continue
                        </button>

                        <p
                          className="text-center text-xs"
                          style={{ color: "#A897BD" }}
                        >
                          or request changes in the chat
                        </p>
                      </div>
                    ) : isGeneratingCovers ? (
                      <div
                        className="flex flex-col items-center justify-center h-64 rounded-2xl"
                        style={{
                          background:
                            "linear-gradient(135deg, rgba(249,245,255,0.8), rgba(255,240,248,0.6))",
                          border: "1px solid rgba(180,150,210,0.1)",
                        }}
                      >
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{
                            repeat: Infinity,
                            duration: 3,
                            ease: "linear",
                          }}
                          className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
                          style={{
                            background: "linear-gradient(135deg, #B05CE6, #D45DA0)",
                            boxShadow: "0 4px 16px rgba(176,92,230,0.25)",
                          }}
                        >
                          <Wand2 className="w-6 h-6 text-white" />
                        </motion.div>
                        <p
                          className="text-sm font-bold"
                          style={{ color: "#2D2235" }}
                        >
                          Creating your cover…
                        </p>
                        <p className="text-xs mt-1" style={{ color: "#A897BD" }}>
                          This takes about 30–60 seconds
                        </p>
                      </div>
                    ) : (
                      <div
                        className="flex flex-col items-center justify-center h-64 rounded-2xl"
                        style={{
                          border: "2px dashed rgba(180,150,210,0.2)",
                          background: "rgba(249,245,255,0.3)",
                        }}
                      >
                        <ImagePlus
                          className="w-10 h-10 mb-3"
                          style={{ color: "#D4C6E6" }}
                        />
                        <p
                          className="text-sm font-medium"
                          style={{ color: "#A897BD" }}
                        >
                          Your cover will appear here
                        </p>
                        <p
                          className="text-xs mt-1"
                          style={{ color: "#C4B5D4" }}
                        >
                          once you finalise the design
                        </p>
                      </div>
                    )}
                  </div>
                </motion.div>

                {/* ── World Reference Panel ────────────────────────────────── */}
                <WorldReferencePanel
                  characters={worldCharacters.filter((c) => mentionedCharacterIds.has(c.id))}
                  locations={worldLocations.filter((l) => mentionedLocationIds.has(l.id))}
                  loading={worldLoading}
                />
              </div>
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

function WorldReferencePanel({
  characters,
  locations,
  loading,
}: {
  characters: WorldCharacter[];
  locations: WorldLocation[];
  loading: boolean;
}) {
  const [expanded, setExpanded] = useState(true);

  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="rounded-[22px] p-5"
        style={{
          background: "white",
          border: "1px solid rgba(180,150,210,0.12)",
          boxShadow: "0 2px 12px rgba(100,60,140,0.06)",
        }}
      >
        <div className="flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" style={{ color: "#B05CE6" }} />
          <span className="text-xs" style={{ color: "#A897BD" }}>
            Loading story world…
          </span>
        </div>
      </motion.div>
    );
  }

  if (characters.length === 0 && locations.length === 0 && !loading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="rounded-[22px] p-5 text-center"
        style={{
          background: "white",
          border: "1px solid rgba(180,150,210,0.12)",
          boxShadow: "0 2px 12px rgba(100,60,140,0.06)",
        }}
      >
        <User className="w-6 h-6 mx-auto mb-2" style={{ color: "#C4A8E0" }} />
        <p className="text-xs font-medium" style={{ color: "#A897BD" }}>
          Character references will appear here as we discuss your cover
        </p>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="overflow-hidden rounded-[22px]"
      style={{
        background: "white",
        border: "1px solid rgba(180,150,210,0.12)",
        boxShadow: "0 2px 12px rgba(100,60,140,0.06)",
      }}
    >
      {/* Header — toggle */}
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center justify-between gap-3 px-5 py-3.5 text-left"
        style={{
          borderBottom: expanded ? "1px solid rgba(180,150,210,0.08)" : "none",
          background: "rgba(249,245,255,0.5)",
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: "rgba(199,125,255,0.1)" }}
          >
            <User className="w-4 h-4" style={{ color: "#B05CE6" }} />
          </div>
          <div>
            <p className="text-sm font-bold" style={{ color: "#2D2235" }}>
              Story World
            </p>
            <p className="text-[11px]" style={{ color: "#A897BD" }}>
              {characters.length} character{characters.length !== 1 && "s"}
              {locations.length > 0 &&
                ` · ${locations.length} location${locations.length !== 1 ? "s" : ""}`}
            </p>
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4" style={{ color: "#A897BD" }} />
        ) : (
          <ChevronDown className="w-4 h-4" style={{ color: "#A897BD" }} />
        )}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="p-4 space-y-3 max-h-[400px] overflow-y-auto scrollbar-hide">
              {/* Characters */}
              {characters.map((c) => (
                <CharacterCard key={c.id} character={c} />
              ))}

              {/* Locations */}
              {locations.map((l) => (
                <LocationCard key={l.id} location={l} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* -------------------------------------------------------------------------- */
/*  CHARACTER CARD                                                             */
/* -------------------------------------------------------------------------- */

function CharacterCard({ character }: { character: WorldCharacter }) {
  const defaultOutfit = character.outfits.find((o) => o.isDefault);

  return (
    <div
      className="flex gap-3 p-3 rounded-xl"
      style={{
        background: "rgba(249,245,255,0.5)",
        border: "1px solid rgba(180,150,210,0.08)",
      }}
    >
      {/* Thumbnail */}
      {character.imageUrl ? (
        <img
          src={character.imageUrl}
          alt={character.name}
          className="w-12 h-12 rounded-xl object-cover flex-shrink-0"
          style={{
            border: "1px solid rgba(180,150,210,0.15)",
          }}
        />
      ) : (
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: "rgba(199,125,255,0.1)" }}
        >
          <User className="w-5 h-5" style={{ color: "#C4A8E0" }} />
        </div>
      )}

      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p
            className="text-sm font-bold truncate"
            style={{ color: "#2D2235" }}
          >
            {character.name}
          </p>
          {character.role && (
            <span
              className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold flex-shrink-0"
              style={{
                background: "rgba(199,125,255,0.1)",
                color: "#9B59D0",
              }}
            >
              {character.role}
            </span>
          )}
        </div>

        {character.appearance && (
          <p
            className="text-[11px] mt-0.5 line-clamp-2 leading-relaxed"
            style={{ color: "#7B6E90" }}
          >
            {character.appearance}
          </p>
        )}

        {defaultOutfit && (
          <div className="flex items-center gap-1 mt-1.5">
            <Shirt className="w-3 h-3 flex-shrink-0" style={{ color: "#C4A8E0" }} />
            <p
              className="text-[10px] truncate"
              style={{ color: "#A897BD" }}
            >
              {defaultOutfit.outfitDescription}
            </p>
          </div>
        )}

        {character.outfits.length > 1 && (
          <p className="text-[10px] mt-0.5" style={{ color: "#C4B5D4" }}>
            +{character.outfits.length - 1} other outfit
            {character.outfits.length - 1 !== 1 && "s"}
          </p>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  LOCATION CARD                                                              */
/* -------------------------------------------------------------------------- */

function LocationCard({ location }: { location: WorldLocation }) {
  return (
    <div
      className="flex gap-3 p-3 rounded-xl"
      style={{
        background: "rgba(249,245,255,0.5)",
        border: "1px solid rgba(180,150,210,0.08)",
      }}
    >
      {/* Thumbnail */}
      {location.imageUrl ? (
        <img
          src={location.imageUrl}
          alt={location.name}
          className="w-12 h-12 rounded-xl object-cover flex-shrink-0"
          style={{
            border: "1px solid rgba(180,150,210,0.15)",
          }}
        />
      ) : (
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: "rgba(67,184,156,0.08)" }}
        >
          <MapPin className="w-5 h-5" style={{ color: "#43B89C" }} />
        </div>
      )}

      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p
            className="text-sm font-bold truncate"
            style={{ color: "#2D2235" }}
          >
            {location.name}
          </p>
          {location.significance && (
            <span
              className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold flex-shrink-0"
              style={{
                background: "rgba(67,184,156,0.1)",
                color: "#2FA482",
              }}
            >
              {location.significance}
            </span>
          )}
        </div>

        {location.description && (
          <p
            className="text-[11px] mt-0.5 line-clamp-2 leading-relaxed"
            style={{ color: "#7B6E90" }}
          >
            {location.description}
          </p>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  SHARED SUB-COMPONENTS                                                      */
/* -------------------------------------------------------------------------- */

function AvatarAssistant() {
  return (
    <div
      className="w-8 h-8 flex-shrink-0 rounded-xl flex items-center justify-center"
      style={{
        background: "linear-gradient(135deg, #B05CE6, #D45DA0)",
        boxShadow: "0 2px 8px rgba(176,92,230,0.2)",
      }}
    >
      <Sparkles className="w-4 h-4 text-white" />
    </div>
  );
}

function AvatarUser() {
  return (
    <div
      className="w-8 h-8 flex-shrink-0 rounded-xl flex items-center justify-center"
      style={{ background: "rgba(199,125,255,0.1)" }}
    >
      <span className="text-[10px] font-bold" style={{ color: "#9B59D0" }}>
        You
      </span>
    </div>
  );
}

function Bubble({
  side,
  children,
}: {
  side: "left" | "right";
  children: React.ReactNode;
}) {
  return (
    <div
      className={`max-w-[78%] px-4 py-3 text-sm leading-relaxed ${
        side === "right"
          ? "rounded-2xl rounded-tr-md text-white"
          : "rounded-2xl rounded-tl-md"
      }`}
      style={
        side === "right"
          ? {
              background: "linear-gradient(135deg, #B05CE6, #D45DA0)",
              boxShadow: "0 3px 12px rgba(176,92,230,0.2)",
            }
          : {
              background: "white",
              color: "#2D2235",
              border: "1px solid rgba(180,150,210,0.12)",
              boxShadow: "0 1px 4px rgba(100,60,140,0.04)",
            }
      }
    >
      {children}
    </div>
  );
}

function InputField({
  value,
  onChange,
  onSubmit,
  placeholder,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  placeholder: string;
  disabled: boolean;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          onSubmit();
        }
      }}
      className="flex-1 rounded-xl px-4 py-3 text-sm transition-all focus:outline-none"
      style={{
        background: "rgba(249,245,255,0.6)",
        border: "1.5px solid rgba(180,150,210,0.15)",
        color: "#2D2235",
        fontFamily: "inherit",
      }}
      placeholder={placeholder}
      disabled={disabled}
    />
  );
}

function SendButton({
  onClick,
  disabled,
  loading,
}: {
  onClick: () => void;
  disabled: boolean;
  loading: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-12 h-12 flex-shrink-0 rounded-xl flex items-center justify-center text-white transition-all disabled:opacity-40 active:scale-95"
      style={{
        background: "linear-gradient(135deg, #B05CE6, #D45DA0)",
        boxShadow: "0 3px 12px rgba(176,92,230,0.2)",
        border: "none",
        fontFamily: "inherit",
      }}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <Send className="w-4 h-4" />
      )}
    </button>
  );
}