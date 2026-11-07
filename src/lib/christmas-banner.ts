// src/lib/christmas-banner.ts
import { CHRISTMAS, christmasPhase, daysUntilPrintCutoff, formatChristmasDate } from "./christmas";

export const CHRISTMAS_BANNER_STORAGE_KEY = "flipwhizz:christmas-banner:v1";

export function christmasBannerMessage(now: Date = new Date()): string | null {
  const phase = christmasPhase(now);
  if (phase === "over") return null;
  if (phase === "digital-only") return "Too late for post? Give a Christmas Eve digital edition or a gift card, delivered instantly.";
  const deadline = formatChristmasDate(CHRISTMAS.printCutoff);
  if (phase === "early") return `Order by ${deadline} for Christmas delivery. 10% off with ${CHRISTMAS.earlyOfferCode} until ${formatChristmasDate(CHRISTMAS.earlyOfferEnds)}.`;
  const days = daysUntilPrintCutoff(now);
  return `Order by ${deadline} for Christmas delivery. ${days === 0 ? "Last day to order." : `${days} ${days === 1 ? "day" : "days"} left.`}`;
}

export function isChristmasAdminPath(pathname: string): boolean {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

// A changed phase or campaign setting makes a previously dismissed notice relevant again.
export function christmasBannerVersion(now: Date = new Date()): string {
  return [CHRISTMAS.printCutoff, CHRISTMAS.colouringCutoff, CHRISTMAS.earlyOfferEnds,
    CHRISTMAS.earlyOfferCode, CHRISTMAS.endsAt, christmasPhase(now)].join("|");
}

/** Runs before paint, including on cached pages. Contains config only, never user data. */
export function christmasBannerBootScript(): string {
  const config = JSON.stringify(CHRISTMAS).replace(/</g, "\\u003c");
  return `(()=>{const c=${config};const n=Date.now();const p=!c.enabled||n>=Date.parse(c.endsAt)?"over":n>=Date.parse(c.printCutoff)?"digital-only":n<Date.parse(c.earlyOfferEnds)?"early":"print";const v=[c.printCutoff,c.colouringCutoff,c.earlyOfferEnds,c.earlyOfferCode,c.endsAt,p].join("|");let hidden=p==="over";try{hidden=hidden||localStorage.getItem("${CHRISTMAS_BANNER_STORAGE_KEY}")===v}catch{}document.documentElement.dataset.christmasBannerHidden=String(hidden)})();`;
}
