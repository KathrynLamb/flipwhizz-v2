// /src/app/projects/create/CreateDemoClient.tsx

"use client";
import BookTypeSelector from "@/components/books/BookTypeSelector";
import { useBookTypeDraft } from "@/lib/books/useBookTypeDraft";
import { isBookType } from "@/lib/books/bookType";

import { useMemo, useRef, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";
import { getDemoSessionId, migrateDemoToUserAccount, clearDemoSessionId } from "@/lib/demo-session-utils";
import { useSession } from "next-auth/react";
import { ChatBubble, TypingBubble, StatusBubble, RepliesLeft, ChatComposer, ContinueCard } from "@/components/chat/ChatBits";
import posthog from "posthog-js";
import { STARTER_OPENER, buildStarterConversation } from "@/lib/chatStarter";

type ChatMsg = {
  role: "user" | "assistant";
  content: string;
  // Set on the answer a visitor gave on the homepage or a gift page. It is
  // shown as their first message but does not use one of the free messages.
  prefilled?: boolean;
};

const FIRST_MESSAGE_TRACKED_KEY = "flipwhizz_story_chat_first_message_tracked";

function trackFirstMessage(entry: string, utmSource: string | null, prefilled: boolean) {
  try {
    if (sessionStorage.getItem(FIRST_MESSAGE_TRACKED_KEY)) return;
    sessionStorage.setItem(FIRST_MESSAGE_TRACKED_KEY, "1");
  } catch {
    /* storage unavailable: still capture once per mount */
  }
  posthog.capture("story_chat_first_message", {
    entry,
    utm_source: utmSource,
    prefilled,
  });
}

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

export default function CreateDemoClient() {
  const router = useRouter();
  const { data: session, status: authStatus } = useSession();

  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [messagesLoaded, setMessagesLoaded] = useState(false);
  const [serverLimitReached, setServerLimitReached] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [creatingProject, setCreatingProject] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasAttemptedResume, setHasAttemptedResume] = useState(false);
  const [sessionId, setSessionId] = useState<string>("");
  // Guard so the opener is only ever injected once per mount.
  const openerInjectedRef = useRef(false);

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Only messages the visitor typed here count toward the free demo messages.
  const userMessageCount = useMemo(
    () => messages.filter((m) => m.role === "user" && !m.prefilled).length,
    [messages],
  );

  // A returning visitor may have no visible messages yet. Let them enter
  // their idea before showing the sign-in handoff, even if the server cap is known.
  const reachedLimit =
    (serverLimitReached && userMessageCount > 0) ||
    userMessageCount >= MAX_USER_MESSAGES;
  const remaining = serverLimitReached ? 0 : Math.max(0, MAX_USER_MESSAGES - userMessageCount);

  const searchParams = useSearchParams();
  const seed = searchParams.get("seed");
  const starter = useMemo(
    () =>
      buildStarterConversation({
        for: searchParams.get("for"),
        name: searchParams.get("name"),
        occasion: searchParams.get("occasion"),
        about: searchParams.get("about"),
      }),
    [searchParams],
  );
  const entry = searchParams.get("entry") ?? (starter ? "starter_link" : "direct");
  const utmSource = searchParams.get("utm_source");
  const { bookType, selectBookType } = useBookTypeDraft(searchParams.get("bookType"));

  // Initialize the demo session ID on mount
  useEffect(() => {
    const id = getDemoSessionId();
    setSessionId(id);
    setServerLimitReached(sessionStorage.getItem("flipwhizz_demo_limit_session") === id);
  }, []);

  // Load any saved conversation first. This must run before we decide whether
  // to inject an opener, so a returning mid-demo visitor resumes rather than
  // getting a fresh "hello" on top of their existing chat.
  useEffect(() => {
    const saved = sessionStorage.getItem("flipwhizz_create_demo_messages");
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as ChatMsg[];
        const hasTypedMessages = Array.isArray(parsed) && parsed.some((m) => m.role === "user" && !m.prefilled);
        // A fresh answer from the homepage replaces a chat that never got past
        // the opener. A chat the visitor has actually typed into always resumes.
        if (Array.isArray(parsed) && parsed.length > 0 && (hasTypedMessages || !starter)) setMessages(parsed);
      } catch {
        /* ignore */
      }
    }
    setMessagesLoaded(true);
    // Only on mount: the starter params are read once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

    // Arrived from a chat starter: show the conversation already under way,
    // with their answer sent and our next question waiting.
    if (starter) {
      setMessages([
        { role: "assistant", content: STARTER_OPENER },
        { role: "user", content: starter.answer, prefilled: true },
        { role: "assistant", content: starter.followUp },
      ]);
      posthog.capture("demo_opener_shown", { seeded: false, seed: null, starter: true, entry });
      trackFirstMessage(entry, utmSource, true);
      requestAnimationFrame(() => textareaRef.current?.focus());
      return;
    }

    const seedOpener = seed ? SEED_OPENERS[seed] : undefined;
    const opener = bookType === "colouring_storybook"
      ? "Hi! Let’s make a colouring storybook starring your child, with a full-colour cover and outline pictures inside for them to colour. What’s their name, how old are they, and what do they love?"
      : seedOpener ?? pickGenericOpener();

    setMessages([{ role: "assistant", content: opener }]);

    posthog.capture("demo_opener_shown", {
      seeded: Boolean(seedOpener),
      seed: seedOpener ? seed : null,
    });

    // Focus the box so the cursor is already there. The proven failure mode
    // was visitors never moving to the input at all.
    requestAnimationFrame(() => textareaRef.current?.focus());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messagesLoaded, seed, messages.length, bookType]);

  // Resume effect, gate on messagesLoaded
  useEffect(() => {
    if (!messagesLoaded) return;
    if (hasAttemptedResume) return;
    if (authStatus !== "authenticated") return;
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
    if (!input.trim() || loading || reachedLimit || !sessionId) return;

    const text = input.trim();
    const userMessage: ChatMsg = { role: "user", content: text };
    const nextHistory = [...messages, userMessage];

    // Track first typed message as demo_started
    if (userMessageCount === 0) {
      posthog.capture("demo_started", {
        is_authenticated: authStatus === "authenticated",
        message_preview: text.slice(0, 80),
        entry,
      });
      trackFirstMessage(entry, utmSource, false);
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
        body: JSON.stringify({
          message: text,
          history: nextHistory.map(({ role, content }) => ({ role, content })),
          bookType,
          sessionId, // Pass the sessionId
        }),
      });

      const data = await res.json().catch(() => null);

      if (res.status === 429 && data?.error === "demo_limit") {
        setServerLimitReached(true);
        sessionStorage.setItem("flipwhizz_demo_limit_session", sessionId);
        if (authStatus !== "authenticated") setMessages((prev) => [...prev, {
          role: "assistant",
          content: "You’ve used the free messages for this demo. Your story idea is saved here—continue below to sign in and keep creating your book.",
        }]);
        return;
      }

      if (!res.ok) {
        throw new Error(
          data?.error || "The demo chat could not respond just now.",
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
        body: JSON.stringify({ messages: messages.map(({ role, content }) => ({ role, content })), bookType }),
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
    selectBookType("storybook");
    requestAnimationFrame(() => textareaRef.current?.focus());
  }

  return (
    <div className="flex h-full flex-col">
      <BookTypeSelector value={bookType} onChange={selectBookType} disabled={loading || creatingProject || !messagesLoaded} />

      <div className="flex-1 pb-44 pt-8">
        <div className="flex flex-col gap-3">
          {messages.map((msg, i) => (
            <ChatBubble key={`${msg.role}-${i}-${msg.content.slice(0, 24)}`} from={msg.role === "user" ? "you" : "fw"}>
              {msg.content}
            </ChatBubble>
          ))}

          {loading && <TypingBubble />}

          {creatingProject && hasAttemptedResume && <StatusBubble>Welcome back, creating your book…</StatusBubble>}

          {reachedLimit && !(creatingProject && hasAttemptedResume) && (
            <div className="mt-4">
              <ContinueCard
                title={serverLimitReached ? "Continue your story" : "Your story is taking shape"}
                body={
                  authStatus === "authenticated"
                    ? "Carry on shaping it, then we'll illustrate every page and make its cover."
                    : "Sign in to keep going. Your chat comes with you, then we'll illustrate every page and make its cover."
                }
                onContinue={continueToFullProject}
                onReset={resetDemo}
                busy={creatingProject}
                continueDisabled={userMessageCount === 0}
              />
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Composer, fixed to the bottom of the screen. */}
      <div className="fixed inset-x-0 bottom-0 z-40 bg-gradient-to-t from-white via-white to-white/0 px-4 pb-3 pt-8 sm:px-6 sm:pb-5">
        <div className="mx-auto w-full max-w-2xl">
          {userMessageCount > 0 && !reachedLimit && <RepliesLeft remaining={remaining} total={MAX_USER_MESSAGES} />}

          {userMessageCount === 0 && !reachedLimit && (
            <p className="mb-2.5 mt-0 text-center text-[14px] text-[#6A5E73]">
              Your first illustrated page is free. No sign-up to start.
            </p>
          )}

          <ChatComposer
            textareaRef={textareaRef}
            value={input}
            onChange={setInput}
            onSend={() => void sendMessage()}
            loading={loading}
            disabled={loading || reachedLimit || creatingProject}
            maxHeight={100}
            placeholder={
              reachedLimit
                ? "Demo complete. Continue to create your book"
                : bookType === "colouring_storybook"
                  ? "Their name, age, favourite things…"
                  : "A name, an age, what they love…"
            }
          />

          {error && <p className="mb-0 mt-3 text-center text-sm font-medium text-[#C8243D]">{error}</p>}
        </div>
        <div className="h-[env(safe-area-inset-bottom)]" />
      </div>
    </div>
  );
}
