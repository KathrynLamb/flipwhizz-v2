"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { motion } from "framer-motion";
import { Loader2, Send, Zap, BookOpen, Sparkles, User } from "lucide-react";
import posthog from "posthog-js";

type ChatMsg = {
  role: "user" | "assistant";
  content: string;
};

const MAX_USER_MESSAGES = 3;

// Generic openers, shown on a fresh, unseeded start. One is picked at random
// so a returning visitor doesn't see the same line every time. Warm and
// inviting rather than full-energy; the AI brings the fireworks once the
// parent has actually said something.
const GENERIC_OPENERS: string[] = [
  "Hi! I'm your co-author. Tell me who we're making a story for and what they're into, and we'll turn it into a real illustrated book that's all theirs.",
  "Hello! Let's make something your child will ask for again and again. Tell me a little about them to get us started.",
  "Hi there! Every story here is built around one special child. Tell me about yours and we'll begin shaping it together.",
  "Hey! No need to have anything planned. Just tell me what you're thinking about for your little one, and we'll build it from there.",
  "Hi! Picture the story you'd love to read your child at bedtime. Tell me a bit about them and we'll start bringing it to life.",
];

// Seed-specific openers, one per seed for now. A visitor arriving from a
// themed link (e.g. a Pinterest pin at ?seed=potty) gets a tailored greeting
// instead of a generic one, and the input is left empty for them to reply.
const SEED_OPENERS: Record<string, string> = {
  potty:
    "Hi! So we're tackling potty training. Let's make your little one the hero of their own potty adventure, the kind of story that makes the whole thing feel exciting. Tell me a bit about them and we'll begin.",
  bedtime:
    "Hi! Let's make a bedtime story so calming and magical your child actually looks forward to winding down with it. Tell me a little about them to get started.",
  newsibling:
    "Hi! A new baby on the way is such a big change for a little one. Let's make a story that helps them feel proud and ready to be a big brother or sister. Tell me about your older child.",
  dinosaurs:
    "Hi! A dinosaur-mad little one, my favourite kind of brief. Let's roar into a story built all around them. Tell me their name and a bit about them and we'll begin.",
};

function pickGenericOpener(): string {
  return GENERIC_OPENERS[Math.floor(Math.random() * GENERIC_OPENERS.length)];
}

