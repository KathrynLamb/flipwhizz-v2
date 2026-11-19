// src/lib/events/bookEventsCore.ts
//
// The pure half of book events: the event kinds, their labels, the email
// layout and the "is this book stalled, and where?" rule. No database here,
// so it can be unit tested (tests/book-events.test.ts) and used by client
// components (the admin timeline).

export type BookEventKind =
  | "chat_started"
  | "chat_left"
  | "signed_up"
  | "draft_created"
  | "characters_approved"
  | "locations_approved"
  | "paywall_reached"
  | "checkout_started"
  | "paid"
  | "book_drawn"
  | "stalled"
  | "failed"
  | "character_shown"
  | "character_hidden";

export const EVENT_LABELS: Record<BookEventKind, string> = {
  chat_started: "Chat started",
  chat_left: "Left the chat",
  signed_up: "Signed up",
  draft_created: "Story draft created",
  characters_approved: "Characters approved",
  locations_approved: "Places approved",
  paywall_reached: "Reached the paywall",
  checkout_started: "Started checkout",
  paid: "Paid",
  book_drawn: "Book drawn",
  stalled: "Stalled",
  failed: "Something failed",
  character_shown: "Character added to the pictures",
  character_hidden: "Character taken out of the pictures",
};

export type EventTone = "green" | "red" | "amber" | "violet" | "slate";

export const EVENT_TONES: Record<BookEventKind, EventTone> = {
  chat_started: "violet",
  chat_left: "amber",
  signed_up: "violet",
  draft_created: "violet",
  characters_approved: "slate",
  locations_approved: "slate",
  paywall_reached: "amber",
  checkout_started: "amber",
  paid: "green",
  book_drawn: "green",
  stalled: "red",
  failed: "red",
  character_shown: "violet",
  character_hidden: "slate",
};

export function eventLabel(kind: string): string {
  return EVENT_LABELS[kind as BookEventKind] ?? kind;
}

export function eventTone(kind: string): EventTone {
  return EVENT_TONES[kind as BookEventKind] ?? "slate";
}

/* -------------------------------------------------------------------------- */
/*                                   Email                                    */
/* -------------------------------------------------------------------------- */

export type CostByKind = { kind: string; calls: number; microUsd: number };

export type EventEmailInput = {
  kind: BookEventKind;
  summary: string;
  site: string;
  storyTitle?: string | null;
  ownerEmail?: string | null;
  ownerName?: string | null;
  userId?: string | null;
  projectId?: string | null;
  storyId?: string | null;
  /** AI cost so far, by ai_usage kind. Empty when nothing is tracked yet. */
  costs: CostByKind[];
  /** Free-form extras (first message, stage, amount...). */
  details?: Record<string, unknown> | null;
  /** Earlier events for the same book or chat, oldest first, for context. */
  history?: Array<{ kind: string; summary: string; createdAt: string }>;
  /** Pounds per dollar. */
  usdToGbp: number;
};

/** Plain names for ai_usage kinds (kept in step with src/lib/admin/costFormat.ts). */
const COST_LABELS: Record<string, string> = {
  character_card: "Character cards",
  character_full_body: "Character full bodies",
  location_card: "Place cards",
  characters: "Other character work",
  spread: "Spreads",
  world: "World building",
  style: "Style plate",
  planning: "Scene planning and prompts",
  cover: "Cover",
  writing: "Story writing (chat, draft, rewrites)",
  other: "Other",
};

export function money(microUsd: number, usdToGbp: number): string {
  const v = (microUsd / 1_000_000) * usdToGbp;
  const gbp = v < 1 ? `${(v * 100).toFixed(1)}p` : `£${v.toFixed(2)}`;
  return `${gbp} ($${(microUsd / 1_000_000).toFixed(2)})`;
}

