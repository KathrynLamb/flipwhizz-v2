// /src/app/chat/ChatClient.tsx

"use client";
import { isDemoNotice } from "@/lib/demo-notices";
import BookTypeSelector from "@/components/books/BookTypeSelector";
import { useBookTypeDraft } from "@/lib/books/useBookTypeDraft";
import { isBookType, type BookType } from "@/lib/books/bookType";

import { useMemo, useRef, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Loader2, BookOpen } from "lucide-react";
import { ChatBubble, TypingBubble, StatusBubble, RepliesLeft, ChatComposer, ContinueCard } from "@/components/chat/ChatBits";
import posthog from "posthog-js";
import { reportClientError } from "@/lib/reportClientError";
import { getDemoSessionId, clearDemoSessionId } from "@/lib/demo-session-utils";

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

  const searchParams = useSearchParams();
  const seed = searchParams.get("seed");

  // THE KEY CHANGE. When ?project=<uuid> is present we are no longer in the
  // 3-message public demo, we are in the real project chat. That switches
  // three things: history comes from the database instead of sessionStorage,
  // no opener is injected, and there is no message limit.
  const projectId = searchParams.get("project");
  const isProjectMode = Boolean(projectId);
  const { bookType, selectBookType } = useBookTypeDraft(searchParams.get("bookType"), isProjectMode);

  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [messagesLoaded, setMessagesLoaded] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [savingBookType, setSavingBookType] = useState(false);
  const [creatingProject, setCreatingProject] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasAttemptedResume, setHasAttemptedResume] = useState(false);
  // Guard so the opener is only ever injected once per mount.
  const openerInjectedRef = useRef(false);

  // Project mode: story creation. /api/chat returns readyToGenerate when the
  // AI calls its start_writing tool. Something has to act on that and call
  // /api/stories/create-from-chat, otherwise the user is told "I'm on it"
  // and then nothing ever happens.
  const [storyCreating, setStoryCreating] = useState(false);
  const [storyError, setStoryError] = useState<string | null>(null);
  const creationTriggeredRef = useRef(false);

  // Demo mode: /api/chat/demo requires a sessionId (it persists the demo
  // chat so it can be migrated after sign-in). Without it every demo
  // message failed with "Missing sessionId". Falls back to an in-memory id
  // if localStorage is blocked (some private-browsing modes).
  const demoSessionFallbackRef = useRef<string | null>(null);
  function demoSessionId(): string {
    try {
      return getDemoSessionId();
    } catch {
      if (!demoSessionFallbackRef.current) {
        demoSessionFallbackRef.current =
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `${Date.now().toString(16).padStart(8, "0")}-0000-4000-8000-${Math.random().toString(16).slice(2, 14).padEnd(12, "0")}`;
      }
      return demoSessionFallbackRef.current;
    }
  }
  function resetDemoSessionId() {
    try {
      clearDemoSessionId();
    } catch {
      /* ignore */
    }
    demoSessionFallbackRef.current = null;
  }

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const userMessageCount = useMemo(
    () => messages.filter((m) => m.role === "user").length,
    [messages],
  );

  // The limit only applies to the public demo. In project mode the user has
  // already signed in and created the project, so they chat freely.
  const reachedLimit = !isProjectMode && userMessageCount >= MAX_USER_MESSAGES;
  const remaining = Math.max(0, MAX_USER_MESSAGES - userMessageCount);

  // Load history. Project mode reads the saved conversation out of the
  // database via /api/chat/history. Demo mode restores from sessionStorage
  // as before. Either way messagesLoaded gates the opener effect below, so
  // a returning visitor resumes rather than getting a fresh "hello" on top
  // of their existing chat.
  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (isProjectMode && projectId) {
        try {
          const res = await fetch(
            `/api/chat/history?projectId=${encodeURIComponent(projectId)}`,
          );
          const data = await res.json().catch(() => null);

          if (!cancelled && isBookType(data?.bookType)) selectBookType(data.bookType);
          if (!cancelled && Array.isArray(data?.messages)) {
            setMessages(
              data.messages.filter((m: ChatMsg) => !isDemoNotice(m)).map((m: ChatMsg) => ({
                role: m.role,
                content: m.content,
              })),
            );
          }
          // If this project already has a story, go straight to it rather
          // than leaving the user in a chat that has already finished.
          try {
            const storyRes = await fetch(
              `/api/stories/by-project?projectId=${encodeURIComponent(projectId)}`,
              { cache: "no-store" },
            );
            const storyData = await storyRes.json().catch(() => null);
            if (!cancelled && storyData?.storyId) {
              creationTriggeredRef.current = true;
              setStoryCreating(true);
              await waitForPagesAndNavigate(storyData.storyId);
              return;
            }
          } catch (err) {
            console.error("[chat] failed to check for existing story:", err);
          }
        } catch (err) {
          console.error("[chat] failed to load project history:", err);
          reportClientError("chat_history_failed", {
            projectId,
            message: err instanceof Error ? err.message : String(err),
          });
          if (!cancelled) {
            setError("We could not load your conversation. Please refresh.");
          }
        } finally {
          if (!cancelled) setMessagesLoaded(true);
        }
        return;
      }

      const saved = sessionStorage.getItem("flipwhizz_create_demo_messages");
      if (saved) {
        try {
          const parsed = JSON.parse(saved) as ChatMsg[];
          if (Array.isArray(parsed) && parsed.length > 0) setMessages(parsed);
        } catch {
          /* ignore */
        }
      }
      if (!cancelled) setMessagesLoaded(true);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [isProjectMode, projectId]);

  const resumedProjectRef = useRef<string | null>(null);
  useEffect(() => {
    if (!isProjectMode || !projectId || !messagesLoaded || storyCreating || loading) return;
    if (resumedProjectRef.current === projectId) return;
    if (messages.at(-1)?.role !== "user") return;
    resumedProjectRef.current = projectId;
    void sendMessage(true);
    // Resume only a saved unanswered turn, once per project visit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isProjectMode, projectId, messagesLoaded, storyCreating, loading]);

  // Inject the fake AI opener, only on a genuinely fresh, empty demo start.
  // Never in project mode: an empty project chat means history is still
  // loading or genuinely empty, and an opener on top of a real saved
  // conversation is exactly the bug this replaces.
  useEffect(() => {
    if (isProjectMode) return;
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
  }, [isProjectMode, messagesLoaded, seed, messages.length]);

  // Resume effect, gate on messagesLoaded. Demo only: in project mode the
  // project already exists and there is nothing to resume into.
  useEffect(() => {
    if (isProjectMode) return;
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
  }, [
    isProjectMode,
    authStatus,
    reachedLimit,
    messages,
    hasAttemptedResume,
    messagesLoaded,
  ]);

  // Persist to sessionStorage in demo mode only. Project conversations live
  // in the database, so mirroring them into sessionStorage would just risk
  // a stale copy leaking back into a later demo.
  useEffect(() => {
    if (!messagesLoaded) return;
    if (!isProjectMode) {
      sessionStorage.setItem(
        "flipwhizz_create_demo_messages",
        JSON.stringify(messages),
      );
    }
    const id = window.setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 80);
    return () => window.clearTimeout(id);
  }, [messages, messagesLoaded, isProjectMode]);

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

  async function waitForPagesAndNavigate(nextStoryId: string) {
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const res = await fetch(`/api/stories/${nextStoryId}/pages`, {
          cache: "no-store",
        });
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) break;
      } catch {
        /* keep polling */
      }
      await new Promise((r) => setTimeout(r, 800));
    }
    window.location.href = `/stories/${nextStoryId}/pages`;
  }

  // Story creation takes 1-2 minutes and the server keeps going even if this
  // device drops the connection (iOS Safari reports that as "Load failed", with
  // no HTTP status). So when the request dies without a response, wait for the
  // story to appear instead of treating it as a failure.
  async function waitForStoryToAppear(id: string): Promise<string | null> {
    const deadline = Date.now() + 4 * 60 * 1000;
    do {
      try {
        const res = await fetch(
          `/api/stories/by-project?projectId=${encodeURIComponent(id)}`,
          { cache: "no-store" },
        );
        const data = await res.json().catch(() => null);
        if (data?.storyId) return data.storyId as string;
      } catch {
        /* still offline or backgrounded, keep trying */
      }
      await new Promise((r) => setTimeout(r, 4000));
    } while (Date.now() < deadline);
    return null;
  }

  async function createStoryFromChat(selectedBookType: BookType = bookType) {
    if (!projectId) return;
    if (creationTriggeredRef.current) return;
    creationTriggeredRef.current = true;

    setStoryCreating(true);
    setStoryError(null);
    posthog.capture("story_creation_started", { project_id: projectId });

    try {
      let res: Response;
      try {
        res = await fetch("/api/stories/create-from-chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId, bookType: selectedBookType }),
        });
      } catch (networkErr) {
        // No response at all: the connection dropped, but the server may still
        // be writing the story. Wait for it before giving up.
        console.warn("[chat] connection dropped during story creation, waiting:", networkErr);
        posthog.capture("story_creation_connection_dropped", { project_id: projectId });
        const recoveredId = await waitForStoryToAppear(projectId);
        if (recoveredId) {
          posthog.capture("story_creation_recovered", {
            project_id: projectId,
            story_id: recoveredId,
          });
          await waitForPagesAndNavigate(recoveredId);
          return;
        }
        reportClientError("story_creation_failed", {
          projectId,
          message: `${networkErr instanceof Error ? networkErr.message : "Network error"} (no story appeared within 4 minutes)`,
        });
        throw new Error(
          "We lost the connection while writing your story. We've been alerted, so please try again in a moment.",
        );
      }
      const data = await res.json().catch(() => null);

      // Another request for this project is already writing the story (for
      // example a retry after a dropped connection). Wait for that one.
      if (res.status === 409 && data?.inProgress) {
        const inFlightId = await waitForStoryToAppear(projectId);
        if (inFlightId) {
          await waitForPagesAndNavigate(inFlightId);
          return;
        }
      }

      if (!res.ok || !data?.storyId) {
        reportClientError("story_creation_failed", {
          projectId,
          status: res.status,
          message:
            data?.error ||
            (res.status === 504 ? "Timed out (504) before the story was created" : `HTTP ${res.status}`),
        });
        throw new Error(
          res.status === 504
            ? "Writing your story is taking longer than usual. We've been alerted and will finish it for you."
            : "We couldn't start writing your story just now. We've been alerted, so please try again in a moment.",
        );
      }

      posthog.capture("story_creation_succeeded", {
        project_id: projectId,
        story_id: data.storyId,
      });
      await waitForPagesAndNavigate(data.storyId);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "We could not start writing your story.";
      console.error("[chat] story creation failed:", err);
      if (!(err instanceof Error && err.message.includes("We've been alerted"))) {
        reportClientError("story_creation_failed", { projectId, message });
      }
      posthog.capture("story_creation_failed", {
        project_id: projectId,
        error: message,
      });
      setStoryError(message);
      setStoryCreating(false);
      creationTriggeredRef.current = false;
    }
  }

  async function sendMessage(resumeLastMessage = false) {
    const text = resumeLastMessage ? messages.at(-1)?.content ?? "" : input.trim();
    if (!text || savingBookType || loading || reachedLimit) return;
    const userMessage: ChatMsg = { role: "user", content: text };
    const nextHistory = resumeLastMessage ? messages : [...messages, userMessage];

    // Track first message as demo_started, demo only.
    if (!isProjectMode && messages.filter((m) => m.role === "user").length === 0) {
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
      // NOTE: verify this against your /api/chat/route.ts. The demo endpoint
      // is stateless and does not know about projects, so project chat has to
      // go somewhere that can persist into the project's chat session.
      const endpoint = isProjectMode ? "/api/chat" : "/api/chat/demo";
      const payload = isProjectMode
        ? { projectId, message: text, history: messages, bookType, resumeLastMessage }
        : { message: text, history: nextHistory, sessionId: demoSessionId(), bookType };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.status === 204) return;
      const data = await res.json().catch(() => null);

      // Server-side demo cap reached: show its friendly nudge, not an error.
      if (res.status === 429 && data?.reply) {
        setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
        return;
      }

      if (!res.ok) {
        throw new Error(
          data?.error || "The chat could not respond just now.",
        );
      }

      if (isBookType(data?.bookType)) selectBookType(data.bookType);

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            data?.reply ??
            "That sounds wonderful! Tell me a little more so I can start shaping the story.",
        },
      ]);

      // The AI has decided it has enough to write the book. Give the user a
      // moment to read the reply, then create the story.
      if (isProjectMode && data?.readyToGenerate) {
        window.setTimeout(() => {
          void createStoryFromChat(isBookType(data?.bookType) ? data.bookType : bookType);
        }, 1500);
      }
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Something went wrong while sending your message.";

      if (isProjectMode) {
        reportClientError("chat_failed", { projectId, message });
      }
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
        body: JSON.stringify({ messages, bookType }),
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
      // The demo has become a real project; start a fresh demo session next time.
      resetDemoSessionId();
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
    resetDemoSessionId();
    selectBookType("storybook");
    requestAnimationFrame(() => textareaRef.current?.focus());
  }

  async function changeBookType(value: BookType) {
    if (!projectId) { selectBookType(value); return; }
    setSavingBookType(true); setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/book-type`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bookType: value }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save book format");
      selectBookType(value);
    } catch (e) { setError(e instanceof Error ? e.message : "Please try again."); }
    finally { setSavingBookType(false); }
  }

  const showWelcome = messagesLoaded && userMessageCount === 0 && !loading && !storyCreating && !reachedLimit;

  function applySuggestion(text: string) {
    posthog.capture("studio_suggestion_clicked", { suggestion: text, project_mode: isProjectMode });
    setInput(text);
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(text.length, text.length);
    });
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 justify-center px-4 pb-1 pt-4">
        <BookTypeSelector compact value={bookType} onChange={changeBookType} disabled={savingBookType || loading || creatingProject || storyCreating || !messagesLoaded} />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-8 pt-6 sm:px-8">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-3">
          {/* While project history loads, show a spinner rather than an
              empty page that looks like the chat was lost. */}
          {isProjectMode && !messagesLoaded && (
            <div className="flex justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-[#6F4BB0]" aria-label="Loading your chat" />
            </div>
          )}

          {showWelcome && (
            <div className="mb-4 pt-2 sm:pt-6">
              <h1 className="m-0 text-[clamp(30px,4.5vw,44px)] font-bold leading-[1.02] tracking-[-0.03em] text-[#24182F]">
                {isProjectMode ? "Let's shape the story." : "Let's make their book."}
              </h1>
              <p className="mb-0 mt-3 max-w-[44ch] text-[17px] leading-[1.5] text-[#4E4259]">
                Tell me about them in your own words. A name, an age, something they love or something that really happened is plenty to start.
              </p>
            </div>
          )}

          {isProjectMode && messagesLoaded && messages.length === 0 && !storyCreating && (
            <ChatBubble from="fw">Hi! I&apos;m your co-author. Who is this story for, and what do they love?</ChatBubble>
          )}

          {messages.map((msg, i) => (
            <ChatBubble key={`${msg.role}-${i}-${msg.content.slice(0, 24)}`} from={msg.role === "user" ? "you" : "fw"}>
              {msg.content}
            </ChatBubble>
          ))}

          {showWelcome && (
            <div className="mt-3 flex flex-wrap justify-end gap-2" aria-label="Ideas to get started">
              {STUDIO_SUGGESTIONS.map(({ label, text }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => applySuggestion(text)}
                  className="min-h-[44px] rounded-full border-[1.5px] border-[#E4DCF0] bg-white px-4 text-[15px] font-semibold text-[#24182F] transition-all hover:-translate-y-0.5 hover:border-[#A270C9] hover:bg-[#F3ECFC] active:scale-95"
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          {loading && <TypingBubble />}

          {creatingProject && hasAttemptedResume && <StatusBubble>Welcome back, creating your book…</StatusBubble>}

          {reachedLimit && !(creatingProject && hasAttemptedResume) && (
            <div className="mt-4">
              <ContinueCard
                title="Your story is taking shape"
                body="Sign in to keep going, with illustrated pages, a custom cover and print options."
                onContinue={continueToFullProject}
                onReset={resetDemo}
                busy={creatingProject}
              />
            </div>
          )}

          {isProjectMode && storyCreating && <StatusBubble>Writing your story… this takes about a minute.</StatusBubble>}

          {isProjectMode && storyError && !storyCreating && (
            <div className="rounded-[22px] bg-[#FDECEF] p-5">
              <p className="m-0 text-[15px] font-medium text-[#A11D33]">{storyError}</p>
              <button
                type="button"
                onClick={() => void createStoryFromChat()}
                className="mt-3 inline-flex min-h-[46px] items-center gap-2 rounded-full bg-[#E8455C] px-5 text-[15px] font-bold text-white"
              >
                <BookOpen className="h-4 w-4" aria-hidden="true" />
                Try writing my story again
              </button>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Composer stays in the flex layout, so messages never sit behind it. */}
      <div className="shrink-0 px-4 pb-3 pt-2 sm:px-8 sm:pb-6">
        <div className="mx-auto w-full max-w-2xl">
          {!isProjectMode && userMessageCount > 0 && !reachedLimit && <RepliesLeft remaining={remaining} total={MAX_USER_MESSAGES} />}

          <ChatComposer
            textareaRef={textareaRef}
            value={input}
            onChange={setInput}
            onSend={() => void sendMessage()}
            loading={loading}
            disabled={loading || reachedLimit || creatingProject || storyCreating}
            maxHeight={160}
            placeholder={reachedLimit ? "Demo complete. Continue to create your book" : "Tell me about them…"}
          />

          {error && <p className="mb-0 mt-3 text-center text-sm font-medium text-[#C8243D]">{error}</p>}
        </div>
        <div className="h-[env(safe-area-inset-bottom)]" />
      </div>
    </div>
  );
}

// Label on the chip, and the start of a sentence it puts in the box.
const STUDIO_SUGGESTIONS = [
  { label: "It's for my son", text: "It's for my son, " },
  { label: "It's for my daughter", text: "It's for my daughter, " },
  { label: "It's for my grandchild", text: "It's for my grandchild, " },
  { label: "Something that really happened", text: "Something that really happened: " },
  { label: "A bedtime adventure", text: "A bedtime adventure about " },
];
