// src/lib/emails/sendCardsReport.ts
//
// The "cards approved" report. Sent to Katy each time a customer approves
// every character in a book, and again when they approve every location.
// It adds up the ai_usage rows for that book (src/lib/geminiUsage.ts): how
// many pictures each card took, how many of those were regenerations, the
// tokens used and the estimated cost.
//
// buildCardsReport() is pure (rows in, numbers out) so it can be tested.
// sendCardsApprovedReport() never throws: a report must never get in the way
// of a customer's approval. It sends once per set of approved pictures (two
// approval calls for the same pictures give one email), and again whenever a
// card is regenerated and the set is approved again.

import { createHash } from "node:crypto";
import { formatGbp, formatUsd } from "@/lib/ai/pricing";

export type CardsReportKind = "characters" | "locations";

export type UsageRow = {
  kind: string;
  entityId: string | null;
  model: string;
  image: boolean;
  ok: boolean;
  imagesOut: number;
  promptTokens: number | null;
  outputTokens: number | null;
  thoughtTokens: number | null;
  totalTokens: number | null;
  costMicroUsd: number | null;
};

export type CardLine = {
  entityId: string | null;
  name: string;
  /** Pictures that came back, across the card and (for characters) its full-body reference. */
  images: number;
  /** Card pictures after the first one. */
  regenerations: number;
  /** Calls that failed or came back with no picture. */
  failedCalls: number;
  /** Text and vision calls (photo checks, descriptions). */
  textCalls: number;
  promptTokens: number;
  thoughtTokens: number;
  totalTokens: number;
  costMicroUsd: number;
  /** Calls whose model has no price in pricing.ts, so their cost is missing. */
  unpricedCalls: number;
  models: string[];
};

export type CardsReport = { lines: CardLine[]; total: CardLine };

const KINDS: Record<CardsReportKind, { card: string; all: string[] }> = {
  characters: { card: "character_card", all: ["character_card", "character_full_body"] },
  locations: { card: "location_card", all: ["location_card"] },
};

const emptyLine = (entityId: string | null, name: string): CardLine => ({
  entityId,
  name,
  images: 0,
  regenerations: 0,
  failedCalls: 0,
  textCalls: 0,
  promptTokens: 0,
  thoughtTokens: 0,
  totalTokens: 0,
  costMicroUsd: 0,
  unpricedCalls: 0,
  models: [],
});

/**
 * names: every character or location in the book, so a card that made no
 * tracked calls still shows up (with zeros) instead of going missing.
 */
