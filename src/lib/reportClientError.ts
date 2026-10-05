// src/lib/reportClientError.ts
//
// Browser-side: tell the server (and so Katy) that something failed in a
// way the server may not have seen. Never throws, never blocks the UI.

export type ClientErrorKind =
  | "story_creation_failed"
  | "chat_failed"
  | "chat_history_failed"
  | "checkout_failed"
  | "generation_stalled";

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
}
