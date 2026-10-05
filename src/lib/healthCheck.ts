// src/lib/healthCheck.ts
//
// Finds anything stuck where the SYSTEM should be doing work (not users who
// have simply paused). Used by the daily Inngest digest and by /admin/health.

import { db } from "@/db";
import { sql } from "drizzle-orm";
import { captureServerEvent } from "@/lib/posthog-server";

export type Severity = "critical" | "error" | "warning";

export interface HealthRow {
  summary: string;
  detail?: string;
  userEmail?: string | null;
  link?: string;
  ageHours?: number;
}

export interface HealthSection {
  key: string;
  label: string;
  explain: string;
  severity: Severity;
  rows: HealthRow[];
  error?: string; // if the query itself failed
}

export interface HealthReport {
  generatedAt: string;
  total: number;
  sections: HealthSection[];
}

const SITE = (process.env.NEXT_PUBLIC_BASE_URL || "https://flipwhizz.com").replace(/\/+$/, "");

// Phrases the chat AI uses when it thinks writing has started.
const PROMISE_REGEX =
  "(i['’]m on it|i am on it|writing (the |your )?(first )?draft|give me a moment|being (written|generated)|in the pipeline|start(ing)? writing)";

type Row = Record<string, unknown>;

async function rows(query: ReturnType<typeof sql>): Promise<Row[]> {
  const res = (await db.execute(query)) as unknown;
  if (Array.isArray(res)) return res as Row[];
  return ((res as { rows?: Row[] })?.rows ?? []) as Row[];
}

const hoursSince = (v: unknown) => {
  const t = v ? new Date(v as string).getTime() : NaN;
  return Number.isFinite(t) ? Math.round((Date.now() - t) / 36e5) : undefined;
};
const s = (v: unknown) => (v == null ? "" : String(v));

async function section(
  meta: Omit<HealthSection, "rows" | "error">,
  run: () => Promise<HealthRow[]>,
): Promise<HealthSection> {
  try {
    return { ...meta, rows: await run() };
  } catch (err) {
    console.error(`[healthCheck] ${meta.key} query failed:`, err);
    return { ...meta, rows: [], error: err instanceof Error ? err.message : String(err) };
  }
}

