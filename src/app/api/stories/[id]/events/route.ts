// src/app/api/stories/[id]/events/route.ts
//
// The few steps only the browser can see (the paywall appearing, the
// customer choosing a format and heading to checkout, PayPal being closed
// without paying). Records a book event
// for the owner's book. Only these kinds are accepted from the client, and
// each is recorded once per book (checkout once per product), so a reload
// or a curious visitor can't flood the timeline or Katy's inbox.

import { NextResponse } from "next/server";
import { withAccess, getAuthUser } from "@/lib/authz";
import { recordBookEventSoon } from "@/lib/events/bookEvents";
import { browserSummary } from "@/lib/paypalErrors";

const ALLOWED = {
  paywall_reached: "Saw the paywall after their free page",
  checkout_started: "Chose a format and went to checkout",
  // PayPal's window was closed before paying. On a phone this is also what a
  // blank or frozen PayPal window looks like from our side, so we keep the
  // device and how long it was open.
  payment_cancelled: "Closed PayPal without paying",
} as const;

const PRODUCTS = new Set(["digital", "print", "gift"]);

async function _POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const { id: storyId } = await context.params;
  const body = await req.json().catch(() => null);
  const kind = body?.kind as keyof typeof ALLOWED;
  if (!kind || !(kind in ALLOWED)) return NextResponse.json({ error: "Unknown event" }, { status: 400 });

  const user = await getAuthUser();
  // Admins look at customers' books all the time; that isn't the customer's step.
  if (user?.isAdmin) return NextResponse.json({ ok: true, skipped: "admin" });

  const product = typeof body?.details?.product === "string" && PRODUCTS.has(body.details.product) ? body.details.product : null;

  if (kind === "payment_cancelled") {
    const ua = req.headers.get("user-agent");
    const raw = Number(body?.details?.openMs);
    const openMs = Number.isFinite(raw) && raw >= 0 ? Math.min(Math.round(raw), 3_600_000) : null;
    const open = openMs === null ? "" : `, open ${Math.round(openMs / 1000)}s`;
    recordBookEventSoon({
      kind,
      summary: `${ALLOWED[kind]}${product ? ` (${product})` : ""} on ${browserSummary(ua)}${open}`,
      storyId,
      userId: user?.id ?? null,
      details: { product, open_ms: openMs, user_agent: ua?.slice(0, 300) ?? null },
      // At most one per book every 10 minutes, so retries can't flood the inbox.
      dedupeKey: `${kind}:${storyId}:${Math.floor(Date.now() / 600_000)}`,
    });
    return NextResponse.json({ ok: true });
  }

  recordBookEventSoon({
    kind,
    summary: product ? `${ALLOWED[kind]} (${product})` : ALLOWED[kind],
    storyId,
    userId: user?.id ?? null,
    details: product ? { product } : null,
    dedupeKey: kind === "checkout_started" ? `${kind}:${storyId}:${product ?? "unknown"}` : `${kind}:${storyId}`,
  });
  return NextResponse.json({ ok: true });
}

export const POST = withAccess({ story: { param: "id" } }, _POST);
