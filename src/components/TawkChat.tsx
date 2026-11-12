// src/components/TawkChat.tsx
"use client";

import { useCookieConsent } from "./CookiePreferences";
import Script from "next/script";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { OPEN_SUPPORT_CHAT_EVENT, type SupportChatRequest } from "@/lib/supportChat";

/**
 * tawk.to live chat widget, with our own draggable launcher.
 *
 * tawk.to's bubble lives in an iframe, so visitors can't move it and it
 * covered menus on mobile. We keep tawk.to's bubble hidden at all times
 * and show our own FlipWhizz button instead. Visitors can drag it to
 * either side of the screen; it remembers where they left it. Tapping it
 * opens the tawk.to chat window. Closing the chat hides tawk.to again and
 * brings our button back.
 *
 * The script loads once for the whole app. On client-side navigation we
 * show or hide the launcher rather than reloading the script, so a
 * visitor's open conversation survives moving between pages.
 *
 * When something breaks, openSupportChat() (src/lib/supportChat.ts) asks
 * this component to open the chat with the problem details attached. That
 * works on every page, including ones where the launcher is normally hidden.
 *
 * Optional overrides (Vercel or .env.local):
 *   NEXT_PUBLIC_TAWK_PROPERTY_ID  e.g. 6720abc123def4567890abcd
 *   NEXT_PUBLIC_TAWK_WIDGET_ID    e.g. 1ibc2def3 (or "default")
 * Both come from tawk.to > Administration > Chat Widget > Direct Chat Link:
 *   https://tawk.to/chat/<PROPERTY_ID>/<WIDGET_ID>
 */

// FlipWhizz property. These IDs are public (they appear in page source),
// so defaults live here; env vars can override them if ever needed.
const PROPERTY_ID =
  process.env.NEXT_PUBLIC_TAWK_PROPERTY_ID || "6aeca71d11a8e03c36a4b70f";
const WIDGET_ID = process.env.NEXT_PUBLIC_TAWK_WIDGET_ID || "1k6m6pjhe";

// Routes where the launcher would get in the way (chat inputs and
// bottom-anchored studio controls). Checkout, order and print status
// pages under /stories/[id] keep it so people can ask for help at the
// moments they're most likely to need it.
const HIDDEN_PREFIXES = ["/admin", "/dev", "/chat"];
const STORY_ROUTES_WITH_CHAT = ["checkout", "order", "print"];

function shouldHide(pathname: string | null): boolean {
  if (!pathname) return false;
  if (HIDDEN_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return true;
  }
  const story = pathname.match(/^\/stories\/[^/]+(?:\/([^/]+))?/);
  if (story) {
    const section = story[1];
    return !section || !STORY_ROUTES_WITH_CHAT.includes(section);
  }
  return false;
}

type TawkApi = {
  onLoad?: () => void;
  onChatMaximized?: () => void;
  onChatMinimized?: () => void;
  onChatEnded?: () => void;
  onUnreadCountChanged?: (count: number) => void;
  visitor?: { name?: string; email?: string };
  hideWidget?: () => void;
  showWidget?: () => void;
  maximize?: () => void;
  minimize?: () => void;
  isChatMaximized?: () => boolean;
  setAttributes?: (attrs: Record<string, string>, cb?: (err?: unknown) => void) => void;
  addEvent?: (
    name: string,
    metadata?: Record<string, string>,
    cb?: (err?: unknown) => void,
  ) => void;
};

declare global {
  interface Window {
    Tawk_API?: TawkApi;
    Tawk_LoadStart?: Date;
  }
}

// Prepare Tawk_API before the script runs so onLoad and visitor details
// are picked up on first load. Runs once, when this module loads client-side.
if (typeof window !== "undefined" && !window.Tawk_API) {
  window.Tawk_API = {};
  window.Tawk_LoadStart = new Date();
}

// ---------------------------------------------------------------------------
// Module state shared by the tawk.to callbacks and the launcher (one widget
// per page). React reads it through useSyncExternalStore below.
// ---------------------------------------------------------------------------

type ChatState = { loaded: boolean; open: boolean; unread: number };

let state: ChatState = { loaded: false, open: false, unread: 0 };
// While a problem chat is open, don't close it when the route changes to
// one where the launcher is normally hidden.
let forcedOpen = false;
// A problem reported before the script finished loading.
let pendingProblem: SupportChatRequest | null = null;

