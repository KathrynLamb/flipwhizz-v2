// src/app/admin/customers/page.tsx
//
// Find a customer by email or name; newest sign-ups first.
import Link from "next/link";
import { requireAdminPage } from "@/lib/pageGuards";
import { searchCustomers } from "@/lib/admin/data";
import { Empty, PageHeader, Pill, SearchBox, when } from "../ui";

export const dynamic = "force-dynamic";

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireAdminPage();
  const { q } = await searchParams;
  const people = await searchCustomers(q ?? "");
  return (
    <>
      <PageHeader title="Customers" subtitle={q ? `Matching "${q}"` : "Newest sign-ups first."} />
      <SearchBox action="/admin/customers" q={q} placeholder="Search email or name" />
      {people.length === 0 ? (
        <Empty>Nobody matches.</Empty>
      ) : (
        <ul className="divide-y divide-white/5 overflow-hidden rounded-xl border border-white/10">
          {people.map((u) => (
            <li key={u.id}>
              <Link href={`/admin/customers/${u.id}`} className="flex flex-wrap items-center gap-3 p-3 hover:bg-white/5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm text-white">{u.email}</span>
                    {u.isAdmin && <Pill tone="green">you</Pill>}
                  </div>
                  <div className="truncate text-xs text-slate-500">
                    {u.name ?? "no name"} · joined {when(u.createdAt)}
                  </div>
                </div>
                <div className="flex gap-3 text-xs text-slate-400">
                  <span>{u.books} books</span>
                  <span>{u.paidBooks} paid</span>
                  <span>{u.orders} orders</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
