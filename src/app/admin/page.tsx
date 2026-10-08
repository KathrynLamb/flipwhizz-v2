// src/app/admin/page.tsx
//
// Today: what's drawing right now, new paid books, and the health checks.
import Link from "next/link";
import { requireAdminPage } from "@/lib/pageGuards";
import { runHealthCheck } from "@/lib/healthCheck";
import { listBooks, recentPaidOrders, adminTablesReady } from "@/lib/admin/data";
import { Card, Empty, KindBadge, MigrationBanner, PageHeader, Pill, thumb, when } from "./ui";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const tone = {
  critical: "red",
  error: "amber",
  warning: "amber",
} as const;

const STORY_LINK = /\/stories\/([0-9a-f-]{36})\//i;

export default async function TodayPage() {
  await requireAdminPage();
  const [ready, running, paid, report] = await Promise.all([
    adminTablesReady(),
    listBooks({ filter: "running", limit: 20 }),
    recentPaidOrders(14),
    runHealthCheck(),
  ]);

  return (
    <>
      <PageHeader
        title="Today"
        subtitle={`${report.total === 0 ? "All health checks clear." : `${report.total} item${report.total === 1 ? "" : "s"} need a look.`} Checked ${when(report.generatedAt)}.`}
      />
      {!ready && <MigrationBanner />}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Drawing right now">
          {running.length === 0 ? (
            <Empty>Nothing is drawing.</Empty>
          ) : (
            <ul className="space-y-2">
              {running.map((b) => (
                <li key={b.id}>
                  <Link href={`/admin/books/${b.id}?tab=activity`} className="flex items-center gap-3 rounded-lg p-2 hover:bg-white/5">
                    {b.thumb ? <img src={thumb(b.thumb, 160)} alt="" className="h-10 w-16 rounded object-cover" /> : <div className="h-10 w-16 rounded bg-white/5" />}
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm text-white">{b.title}</div>
                      <div className="truncate text-xs text-slate-500">{b.ownerEmail}</div>
                    </div>
                    <KindBadge kind={b.kind} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="New paid books (14 days)">
          {paid.length === 0 ? (
            <Empty>No new paid orders.</Empty>
          ) : (
            <ul className="space-y-2">
              {paid.map((o) => (
                <li key={o.id}>
                  <Link href={`/admin/books/${o.storyId}`} className="flex items-center justify-between gap-3 rounded-lg p-2 hover:bg-white/5">
                    <div className="min-w-0">
                      <div className="truncate text-sm text-white">{o.title ?? "Untitled"}</div>
                      <div className="truncate text-xs text-slate-500">
                        {o.email} · {when(o.createdAt)}
                      </div>
                    </div>
                    <Pill tone={o.status === "failed" || o.status === "pending_manual" ? "red" : "green"}>{o.status}</Pill>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wider text-slate-500">Health checks</h2>
      <div className="space-y-3">
        {report.sections.map((sec) => (
          <Card
            key={sec.key}
            title={sec.label}
            right={sec.rows.length ? <Pill tone={tone[sec.severity]}>{`${sec.rows.length} ${sec.severity}`}</Pill> : <Pill tone="green">ok</Pill>}
          >
            <p className="text-xs text-slate-400">{sec.explain}</p>
            {sec.error && <p className="mt-2 text-xs text-rose-300">Check failed: {sec.error}</p>}
            {sec.rows.length > 0 && (
              <ul className="mt-3 space-y-2">
                {sec.rows.map((r, i) => {
                  const storyId = r.link?.match(STORY_LINK)?.[1];
                  return (
                    <li key={i} className="text-sm">
                      {storyId ? (
                        <Link href={`/admin/books/${storyId}`} className="text-[#C4B5FD] hover:text-white">
                          {r.summary}
                        </Link>
                      ) : r.link ? (
                        <a href={r.link} className="text-[#C4B5FD] hover:text-white">
                          {r.summary}
                        </a>
                      ) : (
                        <span>{r.summary}</span>
                      )}
                      <span className="text-slate-500">
                        {r.userEmail ? ` · ${r.userEmail}` : ""}
                        {r.ageHours != null ? ` · ${r.ageHours}h ago` : ""}
                      </span>
                      {r.detail && <div className="font-mono text-xs text-slate-500">{r.detail}</div>}
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        ))}
      </div>
    </>
  );
}