export async function runHealthCheck(): Promise<HealthReport> {
  const sections = await Promise.all([
    section(
      {
        key: "chat_promised_no_story",
        label: "Chat promised a story that never got created",
        explain: "The AI told the user it was writing, but no story exists. This is the Enkida bug.",
        severity: "critical",
      },
      async () =>
        (
          await rows(sql`
            WITH last_assistant AS (
              SELECT DISTINCT ON (cs.project_id)
                cs.project_id, cm.content, cm.created_at
              FROM chat_sessions cs
              JOIN chat_messages cm ON cm.session_id = cs.id
              WHERE cm.role = 'assistant'
              ORDER BY cs.project_id, cm.created_at DESC
            )
            SELECT p.id AS project_id, u.email, la.created_at, left(la.content, 120) AS snippet
            FROM last_assistant la
            JOIN projects p ON p.id = la.project_id
            LEFT JOIN users u ON u.id = p.user_id
            WHERE NOT EXISTS (SELECT 1 FROM stories s WHERE s.project_id = p.id)
              AND la.content ~* ${PROMISE_REGEX}
              AND la.created_at < now() - interval '15 minutes'
              AND la.created_at > now() - interval '30 days'
            ORDER BY la.created_at DESC
            LIMIT 50
          `)
        ).map((r) => ({
          summary: `Project ${s(r.project_id).slice(0, 8)}: AI said "${s(r.snippet).replace(/\s+/g, " ")}"`,
          userEmail: s(r.email) || null,
          link: `${SITE}/chat?project=${s(r.project_id)}`,
          ageHours: hoursSince(r.created_at),
        })),
    ),

    section(
      {
        key: "pipeline_stuck",
        label: "Stories stuck mid-generation",
        explain: "Status says the pipeline is working, but nothing has changed for over an hour.",
        severity: "critical",
      },
      async () =>
        (
          await rows(sql`
            SELECT s.id, s.title, s.status, u.email,
                   GREATEST(s.updated_at, COALESCE(w.updated_at, s.updated_at)) AS last_change,
                   w.characters_extracted, w.locations_extracted, w.spreads_built,
                   w.prompts_built, w.world_complete
            FROM stories s
            JOIN projects p ON p.id = s.project_id
            LEFT JOIN users u ON u.id = p.user_id
            LEFT JOIN story_workflow_progress w ON w.story_id = s.id
            WHERE s.status IN ('generating', 'generating_covers', 'extracting', 'queued', 'processing')
              AND GREATEST(s.updated_at, COALESCE(w.updated_at, s.updated_at)) < now() - interval '1 hour'
              AND s.updated_at > now() - interval '30 days'
            ORDER BY last_change DESC
            LIMIT 50
          `)
        ).map((r) => {
          const flags = [
            ["chars", r.characters_extracted],
            ["locs", r.locations_extracted],
            ["spreads", r.spreads_built],
            ["prompts", r.prompts_built],
            ["world", r.world_complete],
          ]
            .map(([k, v]) => `${k}:${v === true ? "✓" : v === false ? "✗" : "-"}`)
            .join(" ");
          return {
            summary: `"${s(r.title)}" stuck in ${s(r.status)}`,
            detail: flags,
            userEmail: s(r.email) || null,
            link: `${SITE}/stories/${s(r.id)}/pages`,
            ageHours: hoursSince(r.last_change),
          };
        }),
    ),

    section(
      {
        key: "stories_failed",
        label: "Stories in a failed state",
        explain: "Generation failed and the story is waiting for someone to retry it.",
        severity: "error",
      },
      async () =>
        (
          await rows(sql`
            SELECT s.id, s.title, s.status, s.updated_at, u.email
            FROM stories s
            JOIN projects p ON p.id = s.project_id
            LEFT JOIN users u ON u.id = p.user_id
            WHERE s.status IN ('cover_failed', 'error', 'failed')
              AND s.updated_at > now() - interval '30 days'
            ORDER BY s.updated_at DESC
            LIMIT 50
          `)
        ).map((r) => ({
          summary: `"${s(r.title)}" is ${s(r.status)}`,
          userEmail: s(r.email) || null,
          link: `${SITE}/stories/${s(r.id)}/pages`,
          ageHours: hoursSince(r.updated_at),
        })),
    ),

    section(
      {
        key: "paid_no_pdf",
        label: "Paid books with no PDF",
        explain: "Payment went through over 2 hours ago but there is still no PDF.",
        severity: "critical",
      },
      async () =>
        (
          await rows(sql`
            SELECT s.id, s.title, s.updated_at, u.email
            FROM stories s
            JOIN projects p ON p.id = s.project_id
            LEFT JOIN users u ON u.id = p.user_id
            WHERE s.payment_status = 'paid'
              AND s.pdf_url IS NULL
              AND s.updated_at < now() - interval '2 hours'
              AND s.updated_at > now() - interval '60 days'
            ORDER BY s.updated_at DESC
            LIMIT 50
          `)
        ).map((r) => ({
          summary: `"${s(r.title)}" paid, no PDF`,
          userEmail: s(r.email) || null,
          link: `${SITE}/stories/${s(r.id)}/pages`,
          ageHours: hoursSince(r.updated_at),
        })),
    ),

    section(
      {
        key: "orders_need_action",
        label: "Print orders that failed or need manual action",
        explain: "Orders marked failed or pending_manual. Someone has paid; these need you.",
        severity: "critical",
      },
      async () =>
        (
          await rows(sql`
            SELECT o.id, o.status, o.gelato_status, o.updated_at, o.story_id, s.title, u.email
            FROM orders o
            LEFT JOIN stories s ON s.id = o.story_id
            LEFT JOIN users u ON u.id = o.user_id
            WHERE o.status IN ('failed', 'pending_manual')
              AND o.created_at > now() - interval '60 days'
            ORDER BY o.updated_at DESC
            LIMIT 50
          `)
        ).map((r) => ({
          summary: `Order ${s(r.id).slice(0, 8)} for "${s(r.title)}" is ${s(r.status)}`,
          detail: r.gelato_status ? `Gelato: ${s(r.gelato_status)}` : undefined,
          userEmail: s(r.email) || null,
          link: r.story_id ? `${SITE}/stories/${s(r.story_id)}/print` : undefined,
          ageHours: hoursSince(r.updated_at),
        })),
    ),

    section(
      {
        key: "orders_not_sent",
        label: "Paid orders not sent to Gelato",
        explain: "Paid over 2 hours ago but there is no Gelato order ID.",
        severity: "critical",
      },
      async () =>
        (
          await rows(sql`
            SELECT o.id, o.status, o.created_at, o.story_id, s.title, u.email
            FROM orders o
            LEFT JOIN stories s ON s.id = o.story_id
            LEFT JOIN users u ON u.id = o.user_id
            WHERE o.payment_status = 'paid'
              AND o.gelato_order_id IS NULL
              AND o.shipping_address IS NOT NULL
              AND o.status NOT IN ('failed', 'pending_manual', 'canceled', 'cancelled')
              AND o.created_at < now() - interval '2 hours'
              AND o.created_at > now() - interval '60 days'
            ORDER BY o.created_at DESC
            LIMIT 50
          `)
        ).map((r) => ({
          summary: `Order ${s(r.id).slice(0, 8)} for "${s(r.title)}" (${s(r.status)}) not at Gelato`,
          userEmail: s(r.email) || null,
          link: r.story_id ? `${SITE}/stories/${s(r.story_id)}/print` : undefined,
          ageHours: hoursSince(r.created_at),
        })),
    ),

    section(
      {
        key: "print_stale",
        label: "Print orders with no Gelato update for 5+ days",
        explain: "At Gelato, but not shipped or delivered and no webhook update for 5 days.",
        severity: "error",
      },
      async () =>
        (
          await rows(sql`
            SELECT o.id, o.gelato_order_id, o.gelato_status,
                   COALESCE(o.gelato_updated_at, o.updated_at) AS last_update,
                   o.story_id, s.title, u.email
            FROM orders o
            LEFT JOIN stories s ON s.id = o.story_id
            LEFT JOIN users u ON u.id = o.user_id
            WHERE o.gelato_order_id IS NOT NULL
              AND COALESCE(o.gelato_status, '') NOT IN ('delivered', 'shipped', 'in_transit', 'canceled', 'cancelled', 'returned')
              AND COALESCE(o.gelato_updated_at, o.updated_at) < now() - interval '5 days'
              AND o.created_at > now() - interval '60 days'
            ORDER BY last_update DESC
            LIMIT 50
          `)
        ).map((r) => ({
          summary: `"${s(r.title)}" at Gelato as ${s(r.gelato_status) || "unknown"}`,
          detail: `Gelato order ${s(r.gelato_order_id)}`,
          userEmail: s(r.email) || null,
          link: r.story_id ? `${SITE}/stories/${s(r.story_id)}/print` : undefined,
          ageHours: hoursSince(r.last_update),
        })),
    ),

    section(
      {
        key: "long_chat_no_story",
        label: "Long chats that never became a book",
        explain:
          "5+ messages from the user, no story, quiet for 2h to 14 days. Not always a bug, but worth a look or a nudge email.",
        severity: "warning",
      },
      async () =>
        (
          await rows(sql`
            SELECT p.id AS project_id, u.email,
                   count(*) FILTER (WHERE cm.role = 'user') AS user_msgs,
                   max(cm.created_at) AS last_msg
            FROM projects p
            JOIN chat_sessions cs ON cs.project_id = p.id
            JOIN chat_messages cm ON cm.session_id = cs.id
            LEFT JOIN users u ON u.id = p.user_id
            WHERE NOT EXISTS (SELECT 1 FROM stories s WHERE s.project_id = p.id)
            GROUP BY p.id, u.email
            HAVING count(*) FILTER (WHERE cm.role = 'user') >= 5
               AND max(cm.created_at) < now() - interval '2 hours'
               AND max(cm.created_at) > now() - interval '14 days'
            ORDER BY last_msg DESC
            LIMIT 50
          `)
        ).map((r) => ({
          summary: `Project ${s(r.project_id).slice(0, 8)}: ${s(r.user_msgs)} user messages, no book`,
          userEmail: s(r.email) || null,
          link: `${SITE}/chat?project=${s(r.project_id)}`,
          ageHours: hoursSince(r.last_msg),
        })),
    ),
  ]);

  // A chat that promised a story also counts as a long chat; show it once.
  const promised = new Set(
    sections.find((x) => x.key === "chat_promised_no_story")?.rows.map((r) => r.link) ?? [],
  );
  const longChats = sections.find((x) => x.key === "long_chat_no_story");
  if (longChats) longChats.rows = longChats.rows.filter((r) => !promised.has(r.link));

  return {
    generatedAt: new Date().toISOString(),
    total: sections.reduce((n, x) => n + x.rows.length, 0),
    sections,
  };
}

