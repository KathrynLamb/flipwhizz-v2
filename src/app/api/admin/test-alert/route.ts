// src/app/api/admin/test-alert/route.ts
//
// Admin-only: visit /api/admin/test-alert to send yourself a test alert
// and confirm emails + PostHog are wired up.

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sendAlert } from "@/lib/alerts";

export async function GET() {
  const session = await getServerSession(authOptions);
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail || session?.user?.email !== adminEmail) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await sendAlert({
    area: "admin/test-alert",
    title: `Test alert ${new Date().toISOString().slice(11, 19)}`,
    severity: "warning",
    error: "This is a test. If you can read this, alerts are working.",
    userId: session.user?.id ?? null,
  });

  return NextResponse.json({ ok: true, sentTo: process.env.ALERT_EMAIL || adminEmail });
}
