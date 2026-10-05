// src/app/api/alerts/client/route.ts
//
// Lets the browser report failures the server never sees, e.g. a Vercel
// timeout (504) that kills the function before any catch block runs.
// Signed-in users only, known kinds only, small payloads only.

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sendAlert } from "@/lib/alerts";

const ALLOWED_KINDS = new Set([
  "story_creation_failed",
  "chat_failed",
  "chat_history_failed",
  "checkout_failed",
  "generation_stalled",
]);

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ ok: false }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const kind = typeof body.kind === "string" ? body.kind : "";
  if (!ALLOWED_KINDS.has(kind)) return NextResponse.json({ ok: false }, { status: 400 });

  const str = (v: unknown, max = 500) => (typeof v === "string" ? v.slice(0, max) : null);

  await sendAlert({
    area: `client/${kind}`,
    title: `User hit ${kind.replace(/_/g, " ")}`,
    severity: kind === "story_creation_failed" || kind === "checkout_failed" ? "critical" : "error",
    error: str(body.message, 1000) || kind,
    userId,
    projectId: str(body.projectId, 64),
    storyId: str(body.storyId, 64),
    context: {
      page: str(body.page, 300),
      status: typeof body.status === "number" ? body.status : null,
      user_email: session.user?.email ?? null,
    },
  });

  return NextResponse.json({ ok: true });
}
