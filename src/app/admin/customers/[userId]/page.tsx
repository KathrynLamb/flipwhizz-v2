// src/app/admin/customers/[userId]/page.tsx
//
// One customer: their books (each opens its Book page) and their orders.
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminPage } from "@/lib/pageGuards";
import { listBooks, listOrders, searchCustomers } from "@/lib/admin/data";
import { Card, Empty, KindBadge, PageHeader, Pill, thumb, when } from "../../ui";

export const dynamic = "force-dynamic";

export default async function CustomerPage({ params }: { params: Promise<{ userId: string }> }) {
  await requireAdminPage();
  const { userId } = await params;
  const [person] = (await searchCustomers(userId)).filter((u) => u.id === userId);
  if (!person) notFound();
  const [books, orders] = await Promise.all([listBooks({ ownerId: userId, limit: 100 }), listOrders({ userId, limit: 50 })]);

  return (
    <>
      <Link href="/admin/customers" className="text-xs text-slate-500 hover:text-white">← Customers</Link>
      <PageHeader title={person.email} subtitle={`${person.name ?? "no name"} · joined ${when(person.createdAt)} · ${person.id}`} />

      <div className="space-y-4">
        <Card title={`Books (${books.length})`}>
          {books.length === 0 ? (
            <Empty>No books yet.</Empty>
          ) : (
            <ul className="space-y-1">
              {books.map((b) => (
                <li key={b.id}>
                  <Link href={`/admin/books/${b.id}`} className="flex items-center gap-3 rounded-lg p-2 hover:bg-white/5">
                    {b.thumb ? <img src={thumb(b.thumb, 160)} alt="" className="h-10 w-16 rounded object-cover" /> : <div className="h-10 w-16 rounded bg-white/5" />}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-sm text-white">{b.title}</span>
                        <KindBadge kind={b.kind} />
                        {b.running && <Pill tone="violet">drawing</Pill>}
                      </div>
                      <div className="text-xs text-slate-500">
                        {b.drawn}/{b.pages} pages drawn · {b.status ?? "no status"} · {when(b.updatedAt)}
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title={`Orders (${orders.length})`}>
          {orders.length === 0 ? (
            <Empty>No orders.</Empty>
          ) : (
            <ul className="space-y-2 text-sm">
              {orders.map((o) => (
                <li key={o.id} className="flex flex-wrap items-center gap-2">
                  <Link href={`/admin/books/${o.storyId}`} className="text-[#C4B5FD] hover:text-white">{o.title ?? "Untitled"}</Link>
                  <Pill tone={o.status === "failed" || o.status === "pending_manual" ? "red" : "slate"}>{o.status}</Pill>
                  <span className="text-slate-400">{o.paymentStatus}</span>
                  {o.gelatoStatus && <span className="text-slate-400">Gelato: {o.gelatoStatus}</span>}
                  <span className="text-xs text-slate-500">{when(o.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