export default function ChatClient() {
  const router = useRouter();
  const { data: session, status: authStatus } = useSession();

  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [messagesLoaded, setMessagesLoaded] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [creatingProject, setCreatingProject] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasAttemptedResume, setHasAttemptedResume] = useState(false);
  // Guard so the opener is only ever injected once per mount.
  const openerInjectedRef = useRef(false);

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const userMessageCount = useMemo(
    () => messages.filter((m) => m.role === "user").length,
    [messages],
  );

  const reachedLimit = userMessageCount >= MAX_USER_MESSAGES;
  const remaining = Math.max(0, MAX_USER_MESSAGES - userMessageCount);

  const searchParams = useSearchParams();
  const seed = searchParams.get("seed");

  // Load any saved conversation first. This must run before we decide whether
  // to inject an opener, so a returning mid-demo visitor resumes rather than
  // getting a fresh "hello" on top of their existing chat.
  useEffect(() => {
    const saved = sessionStorage.getItem("flipwhizz_create_demo_messages");
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as ChatMsg[];
        if (Array.isArray(parsed) && parsed.length > 0) setMessages(parsed);
      } catch {
        /* ignore */
      }
    }
    setMessagesLoaded(true);
  }, []);

  // Inject the fake AI opener, only on a genuinely fresh, empty start.
  // Seeded visitors get their themed opener; everyone else gets a random
  // generic one. This is a hardcoded assistant message (no API call, instant,
  // free) and does NOT count toward the user's 3 messages.
  useEffect(() => {
    if (!messagesLoaded) return;
    if (openerInjectedRef.current) return;
    if (messages.length > 0) return; // resumed conversation, no opener
    openerInjectedRef.current = true;

    const seedOpener = seed ? SEED_OPENERS[seed] : undefined;
    const opener = seedOpener ?? pickGenericOpener();

    setMessages([{ role: "assistant", content: opener }]);

    posthog.capture("demo_opener_shown", {
      seeded: Boolean(seedOpener),
      seed: seedOpener ? seed : null,
    });

    // Focus the box so the cursor is already there. The proven failure mode
    // was visitors never moving to the input at all.
    requestAnimationFrame(() => textareaRef.current?.focus());
  }, [messagesLoaded, seed, messages.length]);

  // Resume effect, gate on messagesLoaded
  useEffect(() => {
    if (!messagesLoaded) return;
    if (hasAttemptedResume) return;
    if (authStatus !== "authenticated") return;
    if (!reachedLimit) return;
    if (messages.length === 0) return;

    const pendingResume = sessionStorage.getItem("flipwhizz_demo_pending_resume");
    if (!pendingResume) return;

    setHasAttemptedResume(true);
    sessionStorage.removeItem("flipwhizz_demo_pending_resume");
    void continueToFullProject();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authStatus, reachedLimit, messages, hasAttemptedResume, messagesLoaded]);

  useEffect(() => {
    if (!messagesLoaded) return;
    sessionStorage.setItem(
      "flipwhizz_create_demo_messages",
      JSON.stringify(messages),
    );
    const id = window.setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 80);
    return () => window.clearTimeout(id);
  }, [messages, messagesLoaded]);

  useEffect(() => {
    if (!textareaRef.current) return;
    textareaRef.current.style.height = "auto";
    textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
  }, [input]);

  // Track when the paywall CTA appears
  useEffect(() => {
    if (reachedLimit) {
      posthog.capture("demo_limit_reached", {
        is_authenticated: authStatus === "authenticated",
        message_count: userMessageCount,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reachedLimit]);

  async function sendMessage() {
    if (!input.trim() || loading || reachedLimit) return;

    const text = input.trim();
    const userMessage: ChatMsg = { role: "user", content: text };
    const nextHistory = [...messages, userMessage];

    // Track first message as demo_started
    if (messages.filter((m) => m.role === "user").length === 0) {
      posthog.capture("demo_started", {
        is_authenticated: authStatus === "authenticated",
        message_preview: text.slice(0, 80),
      });
    }

    setMessages(nextHistory);
    setInput("");
    setLoading(true);
    setError(null);

    if (textareaRef.current) textareaRef.current.style.height = "auto";

    try {
      const res = await fetch("/api/chat/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history: nextHistory }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(
          data?.error || "The demo chat could not respond just now.",
        );
      }

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            data?.reply ??
            "That sounds wonderful! Tell me a little more so I can start shaping the story.",
        },
      ]);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Something went wrong while sending your message.";

      posthog.capture("demo_error", {
        error: message,
        message_count: userMessageCount,
      });
      setError(message);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "I hit a little bump there. Please try again, or continue when you're ready.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function continueToFullProject() {
    if (creatingProject || userMessageCount === 0) return;

    posthog.capture("demo_continue_clicked", {
      is_authenticated: authStatus === "authenticated",
      message_count: userMessageCount,
      is_resume: hasAttemptedResume,
    });

    setCreatingProject(true);
    setError(null);

    try {
      const res = await fetch("/api/projects/create-from-demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages }),
      });

      const data = await res.json().catch(() => null);

      if (res.status === 401) {
        posthog.capture("demo_auth_wall_hit");
        sessionStorage.setItem(
          "flipwhizz_create_demo_messages",
          JSON.stringify(messages),
        );
        sessionStorage.setItem("flipwhizz_demo_pending_resume", "true");
        router.push("/auth/signin?callbackUrl=/projects/create");
        return;
      }

      if (!res.ok || !data?.projectId) {
        throw new Error(
          data?.error || "We could not create your project just now.",
        );
      }

      posthog.capture("demo_project_created", {
        project_id: data.projectId,
        is_resume: hasAttemptedResume,
      });

      sessionStorage.removeItem("flipwhizz_create_demo_messages");
      sessionStorage.removeItem("flipwhizz_demo_pending_resume");
      router.push(`/chat?project=${data.projectId}`);
    } catch (err) {
      setCreatingProject(false);
      const message =
        err instanceof Error
          ? err.message
          : "We could not continue into the full project.";
      posthog.capture("demo_project_creation_failed", { error: message });
      setError(message);
    }
  }

  function resetDemo() {
    if (loading || creatingProject) return;
    posthog.capture("demo_reset", { message_count: userMessageCount });
    // Re-inject a fresh opener on reset rather than leaving the box truly empty.
    openerInjectedRef.current = true;
    const opener = seed ? SEED_OPENERS[seed] ?? pickGenericOpener() : pickGenericOpener();
    setMessages([{ role: "assistant", content: opener }]);
    setInput("");
    setError(null);
    sessionStorage.removeItem("flipwhizz_create_demo_messages");
    sessionStorage.removeItem("flipwhizz_demo_pending_resume");
    requestAnimationFrame(() => textareaRef.current?.focus());
  }

  return (
    <div className="flex h-full flex-col">
      {/* Messages, full width, no card, no border, sits directly on the page */}
      <div className="flex-1 overflow-y-auto px-6 pb-32 pt-6">
        <div className="mx-auto w-full max-w-xl space-y-3">
          {messages.map((msg, i) => (
            <motion.div
              key={`${msg.role}-${i}-${msg.content.slice(0, 24)}`}
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className={`flex ${
                msg.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              {msg.role === "user" ? (
                <div className="flex max-w-[85%] items-end gap-2">
                  <div className="rounded-[20px] rounded-tr-[4px] bg-[#DB79AC] px-5 py-3 text-white shadow-sm">
                    <p className="whitespace-pre-wrap break-words text-[16px] font-normal leading-[1.4]">
                      {msg.content}
                    </p>
                  </div>
                  <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-[#DB79AC]/15">
                    <User className="h-3.5 w-3.5 text-[#DB79AC]" />
                  </div>
                </div>
              ) : (
                <div className="flex max-w-[85%] items-end gap-2">
                  <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-[#9B88CF]/15">
                    <Sparkles className="h-3.5 w-3.5 text-[#9B88CF]" />
                  </div>
                  <div className="rounded-[20px] rounded-bl-[4px] bg-[#9B88CF] px-5 py-3 shadow-sm">
                    <p className="whitespace-pre-wrap break-words text-[16px] font-normal leading-[1.4] text-white">
                      {msg.content}
                    </p>
                  </div>
                </div>
              )}
            </motion.div>
          ))}

          {loading && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-end gap-2"
            >
              <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-[#9B88CF]/15">
                <Sparkles className="h-3.5 w-3.5 text-[#9B88CF]" />
              </div>
              <div className="flex gap-1.5 rounded-[20px] rounded-bl-[4px] bg-[#9B88CF] px-5 py-3 shadow-sm">
                <BouncingDot delay={0} />
                <BouncingDot delay={0.1} />
                <BouncingDot delay={0.2} />
              </div>
            </motion.div>
          )}

          {creatingProject && hasAttemptedResume && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-end gap-2"
            >
              <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-[#9B88CF]/15">
                <Sparkles className="h-3.5 w-3.5 text-[#9B88CF]" />
              </div>
              <div className="rounded-[20px] rounded-bl-[4px] bg-[#9B88CF] px-5 py-3 shadow-sm">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-white" />
                  <p className="text-[16px] font-semibold leading-[1.4] text-white">
                    Welcome back, creating your book…
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {reachedLimit && !(creatingProject && hasAttemptedResume) && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#9B88CF] text-white shadow-sm">
                  <BookOpen className="h-5 w-5" />
                </div>

                <div className="min-w-0 flex-1">
                  <h4 className="text-lg font-black tracking-tight text-slate-900">
                    Your story is taking shape
                  </h4>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    Sign in to continue, with illustrated pages, a custom
                    cover, and print options.
                  </p>

                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={continueToFullProject}
                      disabled={creatingProject}
                      className="inline-flex items-center justify-center gap-2 rounded-full bg-[#DB79AC] px-5 py-3 text-sm font-bold text-white shadow-[0_8px_28px_rgba(219,121,172,0.3)] transition-transform active:scale-[0.98] disabled:opacity-60"
                    >
                      {creatingProject ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Creating your book…
                        </>
                      ) : (
                        <>
                          <BookOpen className="h-4 w-4" />
                          Continue and create my book
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={resetDemo}
                      disabled={creatingProject}
                      className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                    >
                      Start again
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input, fixed to the bottom of the screen now that there's no card
          or footer below it to collide with. A thin gradient edge ties it
          back to the header title; the bar itself stays white so the
          textarea and send button stay legible. */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 px-6 py-3 backdrop-blur-xl">
        <div
          className="absolute left-0 right-0 top-0 h-[3px]"
          style={{
            background:
              "linear-gradient(90deg, #F2546A, #F7A93E, #8AC7E0, #A270C9)",
          }}
        />
        <div className="mx-auto w-full max-w-xl">
          {userMessageCount > 0 && !reachedLimit && (
            <div className="mb-2 px-1">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#DB79AC]">
                <Zap className="h-3.5 w-3.5" />
                <span>
                  {remaining} more message{remaining !== 1 ? "s" : ""} to
                  shape your story
                </span>
              </div>
            </div>
          )}

          {userMessageCount === 0 && !reachedLimit && (
            <div className="mb-2 px-1 text-center">
              <p className="text-xs text-slate-500">
                Chat to shape the story, then make it a real illustrated
                book. No sign-up to start.
              </p>
            </div>
          )}

          <div className="flex items-end gap-2">
            <div className="flex min-h-[44px] flex-1 items-center rounded-[20px] border border-slate-200 bg-white px-4 py-2 shadow-sm transition focus-within:border-[#9B88CF]/50 focus-within:ring-2 focus-within:ring-[#9B88CF]/20">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (
                    e.key === "Enter" &&
                    !e.shiftKey &&
                    !loading &&
                    !reachedLimit
                  ) {
                    e.preventDefault();
                    void sendMessage();
                  }
                }}
                placeholder={
                  reachedLimit
                    ? "Demo complete. Continue to create your book"
                    : "Type your reply… a name, an age, what they love, anything"
                }
                disabled={loading || reachedLimit || creatingProject}
                rows={1}
                className="max-h-[100px] w-full resize-none border-0 bg-transparent text-[16px] font-normal text-gray-900 outline-none placeholder:text-gray-500 focus:ring-0 disabled:cursor-not-allowed disabled:opacity-60"
                style={{ lineHeight: "1.4" }}
              />
            </div>

            <button
              type="button"
              onClick={() => void sendMessage()}
              disabled={
                !input.trim() || loading || reachedLimit || creatingProject
              }
              className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full transition-all duration-200 active:scale-90 disabled:cursor-not-allowed"
              style={{
                background:
                  input.trim() && !reachedLimit && !creatingProject
                    ? "#DB79AC"
                    : "#E5E7EB",
                color:
                  input.trim() && !reachedLimit && !creatingProject
                    ? "white"
                    : "#9CA3AF",
                boxShadow:
                  input.trim() && !reachedLimit && !creatingProject
                    ? "0 3px 12px rgba(219,121,172,0.35)"
                    : "none",
              }}
              aria-label="Send message"
            >
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send
                  className="h-5 w-5"
                  style={{ transform: "translateX(1px)" }}
                />
              )}
            </button>
          </div>

          {error && (
            <p className="mt-3 text-sm font-medium text-rose-600">{error}</p>
          )}
        </div>
        <div className="h-[env(safe-area-inset-bottom)]" />
      </div>
    </div>
  );
}

function BouncingDot({ delay }: { delay: number }) {
  return (
    <motion.div
      animate={{ y: [0, -4, 0] }}
      transition={{ repeat: Infinity, duration: 0.6, delay }}
      className="h-2 w-2 rounded-full bg-white/80"
    />
  );
}