// src/lib/supportChat.ts
//
// Opens the tawk.to chat when a parent hits a real problem, so they can
// tell Katy straight away instead of leaving. The details of what broke
// are attached to the chat (visible to Katy in the tawk.to visitor panel),
// so the parent doesn't have to explain the technical side.
//
// TawkChat.tsx listens for the event this dispatches. That keeps all
// tawk.to handling in one place, including showing the widget on studio
// pages where it is normally hidden.

export const OPEN_SUPPORT_CHAT_EVENT = "flipwhizz:open-support-chat";

export type SupportChatProblem = {
  /** Short machine-readable label, e.g. "generation_failed". */
  kind: string;
  /** What went wrong, for Katy (not shown to the parent). */
  message?: string | null;
  storyId?: string | null;
  projectId?: string | null;
};

export type SupportChatRequest = SupportChatProblem & {
  page: string | null;
};

/**
 * Open the chat with problem details attached.
 *
 * `auto: true` is for opening without the parent asking (an error just
 * happened). It opens at most once per kind per browser session, so a
 * parent retrying a flaky step isn't ambushed by the chat every time.
 * Leave it off when the parent clicked a "tell Katy" button.
 */
export function openSupportChat(
  problem: SupportChatProblem,
  { auto = false }: { auto?: boolean } = {},
) {
  if (typeof window === "undefined") return;

  try {
    if (auto) {
      const key = `fw-support-chat-opened:${problem.kind}`;
      if (window.sessionStorage.getItem(key)) return;
      window.sessionStorage.setItem(key, "1");
    }
  } catch {
    /* storage can be blocked (private mode); opening anyway is fine */
  }

  const detail: SupportChatRequest = {
    ...problem,
    page: window.location.pathname + window.location.search,
  };
  window.dispatchEvent(new CustomEvent(OPEN_SUPPORT_CHAT_EVENT, { detail }));
}
