// src/lib/christmas.ts
/** Shared by Christmas pages, banners, checkout and confirmation emails. */
export const CHRISTMAS = {
  enabled: true,
  // Provisional supplier deadlines: Katy must confirm before advertising delivery.
  printCutoff: "2026-12-12T23:59:00+00:00",
  colouringCutoff: "2026-12-08T23:59:00+00:00",
  earlyOfferEnds: "2026-11-30T23:59:00+00:00",
  earlyOfferCode: "CHRISTMAS10",
  endsAt: "2026-12-25T00:00:00+00:00",
};

export type ChristmasPhase = "early" | "print" | "digital-only" | "over";
export const CHRISTMAS_TIME_ZONE = "Europe/London";

function timestamp(date: Date): number {
  const value = date.getTime();
  if (!Number.isFinite(value)) throw new RangeError("Invalid Christmas date");
  return value;
}

// Deadlines are exclusive: at the configured instant the offer has ended.
export function isBeforePrintCutoff(now: Date = new Date()): boolean {
  return timestamp(now) < Date.parse(CHRISTMAS.printCutoff);
}

export function isBeforeColouringCutoff(now: Date = new Date()): boolean {
  return timestamp(now) < Date.parse(CHRISTMAS.colouringCutoff);
}

const calendarFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: CHRISTMAS_TIME_ZONE,
  year: "numeric",
  month: "numeric",
  day: "numeric",
});

function londonCalendarDay(date: Date): number {
  timestamp(date);
  const parts = calendarFormatter.formatToParts(date);
  const part = (type: string) => Number(parts.find((item) => item.type === type)!.value);
  return Date.UTC(part("year"), part("month"), part("day")) / 86_400_000;
}

/** UK calendar days remaining; zero on deadline day and after the deadline. */
export function daysUntilPrintCutoff(now: Date = new Date()): number {
  return Math.max(0, londonCalendarDay(new Date(CHRISTMAS.printCutoff)) - londonCalendarDay(now));
}

export function christmasPhase(now: Date = new Date()): ChristmasPhase {
  const time = timestamp(now);
  if (!CHRISTMAS.enabled || time >= Date.parse(CHRISTMAS.endsAt)) return "over";
  if (!isBeforePrintCutoff(now)) return "digital-only";
  if (time < Date.parse(CHRISTMAS.earlyOfferEnds)) return "early";
  return "print";
}

/** Display dates consistently, for example "12 December", on server and client. */
export function formatChristmasDate(date: string | Date): string {
  const value = typeof date === "string" ? new Date(date) : date;
  timestamp(value);
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: CHRISTMAS_TIME_ZONE,
    day: "numeric",
    month: "long",
  }).format(value);
}
