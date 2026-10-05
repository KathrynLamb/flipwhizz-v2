// src/app/api/admin/health/route.ts
//
// Admin-only. GET returns the live health report as JSON.
// GET ?email=1 also sends the digest email now (even if all clear).

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { runHealthCheck, sendDigest } from "@/lib/healthCheck";

export const maxDuration = 60;

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail || session?.user?.email !== adminEmail) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const report = await runHealthCheck();
  const wantsEmail = new URL(req.url).searchParams.get("email") === "1";
  const email = wantsEmail ? await sendDigest(report, { force: true }).catch((e) => ({ sent: false, reason: String(e) })) : undefined;

  return NextResponse.json({ ...report, email });
}
