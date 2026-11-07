// src/components/ChristmasBanner.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CHRISTMAS } from "@/lib/christmas";
import {
  CHRISTMAS_BANNER_STORAGE_KEY, christmasBannerBootScript, christmasBannerMessage,
  christmasBannerVersion, isChristmasAdminPath,
} from "@/lib/christmas-banner";
import styles from "./ChristmasBanner.module.css";

export default function ChristmasBanner() {
  const pathname = usePathname();
  const [message, setMessage] = useState<string | null>(null);
  const dismissedVersion = useRef<string | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    function refresh() {
      const now = new Date();
      const version = christmasBannerVersion(now);
      let dismissed = dismissedVersion.current === version;
      try {
        dismissed = dismissed || localStorage.getItem(CHRISTMAS_BANNER_STORAGE_KEY) === version;
      } catch {
        // Storage can be blocked in private browsing. Dismissal still works this visit.
      }
      const nextMessage = christmasBannerMessage(now);
      document.documentElement.dataset.christmasBannerHidden = String(dismissed || !nextMessage);
      setMessage(nextMessage);
      clearTimeout(timer);
      const nextBoundary = [CHRISTMAS.earlyOfferEnds, CHRISTMAS.printCutoff, CHRISTMAS.endsAt]
        .map(Date.parse).filter((time) => time > now.getTime());
      // Refresh on boundaries, daily countdown changes, and system clock changes.
      timer = setTimeout(refresh, Math.min(30_000, ...nextBoundary.map((time) => time - now.getTime())));
    }
    refresh();
    window.addEventListener("focus", refresh);
    window.addEventListener("storage", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("storage", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);

  function dismiss() {
    const version = christmasBannerVersion();
    dismissedVersion.current = version;
    try {
      localStorage.setItem(CHRISTMAS_BANNER_STORAGE_KEY, version);
    } catch {
      // Keep the close button usable even when localStorage is unavailable.
    }
    document.documentElement.dataset.christmasBannerHidden = "true";
  }

  if (!CHRISTMAS.enabled || (pathname && isChristmasAdminPath(pathname))) return null;

  return (
    <>
      {/* Set visibility before paint to prevent a saved dismissal moving the page.
          RootLayout suppresses the expected data attribute hydration difference. */}
      <script dangerouslySetInnerHTML={{ __html: christmasBannerBootScript() }} />
      <aside className={styles.banner} data-christmas-banner aria-label="Christmas delivery">
        {message ? (
          <div className={styles.inner}>
            <Link href="/christmas" className={styles.link}>{message}</Link>
            <button type="button" onClick={dismiss} className={styles.close} aria-label="Dismiss Christmas banner">
              <span aria-hidden="true">×</span>
            </button>
          </div>
        ) : null}
      </aside>
    </>
  );
}
