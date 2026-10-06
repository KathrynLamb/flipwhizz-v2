// src/app/admin/health/page.tsx
//
// Admin health page. The admin layout already restricts this to ADMIN_EMAIL.

import Link from "next/link";
import { runHealthCheck } from "@/lib/healthCheck";
import { requireAdminPage } from "@/lib/pageGuards";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const tone = {
  critical: "border-red-500/40 bg-red-500/10 text-red-300",
  error: "border-orange-500/40 bg-orange-500/10 text-orange-300",
  warning: "border-yellow-500/40 bg-yellow-500/10 text-yellow-200",
} as const;

export default async function AdminHealthPage() {
  // The admin layout's redirect doesn't stop this page rendering in parallel.
  await requireAdminPage();
  const report = await runHealthCheck();

  return (
    <div className="min-h-screen bg-[#07070f]">
    <div className="mx-auto max-w-4xl px-4 py-8 text-slate-200">
      <div className="mb-6 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Health check</h1>
          <p className="text-sm text-slate-400">
            {report.total === 0 ? "All clear." : `${report.total} item${report.total === 1 ? "" : "s"} need a look.`}{" "}
            Checked {new Date(report.generatedAt).toLocaleString("en-GB", { timeZone: "Europe/London" })}.
          </p>
        </div>
        <div className="flex gap-3 text-sm">
          <Link href="/admin" className="text-slate-400 hover:text-white">← Admin</Link>
          <a href="/api/admin/health?email=1" className="text-[#C4B5FD] hover:text-white">Email me this now</a>
        </div>
      </div>

      <div className="space-y-4">
        {report.sections.map((sec) => (
          <section key={sec.key} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-semibold text-white">{sec.label}</h2>
              <span className={`rounded border px-2 py-0.5 font-mono text-xs ${sec.rows.length ? tone[sec.severity] : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"}`}>
                {sec.rows.length ? `${sec.rows.length} ${sec.severity}` : "ok"}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-400">{sec.explain}</p>
            {sec.error && <p className="mt-2 text-xs text-red-400">Check failed: {sec.error}</p>}
            {sec.rows.length > 0 && (
              <ul className="mt-3 space-y-2">
                {sec.rows.map((r, i) => (
                  <li key={i} className="text-sm">
                    {r.link ? (
                      <a href={r.link} className="text-[#C4B5FD] hover:text-white">{r.summary}</a>
                    ) : (
                      <span>{r.summary}</span>
                    )}
                    <span className="text-slate-500">
                      {r.userEmail ? ` · ${r.userEmail}` : ""}
                      {r.ageHours != null ? ` · ${r.ageHours}h ago` : ""}
                    </span>
                    {r.detail && <div className="font-mono text-xs text-slate-500">{r.detail}</div>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
    </div>
    </div>
  );
}
