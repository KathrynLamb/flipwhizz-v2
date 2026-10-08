// src/lib/alerts.ts
//
// One place every failure goes. sendAlert() logs, records a PostHog
// "system_alert" event, and emails Katy. It never throws, so it is always
// safe to call from a catch block.
//
// withAlerts() wraps an API route handler: if the handler throws or returns
// a 5xx, an alert is sent and the user gets a calm JSON error instead of a
// crash.

import { NextResponse } from "next/server";
import { captureServerEvent } from "@/lib/posthog-server";

export type AlertSeverity = "critical" | "error" | "warning";

export interface AlertInput {
  /** Where it happened, e.g. "api/stories/create-from-chat" or "inngest/build-spreads" */
  area: string;
  /** One-line summary for the email subject */
  title: string;
  error?: unknown;
  severity?: AlertSeverity;
  userId?: string | null;
  storyId?: string | null;
  projectId?: string | null;
  /** Any extra detail worth seeing in the email */
  context?: Record<string, unknown>;
}

const ALERT_TO = process.env.ALERT_EMAIL || process.env.ADMIN_EMAIL || "katy@flipwhizz.co.uk";
const ALERT_FROM = "FlipWhizz Alerts <alerts@flipwhizz.com>";
const SITE = (process.env.NEXT_PUBLIC_BASE_URL || "https://flipwhizz.com").replace(/\/+$/, "");

// Best-effort throttle so one broken thing doesn't send 200 emails.
// Per server instance, so it's approximate, which is fine.
const THROTTLE_MS = 10 * 60 * 1000;
const lastSent = new Map<string, number>();

function errorDetails(error: unknown): { message: string; stack?: string } {
  if (!error) return { message: "" };
  if (error instanceof Error) return { message: error.message, stack: error.stack };
  if (typeof error === "string") return { message: error };
  try {
    return { message: JSON.stringify(error).slice(0, 2000) };
  } catch {
    return { message: String(error) };
  }
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function sendAlert(input: AlertInput): Promise<void> {
  const severity = input.severity ?? "error";
  const { message, stack } = errorDetails(input.error);

  try {
    console.error(`🚨 [alert:${severity}] ${input.area}: ${input.title}`, message, input.context ?? "");
  } catch {
    /* ignore */
  }

  // PostHog: every alert, no throttle, so you can chart them.
  try {
    await captureServerEvent(input.userId || "system", "system_alert", {
      area: input.area,
      title: input.title,
      severity,
      error_message: message.slice(0, 1000),
      story_id: input.storyId ?? null,
      project_id: input.projectId ?? null,
      ...(input.context ?? {}),
    });
  } catch (err) {
    console.error("[alerts] PostHog capture failed:", err);
  }

  // Email: throttled per area+title.
  const key = `${input.area}::${input.title}`;
  const now = Date.now();
  const prev = lastSent.get(key);
  if (prev && now - prev < THROTTLE_MS) return;
  lastSent.set(key, now);

  if (!process.env.RESEND_API_KEY) {
    console.error("[alerts] RESEND_API_KEY missing, alert email not sent");
    return;
  }

  const links: string[] = [];
  if (input.userId) links.push(`Customer: ${SITE}/admin/customers/${input.userId}`);
  if (input.storyId) links.push(`Book (admin): ${SITE}/admin/books/${input.storyId}`);
  if (input.projectId) links.push(`Project chat: ${SITE}/chat?project=${input.projectId}`);

  const lines = [
    `Severity: ${severity}`,
    `Area: ${input.area}`,
    `When: ${new Date().toISOString()}`,
    input.userId ? `User ID: ${input.userId}` : null,
    input.storyId ? `Story ID: ${input.storyId}` : null,
    input.projectId ? `Project ID: ${input.projectId}` : null,
    "",
    message ? `Error: ${message}` : null,
    input.context ? `\nContext:\n${JSON.stringify(input.context, null, 2).slice(0, 4000)}` : null,
    links.length ? `\nLinks:\n${links.join("\n")}` : null,
    stack ? `\nStack:\n${stack.slice(0, 3000)}` : null,
  ].filter((l) => l !== null) as string[];

  const text = lines.join("\n");
  const icon = severity === "critical" ? "🔴" : severity === "error" ? "🟠" : "🟡";

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: ALERT_FROM,
        to: ALERT_TO,
        subject: `${icon} ${input.title} (${input.area})`.slice(0, 200),
        text,
        html: `<pre style="font-family:ui-monospace,Menlo,monospace;font-size:13px;white-space:pre-wrap">${escapeHtml(text)}</pre>`,
      }),
    });
    if (!res.ok) {
      console.error("[alerts] Resend rejected alert email:", res.status, await res.text().catch(() => ""));
    }
  } catch (err) {
    console.error("[alerts] Failed to send alert email:", err);
  }
}

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

async function extractIds(
  path: string | undefined,
  reqClone: Request | null,
): Promise<{ userId?: string; storyId?: string; projectId?: string }> {
  const out: { userId?: string; storyId?: string; projectId?: string } = {};
  const storyMatch = path?.match(/\/stories\/([0-9a-f-]{36})/i);
  if (storyMatch) out.storyId = storyMatch[1];
  if (reqClone) {
    try {
      const body = (await reqClone.json()) as Record<string, unknown>;
      for (const [k, field] of [
        ["projectId", "projectId"],
        ["storyId", "storyId"],
        ["userId", "userId"],
      ] as const) {
        const v = body?.[k];
        if (typeof v === "string" && UUID_RE.test(v)) out[field] = v;
      }
    } catch {
      /* not json, fine */
    }
  }
  return out;
}

const FRIENDLY_ERROR =
  "Something went wrong on our side. We've been notified and will look into it.";

/**
 * Wrap a route handler so failures alert you and degrade gracefully.
 *
 *   async function _POST(req: Request) { ... }
 *   export const POST = withAlerts("api/chat", _POST);
 */
export function withAlerts<A extends unknown[]>(
  area: string,
  handler: (...args: A) => Promise<Response>,
  opts: { severity?: AlertSeverity } = {},
) {
  return async (...args: A): Promise<Response> => {
    const req = args[0] as Request | undefined;
    const path = (() => {
      try {
        return req?.url ? new URL(req.url).pathname : undefined;
      } catch {
        return undefined;
      }
    })();

    // Clone before the handler consumes the body, so on failure we can pull
    // projectId/storyId/userId out of it for the alert links.
    let reqClone: Request | null = null;
    try {
      if (req && typeof req.clone === "function" && req.method !== "GET") reqClone = req.clone();
    } catch {
      reqClone = null;
    }
    const ids = async () => extractIds(path, reqClone);

    try {
      const res = await handler(...args);
      if (res.status >= 500) {
        let body = "";
        try {
          body = (await res.clone().text()).slice(0, 2000);
        } catch {
          /* ignore */
        }
        let parsed: Record<string, unknown> | null = null;
        try {
          parsed = JSON.parse(body);
        } catch {
          /* not json */
        }
        await sendAlert({
          ...(await ids()),
          area,
          title: `${res.status} from ${area}`,
          severity: opts.severity,
          error: (parsed?.error as string) || body || `HTTP ${res.status}`,
          context: { path, status: res.status, response: parsed ?? body },
        });
      }
      return res;
    } catch (err) {
      await sendAlert({
        ...(await ids()),
        area,
        title: `Unhandled error in ${area}`,
        severity: opts.severity ?? "critical",
        error: err,
        context: { path },
      });
      return NextResponse.json({ error: FRIENDLY_ERROR }, { status: 500 });
    }
  };
}