const listeners = new Set<() => void>();
const SERVER_STATE: ChatState = { loaded: false, open: false, unread: 0 };

function setState(patch: Partial<ChatState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// tawk.to's own bubble is only ever visible while its chat window is open.
function syncTawkWidget() {
  const api = window.Tawk_API;
  if (!api || !state.loaded) return;
  if (state.open) api.showWidget?.();
  else api.hideWidget?.();
}

function openChat() {
  const api = window.Tawk_API;
  if (!api || !state.loaded) return;
  setState({ open: true });
  api.showWidget?.();
  api.maximize?.();
}

// tawk.to only accepts short values (255 chars) on attributes and events.
const clip = (v: string | null | undefined, max = 250) => (v ? v.slice(0, max) : "");

function openWithProblem(problem: SupportChatRequest) {
  const api = window.Tawk_API;
  if (!api || !state.loaded) {
    pendingProblem = problem;
    return;
  }

  forcedOpen = true;
  openChat();

  // Attributes show in the visitor details panel next to the chat.
  // Keys must be letters, numbers and dashes only.
  const attrs: Record<string, string> = {
    "last-problem": clip(problem.kind, 60),
    "problem-page": clip(problem.page),
  };
  if (problem.message) attrs["problem-detail"] = clip(problem.message);
  if (problem.storyId) attrs["problem-story"] = clip(problem.storyId, 64);
  if (problem.projectId) attrs["problem-project"] = clip(problem.projectId, 64);
  api.setAttributes?.(attrs, () => {});

  // Events appear in the chat timeline, so each problem is kept even if
  // the same parent hits several in one visit.
  api.addEvent?.("problem-reported", attrs, () => {});
}

// ---------------------------------------------------------------------------
// Draggable launcher
// ---------------------------------------------------------------------------

const SIZE = 56;
const EDGE = 12; // gap from the left/right edge once snapped
const TOP_CLEARANCE = 72; // stay below the site header
const BOTTOM_CLEARANCE = 56; // stay above the cookie-settings pill and iOS home bar
const DRAG_THRESHOLD = 6; // px of movement before a press counts as a drag
const STORAGE_KEY = "fw-chat-launcher-pos";

type Pos = { side: "left" | "right"; y: number };

function clampY(y: number) {
  const max = window.innerHeight - SIZE - BOTTOM_CLEARANCE;
  return Math.max(TOP_CLEARANCE, Math.min(y, max));
}

function defaultPos(): Pos {
  return { side: "right", y: clampY(window.innerHeight - SIZE - 100) };
}

function loadPos(): Pos {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw) as Pos;
      if ((saved.side === "left" || saved.side === "right") && typeof saved.y === "number") {
        return { side: saved.side, y: clampY(saved.y) };
      }
    }
  } catch {}
  return defaultPos();
}

