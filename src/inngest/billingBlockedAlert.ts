// src/inngest/billingBlockedAlert.ts
//
// When Gemini stops taking requests for account reasons (monthly spending
// cap, credits gone, billing off) or hits its quota, every job fails at once.
// sendAlert() turns each of those failures into a "system/billing-blocked"
// event. This function sends ONE email per hour for the whole outage, across
// every server, and lists the books that were mid-generation so you know
// what to re-run once it's fixed.

import { inngest } from "./client";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { emailAlert, BILLING_BLOCKED_EVENT } from "@/lib/alerts";

const SITE = (process.env.NEXT_PUBLIC_BASE_URL || "https://flipwhizz.com").replace(/\/+$/, "");

type Row = Record<string, unknown>;

async function booksMidGeneration(): Promise<string[]> {
  try {
    const res = (await db.execute(sql`
      SELECT s.id, s.title, s.status, s.payment_status, u.email
      FROM stories s
      JOIN projects p ON p.id = s.project_id
      LEFT JOIN users u ON u.id = p.user_id
      WHERE s.status IN ('generating', 'generating_covers', 'extracting', 'queued', 'processing')
        AND s.updated_at > now() - interval '48 hours'
      ORDER BY (s.payment_status = 'paid') DESC, s.updated_at DESC
      LIMIT 25
    `)) as unknown;
    const rows = (Array.isArray(res) ? res : ((res as { rows?: Row[] })?.rows ?? [])) as Row[];
    return rows.map((r) => {
      const paid = r.payment_status === "paid" ? " [PAID]" : "";
      return `- "${String(r.title ?? "Untitled")}"${paid} (${String(r.status)}) ${String(r.email ?? "")}\n  ${SITE}/admin/books/${String(r.id)}`;
    });
  } catch (err) {
    console.error("[billingBlockedAlert] could not list books:", err);
    return [];
  }
}

export const billingBlockedAlert = inngest.createFunction(
  {
    id: "billing-blocked-alert",
    // One email per hour for the whole outage, however many jobs fail.
    // Events over the limit are dropped, which is what we want.
    rateLimit: { limit: 1, period: "1h" },
    retries: 1,
    triggers: [{ event: BILLING_BLOCKED_EVENT }],
  },
  async ({ event, step }) => {
    const data = (event.data ?? {}) as {
      area?: string;
      title?: string;
      error?: string;
      storyId?: string | null;
      userId?: string | null;
    };

    const books = await step.run("list-books", booksMidGeneration);

    await step.run("email", async () => {
      const text = [
        data.error || "Gemini billing or quota error",
        "",
        "What to do:",
        "1. Check https://ai.studio/spend: raise the monthly spend cap or top up.",
        "2. Re-run the books below from admin once it's fixed.",
        "3. Email any PAID customers whose book was held up.",
        "",
        "Books mid-generation (last 48h):",
        ...(books.length ? books : ["(none found)"]),
        "",
        "You'll get at most one of these per hour while it's still failing.",
      ].join("\n");
      await emailAlert({
        area: "system/gemini-billing",
        title: "BILLING/QUOTA BLOCKED: image generation is stopped for everyone",
        severity: "critical",
        error: text,
        storyId: data.storyId ?? null,
        userId: data.userId ?? null,
        context: { first_failure_area: data.area ?? null, first_failure_title: data.title ?? null },
      });
    });

    return { emailed: true, books: books.length };
  },
);
