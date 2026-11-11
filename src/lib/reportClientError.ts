// src/lib/reportClientError.ts
//
// Browser-side: tell the server (and so Katy) that something failed in a
// way the server may not have seen. Never throws, never blocks the UI.
//
// For failures that stop a parent in their tracks, it also opens the live
// chat (once per kind per session) so they can talk to Katy right away.

import { openSupportChat } from "@/lib/supportChat";

export type ClientErrorKind =
  | "story_creation_failed"
  | "chat_failed"
  | "chat_history_failed"
  | "checkout_failed"
  | "generation_stalled"
  | "generation_slow";

// Failures worth interrupting the parent for. Losing old chat history is
// annoying but doesn't block them, so it only alerts Katy.
const OPENS_SUPPORT_CHAT: ReadonlySet<ClientErrorKind> = new Set([
  "story_creation_failed",
  "chat_failed",
  "checkout_failed",
  "generation_stalled",
]);

export function reportClientError(
  kind: ClientErrorKind,
  details: {
    message?: string;
    status?: number;
    projectId?: string | null;
    storyId?: string | null;
  } = {},
) {
  try {
    void fetch("/api/alerts/client", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        kind,
        ...details,
        page: typeof window !== "undefined" ? window.location.pathname + window.location.search : null,
      }),
    }).catch(() => {});
  } catch {
    /* never let reporting break the page */
  }

  if (OPENS_SUPPORT_CHAT.has(kind)) {
    try {
      openSupportChat(
        {
          kind,
          message: details.status ? `${details.message ?? ""} (HTTP ${details.status})`.trim() : details.message,
          storyId: details.storyId,
          projectId: details.projectId,
        },
        { auto: true },
      );
    } catch {
      /* never let the chat break the page */
    }
  }
}
