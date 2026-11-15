// src/lib/emails/sendSpreadsReport.ts
//
// The "book drawn" report. Sent to Katy once per full-book draw (generate,
// admin Redraw all, Draw missing), when the last spread of that run has
// been saved or given up. Single-spread redraws do not send one.
//
// For each spread: how it was drawn (one-pass or staged), the result, and
// what the run cost: pictures, person repairs, text steps, checks, failed
// calls, tokens, time and estimated cost, read from ai_usage (kind "spread",
// src/lib/geminiUsage.ts). Only calls made since the run started count.
//
// buildSpreadsReport() is pure (rows in, numbers out) so it can be tested.
// maybeSendSpreadsReport() never throws, and sends once per run: the
// ai_usage_reports unique index stops two last spreads finishing together
// from sending two emails.

import { formatGbp, formatUsd } from "@/lib/ai/pricing";

export type SpreadRow = {
  id: string;
  index: number;
  pages: string;
  qa: any;
};

export type SpreadUsageRow = {
  entityId: string | null;
  label: string | null;
  image: boolean;
  ok: boolean;
  imagesOut: number;
  totalTokens: number | null;
  costMicroUsd: number | null;
  ms: number | null;
};

export type SpreadLine = {
  index: number;
  pages: string;
  mode: string;
  model: string;
  status: string;
  pictures: number;
  personRepairs: number;
  textSteps: number;
  checks: number;
  failedCalls: number;
  tokens: number;
  costMicroUsd: number;
  ms: number;
  problems: string[];
};

export type SpreadsReport = {
  lines: SpreadLine[];
  total: Omit<SpreadLine, "index" | "pages" | "mode" | "model" | "status" | "problems">;
  modes: Record<string, number>;
  statuses: Record<string, number>;
};

const STATUS_WORDS: Record<string, string> = {
  ok: "checked",
  fixed: "fixed",
  flagged: "needs attention",
  unchecked: "check failed",
  failed: "failed to draw",
};

/** Did this spread finish (saved or gave up) in the run that started at bookRun? */
export function settledInRun(qa: any, bookRun: number): boolean {
  const latest = Number(qa?.latestRun ?? 0);
  const saved = Number(qa?.savedRun ?? 0);
  const failed = Number(qa?.failedRun ?? 0);
  const done = Math.max(saved, failed);
  return done >= bookRun && latest <= done;
}