function escapeHtml(v: string) {
  return v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function renderDigestHtml(report: HealthReport): string {
  const colour = { critical: "#DC2626", error: "#EA580C", warning: "#CA8A04" } as const;
  const parts = report.sections
    .filter((sec) => sec.rows.length > 0 || sec.error)
    .map((sec) => {
      const items = sec.rows
        .map(
          (r) => `<li style="margin:0 0 8px">
            ${r.link ? `<a href="${escapeHtml(r.link)}" style="color:#7C3AED">${escapeHtml(r.summary)}</a>` : escapeHtml(r.summary)}
            <span style="color:#64748B">${r.userEmail ? ` · ${escapeHtml(r.userEmail)}` : ""}${r.ageHours != null ? ` · ${r.ageHours}h ago` : ""}</span>
            ${r.detail ? `<br><span style="color:#64748B;font-size:12px">${escapeHtml(r.detail)}</span>` : ""}
          </li>`,
        )
        .join("");
      return `<h3 style="margin:24px 0 4px;color:${colour[sec.severity]}">${escapeHtml(sec.label)} (${sec.rows.length})</h3>
        <p style="margin:0 0 8px;color:#64748B;font-size:13px">${escapeHtml(sec.explain)}</p>
        ${sec.error ? `<p style="color:#DC2626;font-size:13px">Check itself failed: ${escapeHtml(sec.error)}</p>` : ""}
        <ul style="padding-left:18px;margin:0">${items}</ul>`;
    })
    .join("");

  return `<div style="font-family:-apple-system,Segoe UI,Arial,sans-serif;font-size:14px;color:#0F172A;max-width:640px">
    <h2 style="margin:0 0 4px">FlipWhizz daily health check</h2>
    <p style="margin:0;color:#64748B">${report.total} item${report.total === 1 ? "" : "s"} need a look · <a href="${SITE}/admin/health" style="color:#7C3AED">open in admin</a></p>
    ${parts}
  </div>`;
}

export async function sendDigest(report: HealthReport, opts: { force?: boolean } = {}) {
  const hasIssues = report.sections.some((x) => x.rows.length > 0 || x.error);

  try {
    await captureServerEvent("system", "health_check_run", {
      total: report.total,
      ...Object.fromEntries(report.sections.map((x) => [x.key, x.rows.length])),
    });
  } catch {
    /* non-fatal */
  }

  // Quiet when healthy, unless forced from the admin page.
  if (!hasIssues && !opts.force) return { sent: false, reason: "healthy" };
  if (!process.env.RESEND_API_KEY) return { sent: false, reason: "no RESEND_API_KEY" };

  const critical = report.sections.filter((x) => x.severity === "critical").reduce((n, x) => n + x.rows.length, 0);
  const subject = hasIssues
    ? `${critical > 0 ? "🔴" : "🟠"} FlipWhizz health: ${report.total} item${report.total === 1 ? "" : "s"}${critical ? ` (${critical} critical)` : ""}`
    : "✅ FlipWhizz health: all clear";

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
    body: JSON.stringify({
      from: "FlipWhizz Alerts <alerts@flipwhizz.com>",
      to: process.env.ALERT_EMAIL || process.env.ADMIN_EMAIL || "katy@flipwhizz.co.uk",
      subject,
      html: renderDigestHtml(report),
    }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text().catch(() => "")}`);
  return { sent: true };
}