export function buildCardsReport(
  kind: CardsReportKind,
  rows: UsageRow[],
  names: Array<{ id: string; name: string }>,
): CardsReport {
  const { card, all } = KINDS[kind];
  const byId = new Map<string, CardLine>();
  for (const n of names) byId.set(n.id, emptyLine(n.id, n.name));
  const cardImages = new Map<string, number>();

  for (const r of rows) {
    if (!all.includes(r.kind)) continue;
    const key = r.entityId ?? "unknown";
    if (!byId.has(key)) byId.set(key, emptyLine(r.entityId, r.entityId ? "(removed from the book)" : "(not linked to a card)"));
    const line = byId.get(key)!;

    if (r.image) {
      if (r.ok && r.imagesOut > 0) {
        line.images += r.imagesOut;
        if (r.kind === card) cardImages.set(key, (cardImages.get(key) ?? 0) + r.imagesOut);
      } else {
        line.failedCalls += 1;
      }
    } else if (r.ok) {
      line.textCalls += 1;
    } else {
      line.failedCalls += 1;
    }
    line.promptTokens += r.promptTokens ?? 0;
    line.thoughtTokens += r.thoughtTokens ?? 0;
    line.totalTokens += r.totalTokens ?? 0;
    if (r.costMicroUsd == null) {
      if (r.ok) line.unpricedCalls += 1;
    } else {
      line.costMicroUsd += r.costMicroUsd;
    }
    if (!line.models.includes(r.model)) line.models.push(r.model);
  }

  for (const [key, line] of byId) line.regenerations = Math.max(0, (cardImages.get(key) ?? 0) - 1);

  const lines = [...byId.values()].sort((a, b) => b.costMicroUsd - a.costMicroUsd || a.name.localeCompare(b.name));
  const total = emptyLine(null, "Total");
  for (const l of lines) {
    total.images += l.images;
    total.regenerations += l.regenerations;
    total.failedCalls += l.failedCalls;
    total.textCalls += l.textCalls;
    total.promptTokens += l.promptTokens;
    total.thoughtTokens += l.thoughtTokens;
    total.totalTokens += l.totalTokens;
    total.costMicroUsd += l.costMicroUsd;
    total.unpricedCalls += l.unpricedCalls;
    for (const m of l.models) if (!total.models.includes(m)) total.models.push(m);
  }
  return { lines, total };
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const num = (n: number) => n.toLocaleString("en-GB");
const cost = (micro: number) => `${formatGbp(micro)} (${formatUsd(micro)})`;

export function renderCardsReport(args: {
  kind: CardsReportKind;
  storyTitle: string;
  storyId: string;
  ownerEmail: string | null;
  report: CardsReport;
  site: string;
}): { subject: string; text: string; html: string } {
  const { kind, report } = args;
  const label = kind === "characters" ? "Characters" : "Locations";
  const { total } = report;
  const tracked = total.images + total.failedCalls + total.textCalls > 0;
  const count = (n: number, one: string) => `${num(n)} ${one}${n === 1 ? "" : "s"}`;
  const subject = `${label} approved: "${args.storyTitle}" · ${count(total.images, "picture")}, ${count(total.regenerations, "regeneration")}, ${formatGbp(total.costMicroUsd)}`;

  const head = [
    `Book: ${args.storyTitle}`,
    args.ownerEmail ? `Customer: ${args.ownerEmail}` : null,
    `Admin: ${args.site}/admin/books/${args.storyId}`,
    `Models: ${total.models.join(", ") || "none recorded"}`,
  ].filter(Boolean) as string[];

  const notes: string[] = [];
  if (!tracked) notes.push("No tracked calls for this book. Its cards were made before usage tracking went live, or the ai_usage table does not exist yet.");
  if (total.unpricedCalls > 0) notes.push(`${total.unpricedCalls} call(s) used a model with no price in src/lib/ai/pricing.ts, so the cost shown is too low.`);
  notes.push("Costs are estimates from Google's list prices, not the bill. Regenerations are card pictures after the first.");

  const cols = ["Card", "Pictures", "Regenerations", "Failed calls", "Text calls", "Tokens in", "Thinking tokens", "Cost"];
  const row = (l: CardLine) => [l.name, num(l.images), num(l.regenerations), num(l.failedCalls), num(l.textCalls), num(l.promptTokens), num(l.thoughtTokens), cost(l.costMicroUsd)];
  const body = [...report.lines.map(row), row(total)];

  const text = [
    `${label} approved`,
    ...head,
    "",
    ...report.lines.map((l) => `${l.name}: ${l.images} pictures, ${l.regenerations} regenerations, ${l.failedCalls} failed, ${num(l.totalTokens)} tokens, ${cost(l.costMicroUsd)}`),
    "",
    `TOTAL: ${total.images} pictures, ${total.regenerations} regenerations, ${total.failedCalls} failed, ${num(total.totalTokens)} tokens, ${cost(total.costMicroUsd)}`,
    "",
    ...notes,
  ].join("\n");

  const td = "padding:6px 10px;border-bottom:1px solid #e5e5e5;text-align:right;font-size:13px";
  const html = `<div style="font-family:system-ui,-apple-system,sans-serif;color:#111;max-width:760px">
<h2 style="margin:0 0 8px">${label} approved</h2>
<p style="margin:0 0 14px;font-size:14px;line-height:1.6">${head.map(esc).join("<br>")}</p>
<table style="border-collapse:collapse;width:100%">
<tr>${cols.map((c, i) => `<th style="${td};text-align:${i === 0 ? "left" : "right"};border-bottom:2px solid #111">${c}</th>`).join("")}</tr>
${body.map((r, ri) => `<tr>${r.map((c, i) => `<td style="${td};text-align:${i === 0 ? "left" : "right"}${ri === body.length - 1 ? ";font-weight:700" : ""}">${esc(c)}</td>`).join("")}</tr>`).join("\n")}
</table>
<p style="margin:14px 0 0;font-size:12px;color:#555;line-height:1.5">${notes.map(esc).join("<br>")}</p>
</div>`;

  return { subject, text, html };
}

/** Changes whenever a card is added, removed or given a new picture. */
export function approvalSignature(cards: Array<{ id: string; url?: string | null }>): string {
  const flat = cards.map((c) => `${c.id}:${c.url ?? ""}`).sort().join("|");
  return createHash("sha256").update(flat).digest("hex").slice(0, 32);
}

const REPORT_TO = process.env.REPORT_EMAIL || process.env.ALERT_EMAIL || process.env.ADMIN_EMAIL || "katy@flipwhizz.co.uk";
const REPORT_FROM = "FlipWhizz Reports <alerts@flipwhizz.com>";
const SITE = (process.env.NEXT_PUBLIC_BASE_URL || "https://flipwhizz.com").replace(/\/+$/, "");

/** Email the report for one book. Never throws. Returns whether an email went out. */
export async function sendCardsApprovedReport(storyId: string, kind: CardsReportKind): Promise<boolean> {
  try {
    if (!process.env.RESEND_API_KEY) {
      console.warn("[cards-report] RESEND_API_KEY missing, report not sent");
      return false;
    }
    const [{ db }, schema, { eq, and, inArray }] = await Promise.all([
      import("@/db"),
      import("@/db/schema"),
      import("drizzle-orm"),
    ]);
    const { aiUsage, aiUsageReports, stories, projects, users, characters, storyCharacters, locations, storyLocations } = schema;

    const story = await db
      .select({ title: stories.title, ownerEmail: users.email })
      .from(stories)
      .leftJoin(projects, eq(stories.projectId, projects.id))
      .leftJoin(users, eq(projects.userId, users.id))
      .where(eq(stories.id, storyId))
      .limit(1)
      .then((r) => r[0]);
    if (!story) return false;

    const names =
      kind === "characters"
        ? await db
            .select({ id: characters.id, name: characters.name, url: characters.portraitImageUrl })
            .from(storyCharacters)
            .innerJoin(characters, eq(storyCharacters.characterId, characters.id))
            .where(eq(storyCharacters.storyId, storyId))
        : await db
            .select({ id: locations.id, name: locations.name, url: locations.portraitImageUrl })
            .from(storyLocations)
            .innerJoin(locations, eq(storyLocations.locationId, locations.id))
            .where(eq(storyLocations.storyId, storyId));

    // Once per set of approved pictures. The unique index makes this safe when
    // two approval calls land together. If the table is missing, send anyway.
    try {
      const claimed = await db
        .insert(aiUsageReports)
        .values({ storyId, kind, signature: approvalSignature(names) })
        .onConflictDoNothing()
        .returning({ id: aiUsageReports.id });
      if (claimed.length === 0) return false;
    } catch (err) {
      console.warn("[cards-report] could not record the report, sending anyway:", String((err as any)?.message ?? err).slice(0, 200));
    }

    // If the table is not there yet, still send the report (with zeros and a note).
    let rows: UsageRow[] = [];
    try {
      rows = await db
        .select({
          kind: aiUsage.kind,
          entityId: aiUsage.entityId,
          model: aiUsage.model,
          image: aiUsage.image,
          ok: aiUsage.ok,
          imagesOut: aiUsage.imagesOut,
          promptTokens: aiUsage.promptTokens,
          outputTokens: aiUsage.outputTokens,
          thoughtTokens: aiUsage.thoughtTokens,
          totalTokens: aiUsage.totalTokens,
          costMicroUsd: aiUsage.costMicroUsd,
        })
        .from(aiUsage)
        .where(and(eq(aiUsage.storyId, storyId), inArray(aiUsage.kind, KINDS[kind].all)));
    } catch (err) {
      console.warn("[cards-report] could not read ai_usage:", String((err as any)?.message ?? err).slice(0, 200));
    }

    const report = buildCardsReport(kind, rows, names);
    const mail = renderCardsReport({ kind, storyTitle: story.title, storyId, ownerEmail: story.ownerEmail ?? null, report, site: SITE });

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
      body: JSON.stringify({ from: REPORT_FROM, to: REPORT_TO, subject: mail.subject, text: mail.text, html: mail.html }),
    });
    if (!res.ok) {
      console.error("[cards-report] Resend refused the report:", res.status, (await res.text()).slice(0, 300));
      return false;
    }
    return true;
  } catch (err) {
    console.error("[cards-report] failed:", err);
    return false;
  }
}
