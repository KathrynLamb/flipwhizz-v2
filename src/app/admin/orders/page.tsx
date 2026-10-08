// src/app/admin/orders/page.tsx
//
// Print and digital orders, newest first, with Gelato status and tracking.
// "Needs action" = failed, waiting for manual action, or paid but never
// sent to Gelato. Test print orders are placed from a book's Overview tab.
import Link from "next/link";
import { requireAdminPage } from "@/lib/pageGuards";
import { listOrders, type OrderFilter } from "@/lib/admin/data";
import { Empty, FilterLinks, PageHeader, Pill, when } from "../ui";

export const dynamic = "force-dynamic";

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  await requireAdminPage();
  const { filter } = await searchParams;
  const f: OrderFilter = filter === "attention" ? "attention" : "all";
  const orders = await listOrders({ filter: f });

  return (
    <>
      <PageHeader title="Orders" subtitle="Test print orders are placed from a book's Overview tab." />
      <div className="mb-4">
        <FilterLinks base="/admin/orders" current={f} options={[{ value: "all", label: "All" }, { value: "attention", label: "Needs action" }]} />
      </div>
      {orders.length === 0 ? (
        <Empty>{f === "attention" ? "Nothing needs action." : "No orders yet."}</Empty>
      ) : (
        <ul className="divide-y divide-white/5 overflow-hidden rounded-xl border border-white/10">
          {orders.map((o) => (
            <li key={o.id} className="p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Link href={`/admin/books/${o.storyId}`} className="font-medium text-white hover:text-[#C4B5FD]">{o.title ?? "Untitled"}</Link>
                <Pill tone={o.status === "failed" || o.status === "pending_manual" ? "red" : o.paymentStatus === "paid" ? "green" : "slate"}>{o.status}</Pill>
                {o.gelatoStatus && <Pill>{`Gelato: ${o.gelatoStatus}`}</Pill>}
              </div>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                <Link href={`/admin/customers/${o.userId}`} className="hover:text-white">{o.email ?? o.userId}</Link>
                <span>{o.paymentStatus}{o.amount ? ` · ${o.amount} ${o.currency ?? ""}` : ""}</span>
                <span>{when(o.createdAt)}</span>
                {o.gelatoOrderId && <span className="font-mono">{o.gelatoOrderId}</span>}
                {o.trackingUrl && <a href={o.trackingUrl} target="_blank" className="text-[#C4B5FD]">tracking ↗</a>}
                {o.pdfUrl && <a href={o.pdfUrl} target="_blank" className="text-[#C4B5FD]">PDF ↗</a>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