function ChatLauncher({ unread }: { unread: number }) {
  // Only ever rendered client-side after tawk.to loads, so reading
  // localStorage in the initializer is safe (no server render to mismatch).
  const [pos, setPos] = useState<Pos>(loadPos);
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const press = useRef<{ px: number; py: number; x: number; y: number; moved: boolean } | null>(
    null,
  );
  const suppressClick = useRef(false);

  useEffect(() => {
    const onResize = () => setPos((p) => ({ ...p, y: clampY(p.y) }));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    press.current = { px: e.clientX, py: e.clientY, x: rect.left, y: rect.top, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const p = press.current;
    if (!p) return;
    const dx = e.clientX - p.px;
    const dy = e.clientY - p.py;
    if (!p.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    p.moved = true;
    setDrag({
      x: Math.max(0, Math.min(p.x + dx, window.innerWidth - SIZE)),
      y: clampY(p.y + dy),
    });
  };

  const endPress = () => {
    const p = press.current;
    press.current = null;
    if (!p || !p.moved) return;
    suppressClick.current = true;
    const x = drag?.x ?? p.x;
    const y = drag?.y ?? p.y;
    const next: Pos = {
      side: x + SIZE / 2 < window.innerWidth / 2 ? "left" : "right",
      y: clampY(y),
    };
    setPos(next);
    setDrag(null);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {}
  };

  // Click covers taps and keyboard (Enter/Space); a finished drag is ignored.
  const onClick = () => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    openChat();
  };

  const dragging = drag !== null;

  return (
    <button
      type="button"
      aria-label={unread ? `Chat with Katy (${unread} unread)` : "Chat with Katy"}
      title="Chat with Katy (drag to move)"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endPress}
      onPointerCancel={endPress}
      onClick={onClick}
      className="fixed z-50 flex items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#342044]"
      style={{
        top: dragging ? drag.y : pos.y,
        left: dragging ? drag.x : pos.side === "left" ? EDGE : undefined,
        right: !dragging && pos.side === "right" ? EDGE : undefined,
        width: SIZE,
        height: SIZE,
        background: "linear-gradient(135deg, #DB79AC 0%, #9B88CF 100%)",
        boxShadow: dragging ? "0 12px 28px rgba(52,32,68,0.3)" : "0 6px 16px rgba(52,32,68,0.22)",
        transform: dragging ? "scale(1.08)" : "scale(1)",
        transition: dragging ? "none" : "top 0.2s ease, transform 0.15s ease, box-shadow 0.15s ease",
        touchAction: "none",
        userSelect: "none",
        WebkitUserSelect: "none",
        cursor: dragging ? "grabbing" : "pointer",
      }}
    >
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.2 3.6c-.5.4-1.3.1-1.3-.6V16A2.5 2.5 0 0 1 4 13.5v-8Z"
          fill="#fff"
        />
      </svg>
      {unread > 0 && (
        <span
          aria-hidden="true"
          className="absolute -right-0.5 -top-0.5 min-w-5 rounded-full border-2 border-white bg-[#F2546A] px-1 text-center text-xs font-bold leading-4 text-white"
        >
          {unread}
        </span>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------

export default function TawkChat() {
  const { consent } = useCookieConsent();
  const pathname = usePathname();
  const { data: session } = useSession();
  const hidden = shouldHide(pathname);
  const chat = useSyncExternalStore(subscribe, () => state, () => SERVER_STATE);

  // Wire up tawk.to callbacks and the "open with a problem" listener once.
  useEffect(() => {
    const api = window.Tawk_API;
    if (!api) return;

    api.onLoad = () => {
      setState({ loaded: true, open: api.isChatMaximized?.() ?? false });
      syncTawkWidget();
      if (pendingProblem) {
        const problem = pendingProblem;
        pendingProblem = null;
        openWithProblem(problem);
      }
    };

    // tawk.to can open itself (e.g. an agent reply or a trigger), so follow
    // its window state rather than only our own clicks.
    api.onChatMaximized = () => {
      setState({ open: true });
      syncTawkWidget();
    };

    // Once the parent closes the chat, hide tawk.to and bring our button back.
    api.onChatMinimized = () => {
      forcedOpen = false;
      setState({ open: false });
      syncTawkWidget();
    };
    api.onChatEnded = () => {
      forcedOpen = false;
    };

    api.onUnreadCountChanged = (count) => setState({ unread: count });

    const onOpenRequest = (e: Event) => {
      const detail = (e as CustomEvent<SupportChatRequest>).detail;
      if (detail) openWithProblem(detail);
    };
    window.addEventListener(OPEN_SUPPORT_CHAT_EVENT, onOpenRequest);
    return () => window.removeEventListener(OPEN_SUPPORT_CHAT_EVENT, onOpenRequest);
  }, []);

  // Moving to a page where chat would get in the way closes an open chat,
  // unless it was opened for a problem the parent is reporting.
  useEffect(() => {
    if (hidden && state.open && !forcedOpen) window.Tawk_API?.minimize?.();
  }, [hidden]);

  // Tell tawk.to who signed-in visitors are, so chats arrive with a
  // name and email instead of "Visitor 12345".
  const name = session?.user?.name ?? undefined;
  const email = session?.user?.email ?? undefined;
  useEffect(() => {
    const api = window.Tawk_API;
    if (!consent?.chat || !api || (!name && !email)) return;
    api.visitor = { name, email };
    const attrs: Record<string, string> = {};
    if (name) attrs.name = name;
    if (email) attrs.email = email;
    api.setAttributes?.(attrs, () => {});
  }, [name, email, consent?.chat]);

  if (!PROPERTY_ID || !consent?.chat) return null;

  return (
    <>
      <Script
        id="tawk-to"
        strategy="lazyOnload"
        src={`https://embed.tawk.to/${PROPERTY_ID}/${WIDGET_ID}`}
        crossOrigin="anonymous"
      />
      {chat.loaded && !chat.open && !hidden && <ChatLauncher unread={chat.unread} />}
    </>
  );
}
