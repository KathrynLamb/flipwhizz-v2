// src/app/api/admin/tools/route.ts
//
// Site-wide admin tools. POST only: nothing here happens just by visiting a link.
//   { tool: "health-email" }  email the health digest now (even if all clear)
//   { tool: "test-alert" }    send a test alert to check email + PostHog
import { NextResponse } from "next/server";
import { withAccess, getAuthUser } from "@/lib/authz";
import { runHealthCheck, sendDigest } from "@/lib/healthCheck";
import { sendAlert } from "@/lib/alerts";
import { logAction } from "@/lib/admin/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function _POST(req: Request) {
  const user = await getAuthUser();
  const { tool } = ((await req.json().catch(() => ({}))) ?? {}) as { tool?: string };

  if (tool === "health-email") {
    const report = await runHealthCheck();
    const email = (await sendDigest(report, { force: true }).catch((e) => ({ sent: false, reason: String(e) }))) as { sent?: boolean; reason?: string } | undefined;
    const sent = email?.sent !== false;
    await logAction({ storyId: null, action: "health-email", label: "Email the health digest", status: sent ? "done" : "failed", result: JSON.stringify(email ?? {}).slice(0, 500), adminEmail: user?.email });
    return sent
      ? NextResponse.json({ ok: true, message: `Health digest sent (${report.total} item${report.total === 1 ? "" : "s"}).` })
      : NextResponse.json({ ok: false, error: `Not sent: ${email?.reason ?? "unknown reason"}` }, { status: 500 });
  }

  if (tool === "test-alert") {
    await sendAlert({
      area: "admin/test-alert",
      title: `Test alert ${new Date().toISOString().slice(11, 19)}`,
      severity: "warning",
      error: "This is a test. If you can read this, alerts are working.",
      userId: user?.id ?? null,
    });
    await logAction({ storyId: null, action: "test-alert", label: "Send a test alert", status: "done", adminEmail: user?.email });
    return NextResponse.json({ ok: true, message: `Test alert sent to ${process.env.ALERT_EMAIL || process.env.ADMIN_EMAIL}.` });
  }

  return NextResponse.json({ ok: false, error: "Unknown tool" }, { status: 400 });
}

export const POST = withAccess({ admin: true }, _POST);
