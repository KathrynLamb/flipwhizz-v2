"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, Send, Sparkles, Zap, BookOpen } from "lucide-react";
import posthog from "posthog-js";

type ChatMsg = {
  role: "user" | "assistant";
  content: string;
};

const MAX_USER_MESSAGES = 3;

const SUGGESTIONS = [
  {
    label: "Loves dinosaurs",
    value:
      "My 4-year-old is obsessed with dinosaurs and just started reception",
    emoji: "🦕",
  },
  {
    label: "Scared of the dark",
    value:
      "My daughter is 5 and scared of the dark — I want a story that helps",
    emoji: "🌙",
  },
  {
    label: "Football mad",
    value:
      "My son is 7 and lives for football — he'd love a story where he scores the winning goal",
    emoji: "⚽",
  },
  {
    label: "New sibling",
    value:
      "We're expecting a baby and I want a story to help my 3-year-old feel excited about being a big sister",
    emoji: "👶",
  },
];

export default function CreateDemoClient() {
  const router = useRouter();
  const { data: session, status: authStatus } = useSession();

  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [creatingProject, setCreatingProject] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasAttemptedResume, setHasAttemptedResume] = useState(false);

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const userMessageCount = useMemo(
    () => messages.filter((m) => m.role === "user").length,
    [messages],
  );

  const reachedLimit = userMessageCount >= MAX_USER_MESSAGES;
  const remaining = Math.max(0, MAX_USER_MESSAGES - userMessageCount);

  // ── Load saved messages from sessionStorage ──
  useEffect(() => {
    const saved = sessionStorage.getItem("flipwhizz_create_demo_messages");
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved) as ChatMsg[];
      if (Array.isArray(parsed) && parsed.length > 0) setMessages(parsed);
    } catch {
      /* ignore */
    }
  }, []);

  // ── Auto-resume: if we have saved messages at the limit AND user just signed in, retry project creation ──
  useEffect(() => {
    if (hasAttemptedResume) return;
    if (authStatus !== "authenticated") return;
    if (!reachedLimit) return;
    if (messages.length === 0) return;

    const pendingResume = sessionStorage.getItem("flipwhizz_demo_pending_resume");
    if (!pendingResume) return;

    setHasAttemptedResume(true);
    sessionStorage.removeItem("flipwhizz_demo_pending_resume");
    void continueToFullProject();
  }, [authStatus, reachedLimit, messages, hasAttemptedResume]);

  useEffect(() => {
    sessionStorage.setItem(
      "flipwhizz_create_demo_messages",
      JSON.stringify(messages),
    );
    const id = window.setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 80);
    return () => window.clearTimeout(id);
  }, [messages]);

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
  }, [reachedLimit]);

  function fillSuggestion(value: string) {
    if (loading || reachedLimit) return;
    posthog.capture("demo_suggestion_clicked", {
      suggestion: SUGGESTIONS.find((s) => s.value === value)?.label ?? value.slice(0, 40),
    });
    setInput(value);
    requestAnimationFrame(() => textareaRef.current?.focus());
  }

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
            "That sounds wonderful — tell me a little more so I can start shaping the story.",
        },
      ]);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Something went wrong while sending your message.";

      posthog.capture("demo_error", { error: message, message_count: userMessageCount });
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
    if (creatingProject || messages.length === 0) return;

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
        router.push("/auth/signin?callbackUrl=/create");
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
      const message = err instanceof Error
        ? err.message
        : "We could not continue into the full project.";
      posthog.capture("demo_project_creation_failed", { error: message });
      setError(message);
    }
  }

  function resetDemo() {
    if (loading || creatingProject) return;
    posthog.capture("demo_reset", { message_count: userMessageCount });
    setMessages([]);
    setInput("");
    setError(null);
    sessionStorage.removeItem("flipwhizz_create_demo_messages");
    sessionStorage.removeItem("flipwhizz_demo_pending_resume");
  }

  return (
    <div className="space-y-4">
      <div className="rounded-[28px] border border-slate-200 bg-[#F8FAFC]">
        <div className="max-h-[480px] min-h-[360px] overflow-y-auto px-4 py-5 sm:px-5">
          <AnimatePresence mode="popLayout">
            {messages.length === 0 && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.98 }}
                className="flex min-h-[330px] flex-col items-center justify-center text-center"
              >
                <div className="flex h-16 w-16 items-center justify-center rounded-[22px] bg-gradient-to-br from-purple-500 to-pink-500 shadow-lg">
                  <Sparkles className="h-8 w-8 text-white" />
                </div>

                <h3 className="mt-5 text-2xl font-black tracking-tight text-slate-900">
                  Tell me about your child
                </h3>

                <p className="mt-2 max-w-sm text-[15px] leading-7 text-slate-600">
                  What are they into? What kind of story would light them up?
                </p>

                <div className="mt-5 flex flex-wrap justify-center gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s.label}
                      type="button"
                      onClick={() => fillSuggestion(s.value)}
                      className="rounded-full border-2 border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-transform active:scale-95"
                    >
                      {s.emoji} {s.label}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="space-y-3">
            {messages.map((msg, i) => (
              <motion.div
                key={`${msg.role}-${i}-${msg.content.slice(0, 24)}`}
                initial={{ opacity: 0, y: 8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                className={`flex ${
                  msg.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                {msg.role === "user" ? (
                  <div className="max-w-[85%]">
                    <div className="rounded-[20px] rounded-tr-[6px] bg-purple-500 px-5 py-3 text-white shadow-sm">
                      <p className="whitespace-pre-wrap break-words text-[16px] leading-[1.45]">
                        {msg.content}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="max-w-[88%]">
                    <div className="flex items-end gap-2">
                      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-400 to-pink-500 shadow-sm">
                        <Sparkles className="h-4 w-4 text-white" />
                      </div>
                      <div className="rounded-[20px] rounded-bl-[6px] border border-slate-100 bg-white px-5 py-3 shadow-sm">
                        <p className="whitespace-pre-wrap break-words text-[16px] leading-[1.45] text-slate-900">
                          {msg.content}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            ))}

            {loading && (
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-end gap-2"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-purple-400 to-pink-500 shadow-sm">
                  <Sparkles className="h-4 w-4 text-white" />
                </div>
                <div className="flex gap-1.5 rounded-[20px] rounded-bl-[6px] border border-slate-100 bg-white px-5 py-3 shadow-sm">
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
                className="rounded-[24px] border border-fuchsia-200 bg-gradient-to-br from-fuchsia-50 to-pink-50 p-4 shadow-sm sm:p-5"
              >
                <div className="flex items-center gap-3">
                  <Loader2 className="h-5 w-5 animate-spin text-[#D94590]" />
                  <div>
                    <h4 className="text-lg font-black tracking-tight text-slate-900">
                      Welcome back — creating your book…
                    </h4>
                    <p className="mt-1 text-sm leading-6 text-slate-600">
                      Picking up where you left off.
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            {reachedLimit && !(creatingProject && hasAttemptedResume) && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-[24px] border border-fuchsia-200 bg-gradient-to-br from-fuchsia-50 to-pink-50 p-4 shadow-sm sm:p-5"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-fuchsia-500 to-pink-500 text-white shadow-sm">
                    <BookOpen className="h-5 w-5" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <h4 className="text-lg font-black tracking-tight text-slate-900">
                      Your story is taking shape
                    </h4>
                    <p className="mt-1 text-sm leading-6 text-slate-600">
                      Sign in to continue — with illustrated pages, a custom
                      cover, and print options.
                    </p>

                    <div className="mt-4 flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={continueToFullProject}
                        disabled={creatingProject}
                        className="inline-flex items-center justify-center gap-2 rounded-full bg-[#D94590] px-5 py-3 text-sm font-bold text-white shadow-[0_8px_28px_rgba(217,69,144,0.25)] transition-transform active:scale-[0.98] disabled:opacity-60"
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

        <div className="border-t border-slate-200 bg-white/90 px-4 py-3 sm:px-5">
          {messages.length > 0 && !reachedLimit && (
            <div className="mb-2 px-1">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#D94590]">
                <Zap className="h-3.5 w-3.5" />
                <span>
                  {remaining} more message{remaining !== 1 ? "s" : ""} to shape
                  your story
                </span>
              </div>
            </div>
          )}

          <div className="flex items-end gap-2">
            <div className="flex min-h-[44px] flex-1 items-center rounded-[20px] bg-slate-100 px-4 py-2">
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
                    ? "Demo complete — continue to create your book"
                    : "Tell me about your child or the story you'd like…"
                }
                disabled={loading || reachedLimit || creatingProject}
                rows={1}
                className="max-h-[100px] w-full resize-none border-0 bg-transparent text-[16px] font-normal text-slate-900 outline-none placeholder:text-slate-500 disabled:cursor-not-allowed disabled:opacity-60"
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
                    ? "#D94590"
                    : "#E5E7EB",
                color:
                  input.trim() && !reachedLimit && !creatingProject
                    ? "white"
                    : "#9CA3AF",
                boxShadow:
                  input.trim() && !reachedLimit && !creatingProject
                    ? "0 3px 12px rgba(217,69,144,0.3)"
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
      </div>
    </div>
  );
}

function BouncingDot({ delay }: { delay: number }) {
  return (
    <motion.div
      animate={{ y: [0, -4, 0] }}
      transition={{ repeat: Infinity, duration: 0.6, delay }}
      className="h-2 w-2 rounded-full bg-slate-400"
    />
  );
}