export function buildSpreadsReport(spreads: SpreadRow[], rows: SpreadUsageRow[], bookRun: number): SpreadsReport {
  const lines: SpreadLine[] = [];
  for (const s of [...spreads].sort((a, b) => a.index - b.index)) {
    const qa = s.qa ?? {};
    if (!settledInRun(qa, bookRun)) continue;
    const failed = Number(qa.failedRun ?? 0) > Number(qa.savedRun ?? 0);
    const mine = rows.filter((r) => r.entityId === s.id);
    const label = (r: SpreadUsageRow) => r.label ?? "";
    const line: SpreadLine = {
      index: s.index,
      pages: s.pages,
      mode: failed ? "-" : qa.mode === "onepass" ? "one-pass" : "staged",
      model: failed ? "-" : String(qa.model ?? "-"),
      status: failed ? "failed" : String(qa.status ?? "unchecked"),
      pictures: 0,
      personRepairs: 0,
      textSteps: 0,
      checks: 0,
      failedCalls: 0,
      tokens: 0,
      costMicroUsd: 0,
      ms: 0,
      problems: failed
        ? ["the drawing job failed after its retries"]
        : [
            ...(Array.isArray(qa.remaining) ? qa.remaining : []),
            ...(Array.isArray(qa.text?.problems) && qa.text?.ok === false ? qa.text.problems : []),
          ].map(String),
    };
    for (const r of mine) {
      if (!r.ok) line.failedCalls += 1;
      else if (r.image) {
        line.pictures += r.imagesOut;
        if (label(r).startsWith("fix-") || label(r) === "add-missing") line.personRepairs += 1;
        if (label(r) === "letter" || label(r) === "text-repair") line.textSteps += 1;
      } else line.checks += 1;
      line.tokens += r.totalTokens ?? 0;
      line.costMicroUsd += r.costMicroUsd ?? 0;
      line.ms += r.ms ?? 0;
    }
    lines.push(line);
  }

  const total = { pictures: 0, personRepairs: 0, textSteps: 0, checks: 0, failedCalls: 0, tokens: 0, costMicroUsd: 0, ms: 0 };
  const modes: Record<string, number> = {};
  const statuses: Record<string, number> = {};
  for (const l of lines) {
    total.pictures += l.pictures;
    total.personRepairs += l.personRepairs;
    total.textSteps += l.textSteps;
    total.checks += l.checks;
    total.failedCalls += l.failedCalls;
    total.tokens += l.tokens;
    total.costMicroUsd += l.costMicroUsd;
    total.ms += l.ms;
    modes[l.mode] = (modes[l.mode] ?? 0) + 1;
    statuses[l.status] = (statuses[l.status] ?? 0) + 1;
  }
  return { lines, total, modes, statuses };
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const num = (n: number) => n.toLocaleString("en-GB");
const cost = (micro: number) => `${formatGbp(micro)} (${formatUsd(micro)})`;
const secs = (ms: number) => (ms >= 60_000 ? `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s` : `${Math.round(ms / 1000)}s`);

export function renderSpreadsReport(args: {
  storyTitle: string;
  storyId: string;
  ownerEmail: string | null;
  report: SpreadsReport;
  bookTotalMicroUsd: number | null;
  site: string;
}): { subject: string; text: string; html: string } {
  const { report } = args;
  const { lines, total } = report;
  const n = lines.length;
  const good = (report.statuses.ok ?? 0) + (report.statuses.fixed ?? 0);
  const bad = n - good;
  const perSpread = n ? Math.round(total.costMicroUsd / n) : 0;
  const subject = `Book drawn: "${args.storyTitle}" · ${n} spread${n === 1 ? "" : "s"}, ${good} passed, ${bad} need attention · ${formatGbp(total.costMicroUsd)}`;

  const modeLine = [
    ...Object.entries(report.modes).filter(([m]) => m !== "-").map(([m, c]) => `${c} ${m}`),
    ...(report.statuses.failed ? [`${report.statuses.failed} failed to draw`] : []),
  ].join(", ");
  const head = [
    `Book: ${args.storyTitle}`,
    args.ownerEmail ? `Customer: ${args.ownerEmail}` : null,
    `Admin: ${args.site}/admin/books/${args.storyId}?tab=pages`,
    `Drawn: ${modeLine || "nothing"}`,
    `This run: ${cost(total.costMicroUsd)}, ${perSpread ? `${formatGbp(perSpread)} a spread, ` : ""}${num(total.pictures)} pictures, ${num(total.personRepairs)} person repairs, ${num(total.textSteps)} text steps, ${num(total.failedCalls)} failed calls`,
    args.bookTotalMicroUsd != null ? `Whole book so far (cards and every spread run): ${cost(args.bookTotalMicroUsd)}` : null,
  ].filter(Boolean) as string[];

  const flagged = lines.filter((l) => l.problems.length && l.status !== "ok" && l.status !== "fixed");
  const notes = [
    "Costs are estimates from Google's list prices, not the bill. Time is the sum of model calls, not wall-clock time.",
    "Reference sheets and the style plate made before drawing are not included.",
  ];

  const cols = ["Spread", "Pages", "Mode", "Result", "Pictures", "Person repairs", "Text steps", "Checks", "Failed calls", "Tokens", "Time", "Cost"];
  const row = (l: SpreadLine) => [
    String(l.index), l.pages, l.mode, STATUS_WORDS[l.status] ?? l.status, num(l.pictures), num(l.personRepairs), num(l.textSteps),
    num(l.checks), num(l.failedCalls), num(l.tokens), secs(l.ms), cost(l.costMicroUsd),
  ];
  const totalRow = ["Total", "", "", `${good} passed`, num(total.pictures), num(total.personRepairs), num(total.textSteps), num(total.checks), num(total.failedCalls), num(total.tokens), secs(total.ms), cost(total.costMicroUsd)];

  const text = [
    "Book drawn",
    ...head,
    "",
    ...lines.map((l) => `Spread ${l.index} (${l.pages}), ${l.mode}, ${STATUS_WORDS[l.status] ?? l.status}: ${l.pictures} pictures, ${l.personRepairs} person repairs, ${l.textSteps} text steps, ${l.failedCalls} failed, ${num(l.tokens)} tokens, ${secs(l.ms)}, ${cost(l.costMicroUsd)}`),
    "",
    `TOTAL: ${good} of ${n} passed, ${cost(total.costMicroUsd)}`,
    ...(flagged.length ? ["", "Needs attention:", ...flagged.map((l) => `Spread ${l.index}: ${l.problems.join(" | ")}`)] : []),
    "",
    ...notes,
  ].join("\n");

  const td = "padding:5px 8px;border-bottom:1px solid #e5e5e5;text-align:right;font-size:12px;white-space:nowrap";
  const tone = (s: string) => (s === "ok" || s === "fixed" ? "#15803d" : "#b91c1c");
  const html = `<div style="font-family:system-ui,-apple-system,sans-serif;color:#111;max-width:980px">
<h2 style="margin:0 0 8px">Book drawn</h2>
<p style="margin:0 0 14px;font-size:14px;line-height:1.6">${head.map(esc).join("<br>")}</p>
<table style="border-collapse:collapse;width:100%">
<tr>${cols.map((c, i) => `<th style="${td};text-align:${i < 4 ? "left" : "right"};border-bottom:2px solid #111;white-space:normal">${c}</th>`).join("")}</tr>
${lines.map((l) => `<tr>${row(l).map((c, i) => `<td style="${td};text-align:${i < 4 ? "left" : "right"}${i === 3 ? `;color:${tone(l.status)}` : ""}">${esc(c)}</td>`).join("")}</tr>`).join("\n")}
<tr>${totalRow.map((c, i) => `<td style="${td};text-align:${i < 4 ? "left" : "right"};font-weight:700">${esc(c)}</td>`).join("")}</tr>
</table>
${flagged.length ? `<h3 style="margin:18px 0 6px;font-size:14px">Needs attention</h3><ul style="margin:0;padding-left:18px;font-size:13px;line-height:1.6">${flagged.map((l) => `<li><b>Spread ${l.index}:</b> ${esc(l.problems.join(" | "))}</li>`).join("")}</ul>` : ""}
<p style="margin:14px 0 0;font-size:12px;color:#555;line-height:1.5">${notes.map(esc).join("<br>")}</p>
</div>`;

  return { subject, text, html };
}

const REPORT_TO = process.env.REPORT_EMAIL || process.env.ALERT_EMAIL || process.env.ADMIN_EMAIL || "katy@flipwhizz.co.uk";
const REPORT_FROM = "FlipWhizz Reports <alerts@flipwhizz.com>";
const SITE = (process.env.NEXT_PUBLIC_BASE_URL || "https://flipwhizz.com").replace(/\/+$/, "");

/**
 * Called by each spread worker when it finishes (saved or gave up). Sends
 * the report only when every spread in the run has finished, and only once
 * per run. Never throws. Returns whether an email went out.
 */
export async function maybeSendSpreadsReport(storyId: string, bookRun: number | undefined, bookRunSize: number | undefined): Promise<boolean> {
  try {
    if (!bookRun || !bookRunSize) return false;
    const [{ db }, schema, { eq, and, gte, inArray, sum }] = await Promise.all([
      import("@/db"),
      import("@/db/schema"),
      import("drizzle-orm"),
    ]);
    const { aiUsage, aiUsageReports, stories, projects, users, storySpreads, storyPages } = schema;

    const spreadRows = await db
      .select({ id: storySpreads.id, index: storySpreads.spreadIndex, leftPageId: storySpreads.leftPageId, qa: storySpreads.qa })
      .from(storySpreads)
      .where(eq(storySpreads.storyId, storyId));
    const settled = spreadRows.filter((s) => settledInRun(s.qa, bookRun));
    if (settled.length < bookRunSize) return false;

    if (!process.env.RESEND_API_KEY) {
      console.warn("[spreads-report] RESEND_API_KEY missing, report not sent");
      return false;
    }

    // Once per run, even when the last two spreads finish together.
    try {
      const claimed = await db
        .insert(aiUsageReports)
        .values({ storyId, kind: "spreads", signature: String(bookRun) })
        .onConflictDoNothing()
        .returning({ id: aiUsageReports.id });
      if (claimed.length === 0) return false;
    } catch (err) {
      // Without the table there is no way to send only once, so send nothing.
      console.warn("[spreads-report] ai_usage_reports unavailable, not sending:", String((err as any)?.message ?? err).slice(0, 200));
      return false;
    }

    const story = await db
      .select({ title: stories.title, ownerEmail: users.email })
      .from(stories)
      .leftJoin(projects, eq(stories.projectId, projects.id))
      .leftJoin(users, eq(projects.userId, users.id))
      .where(eq(stories.id, storyId))
      .limit(1)
      .then((r) => r[0]);
    if (!story) return false;

    const pageIds = spreadRows.map((s) => s.leftPageId).filter((x): x is string => !!x);
    const pageNos = pageIds.length
      ? await db.select({ id: storyPages.id, n: storyPages.pageNumber }).from(storyPages).where(inArray(storyPages.id, pageIds))
      : [];
    const pageNo = new Map(pageNos.map((p) => [p.id, p.n]));
    const spreads: SpreadRow[] = spreadRows.map((s) => {
      const left = s.leftPageId ? pageNo.get(s.leftPageId) : undefined;
      return { id: s.id, index: Number(s.index), pages: left != null ? `${left}-${left + 1}` : "", qa: s.qa };
    });

    let rows: SpreadUsageRow[] = [];
    let bookTotal: number | null = null;
    try {
      rows = await db
        .select({
          entityId: aiUsage.entityId,
          label: aiUsage.label,
          image: aiUsage.image,
          ok: aiUsage.ok,
          imagesOut: aiUsage.imagesOut,
          totalTokens: aiUsage.totalTokens,
          costMicroUsd: aiUsage.costMicroUsd,
          ms: aiUsage.ms,
        })
        .from(aiUsage)
        .where(and(eq(aiUsage.storyId, storyId), eq(aiUsage.kind, "spread"), gte(aiUsage.createdAt, new Date(bookRun))));
      const [t] = await db.select({ s: sum(aiUsage.costMicroUsd) }).from(aiUsage).where(eq(aiUsage.storyId, storyId));
      bookTotal = t?.s != null ? Number(t.s) : null;
    } catch (err) {
      console.warn("[spreads-report] could not read ai_usage:", String((err as any)?.message ?? err).slice(0, 200));
    }

    const report = buildSpreadsReport(spreads, rows, bookRun);
    const mail = renderSpreadsReport({ storyTitle: story.title, storyId, ownerEmail: story.ownerEmail ?? null, report, bookTotalMicroUsd: bookTotal, site: SITE });

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
      body: JSON.stringify({ from: REPORT_FROM, to: REPORT_TO, subject: mail.subject, text: mail.text, html: mail.html }),
    });
    if (!res.ok) {
      console.error("[spreads-report] Resend refused the report:", res.status, (await res.text()).slice(0, 300));
      return false;
    }
    return true;
  } catch (err) {
    console.error("[spreads-report] failed:", err);
    return false;
  }
}
