// src/components/TawkChat.tsx
"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect } from "react";
import { OPEN_SUPPORT_CHAT_EVENT, type SupportChatRequest } from "@/lib/supportChat";

/**
 * tawk.to live chat widget.
 *
 * The script loads once for the whole app. On client-side navigation we
 * show or hide the bubble rather than reloading the script, so a visitor's
 * open conversation survives moving between pages.
 *
 * When something breaks, openSupportChat() (src/lib/supportChat.ts) asks
 * this component to open the chat with the problem details attached. That
 * works on every page, including ones where the bubble is normally hidden.
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

// Routes where the bubble would get in the way (chat inputs and
// bottom-anchored studio controls). Checkout, order and print status
// pages under /stories/[id] keep the widget so people can ask for help
// at the moments they're most likely to need it.
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
  onChatMinimized?: () => void;
  onChatEnded?: () => void;
  visitor?: { name?: string; email?: string };
  hideWidget?: () => void;
  showWidget?: () => void;
  maximize?: () => void;
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

// Module state shared by the handlers below (one widget per page).
let tawkLoaded = false;
// While a problem chat is open, keep the widget visible even on routes
// where it would normally be hidden.
let forcedOpen = false;
// A problem reported before the script finished loading.
let pendingProblem: SupportChatRequest | null = null;

function applyVisibility(hidden: boolean) {
  const api = window.Tawk_API;
  if (!api || !tawkLoaded) return;
  if (hidden && !forcedOpen) api.hideWidget?.();
  else api.showWidget?.();
}

// tawk.to only accepts short values (255 chars) on attributes and events.
const clip = (v: string | null | undefined, max = 250) => (v ? v.slice(0, max) : "");

function openWithProblem(problem: SupportChatRequest) {
  const api = window.Tawk_API;
  if (!api || !tawkLoaded) {
    pendingProblem = problem;
    return;
  }

  forcedOpen = true;
  api.showWidget?.();
  api.maximize?.();

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

export default function TawkChat() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const hidden = shouldHide(pathname);

  // Wire up tawk.to callbacks and the "open with a problem" listener once.
  useEffect(() => {
    const api = window.Tawk_API;
    if (!api) return;

    api.onLoad = () => {
      tawkLoaded = true;
      applyVisibility(shouldHide(window.location.pathname));
      if (pendingProblem) {
        const problem = pendingProblem;
        pendingProblem = null;
        openWithProblem(problem);
      }
    };

    // Once the parent closes the chat, go back to the page's normal rule.
    const release = () => {
      forcedOpen = false;
      applyVisibility(shouldHide(window.location.pathname));
    };
    api.onChatMinimized = release;
    api.onChatEnded = release;

    const onOpenRequest = (e: Event) => {
      const detail = (e as CustomEvent<SupportChatRequest>).detail;
      if (detail) openWithProblem(detail);
    };
    window.addEventListener(OPEN_SUPPORT_CHAT_EVENT, onOpenRequest);
    return () => window.removeEventListener(OPEN_SUPPORT_CHAT_EVENT, onOpenRequest);
  }, []);

  // Keep visibility in sync with the current route.
  useEffect(() => {
    applyVisibility(hidden);
  }, [hidden]);

  // Tell tawk.to who signed-in visitors are, so chats arrive with a
  // name and email instead of "Visitor 12345".
  const name = session?.user?.name ?? undefined;
  const email = session?.user?.email ?? undefined;
  useEffect(() => {
    const api = window.Tawk_API;
    if (!api || (!name && !email)) return;
    api.visitor = { name, email };
    const attrs: Record<string, string> = {};
    if (name) attrs.name = name;
    if (email) attrs.email = email;
    api.setAttributes?.(attrs, () => {});
  }, [name, email]);

  if (!PROPERTY_ID) return null;

  return (
    <Script
      id="tawk-to"
      strategy="lazyOnload"
      src={`https://embed.tawk.to/${PROPERTY_ID}/${WIDGET_ID}`}
      crossOrigin="anonymous"
    />
  );
}
