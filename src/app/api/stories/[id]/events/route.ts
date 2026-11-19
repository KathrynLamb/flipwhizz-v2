// src/app/api/stories/[id]/events/route.ts
//
// The few steps only the browser can see (the paywall appearing, the
// customer choosing a format and heading to checkout). Records a book event
// for the owner's book. Only these kinds are accepted from the client, and
// each is recorded once per book (checkout once per product), so a reload
// or a curious visitor can't flood the timeline or Katy's inbox.

import { NextResponse } from "next/server";
import { withAccess, getAuthUser } from "@/lib/authz";
import { recordBookEventSoon } from "@/lib/events/bookEvents";

const ALLOWED = {
  paywall_reached: "Saw the paywall after their free page",
  checkout_started: "Chose a format and went to checkout",
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