export function totalCost(costs: CostByKind[]): number {
  return costs.reduce((n, c) => n + c.microUsd, 0);
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function detailLines(details: Record<string, unknown> | null | undefined): string[] {
  if (!details) return [];
  const out: string[] = [];
  for (const [k, v] of Object.entries(details)) {
    if (v === null || v === undefined || v === "") continue;
    const label = k.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
    const value = typeof v === "string" ? v : JSON.stringify(v);
    out.push(`${label}: ${value.length > 600 ? `${value.slice(0, 600)}…` : value}`);
  }
  return out;
}

export function renderEventEmail(a: EventEmailInput): { subject: string; text: string; html: string } {
  const total = totalCost(a.costs);
  const who = a.ownerEmail ?? "anonymous visitor";
  const book = a.storyTitle ? ` "${a.storyTitle}"` : "";
  const icon = a.kind === "failed" || a.kind === "stalled" ? "🔴 " : a.kind === "paid" ? "🟢 " : "";
  const subject = `${icon}${EVENT_LABELS[a.kind]}:${book} · ${who}${a.costs.length ? ` · ${money(total, a.usdToGbp).split(" ")[0]} so far` : ""}`.slice(0, 200);

  const head = [
    a.summary,
    "",
    a.storyTitle ? `Book: ${a.storyTitle}` : null,
    `Customer: ${a.ownerEmail ? `${a.ownerEmail}${a.ownerName ? ` (${a.ownerName})` : ""}` : "not signed in yet"}`,
    a.storyId ? `Admin (book): ${a.site}/admin/books/${a.storyId}` : null,
    a.userId ? `Admin (customer): ${a.site}/admin/customers/${a.userId}` : null,
    a.projectId && !a.storyId ? `Project: ${a.projectId}` : null,
  ].filter((l): l is string => l !== null);

  const extra = detailLines(a.details);
  const costRows = a.costs
    .filter((c) => c.calls > 0)
    .sort((x, y) => y.microUsd - x.microUsd)
    .map((c) => [COST_LABELS[c.kind] ?? c.kind, String(c.calls), money(c.microUsd, a.usdToGbp)]);
  const history = (a.history ?? []).map((h) => `${h.createdAt.slice(0, 16).replace("T", " ")}  ${eventLabel(h.kind)}: ${h.summary}`);
  const note = "Costs are estimates from list prices, not the bill. Chat before sign-up is not tracked.";

  const text = [
    ...head,
    ...(extra.length ? ["", ...extra] : []),
    "",
    costRows.length ? "AI cost so far:" : "AI cost so far: nothing tracked yet",
    ...costRows.map((r) => `  ${r[0]}: ${r[1]} calls, ${r[2]}`),
    ...(costRows.length ? [`  TOTAL: ${money(total, a.usdToGbp)}`] : []),
    ...(history.length ? ["", "Earlier:", ...history.map((h) => `  ${h}`)] : []),
    "",
    note,
  ].join("\n");

  const td = "padding:5px 10px;border-bottom:1px solid #e5e5e5;font-size:13px";
  const html = `<div style="font-family:system-ui,-apple-system,sans-serif;color:#111;max-width:720px">
<h2 style="margin:0 0 6px">${esc(EVENT_LABELS[a.kind])}</h2>
<p style="margin:0 0 12px;font-size:14px;line-height:1.6">${head.map((l) => (l ? esc(l) : "")).join("<br>")}</p>
${extra.length ? `<p style="margin:0 0 12px;font-size:13px;line-height:1.6;color:#333">${extra.map(esc).join("<br>")}</p>` : ""}
${
  costRows.length
    ? `<table style="border-collapse:collapse;width:100%;margin:0 0 12px">
<tr><th style="${td};text-align:left;border-bottom:2px solid #111">AI cost so far</th><th style="${td};text-align:right;border-bottom:2px solid #111">Calls</th><th style="${td};text-align:right;border-bottom:2px solid #111">Cost</th></tr>
${costRows.map((r) => `<tr><td style="${td}">${esc(r[0])}</td><td style="${td};text-align:right">${r[1]}</td><td style="${td};text-align:right">${esc(r[2])}</td></tr>`).join("\n")}
<tr><td style="${td};font-weight:700">Total</td><td style="${td}"></td><td style="${td};text-align:right;font-weight:700">${esc(money(total, a.usdToGbp))}</td></tr>
</table>`
    : `<p style="margin:0 0 12px;font-size:13px;color:#555">AI cost so far: nothing tracked yet.</p>`
}
${history.length ? `<p style="margin:0 0 4px;font-size:13px;font-weight:600">Earlier</p><p style="margin:0 0 12px;font-size:12px;line-height:1.6;color:#333;font-family:ui-monospace,Menlo,monospace">${history.map(esc).join("<br>")}</p>` : ""}
<p style="margin:0;font-size:12px;color:#555">${esc(note)}</p>
</div>`;

  return { subject, text, html };
}

/* -------------------------------------------------------------------------- */
/*                                  Stalls                                    */
/* -------------------------------------------------------------------------- */

export type BookProgress = {
  paid: boolean;
  characters: number;
  charactersWithCard: number;
  charactersApproved: number;
  places: number;
  placesWithCard: number;
  placesApproved: number;
  pagesDrawn: number;
};

export type StallStage =
  | "before_characters"
  | "character_cards"
  | "character_approval"
  | "place_cards"
  | "place_approval"
  | "before_first_page";

export const STALL_LABELS: Record<StallStage, string> = {
  before_characters: "before any characters were made",
  character_cards: "making character cards",
  character_approval: "approving character cards",
  place_cards: "making place cards",
  place_approval: "approving place cards",
  before_first_page: "before the first page was drawn",
};

/**
 * Where an unpaid book is stuck, or null when it is not stuck in the build
 * (paid books, and unpaid books with a page drawn: those are at the paywall,
 * which has its own event).
 */
export function stallStage(p: BookProgress): StallStage | null {
  if (p.paid || p.pagesDrawn > 0) return null;
  if (p.characters === 0) return "before_characters";
  if (p.charactersWithCard < p.characters) return "character_cards";
  if (p.charactersApproved < p.characters) return "character_approval";
  if (p.placesWithCard < p.places) return "place_cards";
  if (p.placesApproved < p.places) return "place_approval";
  return "before_first_page";
}

export function stallSummary(p: BookProgress, stage: StallStage, idleMinutes: number): string {
  const counts =
    stage === "character_cards" ? ` (${p.charactersWithCard} of ${p.characters} cards made)`
    : stage === "character_approval" ? ` (${p.charactersApproved} of ${p.characters} approved)`
    : stage === "place_cards" ? ` (${p.placesWithCard} of ${p.places} cards made)`
    : stage === "place_approval" ? ` (${p.placesApproved} of ${p.places} approved)`
    : "";
  return `No progress for ${idleMinutes} minutes, stuck ${STALL_LABELS[stage]}${counts}.`;
}
