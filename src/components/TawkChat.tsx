// src/components/TawkChat.tsx
"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect } from "react";

/**
 * tawk.to live chat widget.
 *
 * The script loads once for the whole app. On client-side navigation we
 * show or hide the bubble rather than reloading the script, so a visitor's
 * open conversation survives moving between pages.
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
  visitor?: { name?: string; email?: string };
  hideWidget?: () => void;
  showWidget?: () => void;
  setAttributes?: (attrs: Record<string, string>, cb?: (err?: unknown) => void) => void;
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

function applyVisibility(hidden: boolean) {
  const api = window.Tawk_API;
  if (!api) return;
  if (hidden) api.hideWidget?.();
  else api.showWidget?.();
}

export default function TawkChat() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const hidden = shouldHide(pathname);

  // Keep visibility in sync with the current route.
  useEffect(() => {
    const api = window.Tawk_API;
    if (!api) return;
    api.onLoad = () => {
      applyVisibility(shouldHide(window.location.pathname));
    };
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
