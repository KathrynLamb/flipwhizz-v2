// src/app/api/admin/stories/[storyId]/retrigger/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const INNGEST_EVENT_KEY = process.env.INNGEST_EVENT_KEY;
const INNGEST_BASE_URL = process.env.INNGEST_BASE_URL ?? "https://inn.gs";

function isAdmin(email: string | null | undefined) {
  return ADMIN_EMAIL && email === ADMIN_EMAIL;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ storyId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session?.user?.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!INNGEST_EVENT_KEY) {
    return NextResponse.json({ error: "INNGEST_EVENT_KEY not configured" }, { status: 500 });
  }

  const { storyId } = await params;

  const url = `${INNGEST_BASE_URL}/e/${INNGEST_EVENT_KEY}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "story/generate-spreads",
      data: { storyId },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("🔴 Inngest retrigger failed:", text);
    return NextResponse.json({ error: "Inngest event failed", details: text }, { status: 500 });
  }

  const json = await res.json();
  console.log(`🟢 Admin retrigger: story ${storyId} — event ID: ${json.ids?.[0]}`);

  return NextResponse.json({ ok: true, eventId: json.ids?.[0] });
}