// src/app/admin/orders/promos/page.tsx
import Link from "next/link";
import { sql } from "drizzle-orm";
import { requireAdminPage } from "@/lib/pageGuards";
import { rows } from "@/lib/admin/server";
import { PageHeader, when } from "../../ui";

export const dynamic = "force-dynamic";
export default async function PromoOrdersPage() {
  await requireAdminPage();
  const [totals, purchases, pending] = await Promise.all([
    rows<{ code: string; label: string | null; currency: string; purchases: number; free: number; cents: string }>(sql`
      SELECT coalesce(p.promo_code, 'No promo code') AS code, c.label, p.currency,
        count(*)::int AS purchases, count(*) FILTER (WHERE p.amount_cents = 0)::int AS free,
        sum(p.amount_cents)::text AS cents
      FROM checkout_payments p LEFT JOIN promo_codes c ON c.id = p.promo_id
      WHERE p.status = 'paid'
      GROUP BY p.promo_code, c.label, p.currency ORDER BY purchases DESC, code
    `),
    rows<{ id: string; story_id: string; title: string; promo_code: string | null; product_type: string; currency: string; amount_cents: number; paid_at: string }>(sql`
      SELECT p.*, s.title FROM checkout_payments p JOIN stories s ON s.id = p.story_id
      WHERE p.status = 'paid' ORDER BY p.paid_at DESC LIMIT 100
    `),
    rows<{ id: string; promo_code: string | null; updated_at: string }>(sql`
      SELECT id, promo_code, updated_at FROM checkout_payments WHERE status = 'reserved'
      ORDER BY updated_at ASC LIMIT 100
    `),
  ]);
  const money = (cents: number, currency: string) => new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(cents / 100);
  return <>
    <PageHeader title="Orders per promo code" subtitle="Completed purchases since payment tracking was enabled. Each checkout counts once, including free books and upgrades. Later print submissions are not counted again." />
    <Link href="/admin/orders" className="text-sm text-[#C4B5FD] underline">Back to print orders</Link>
    <div className="my-6 overflow-x-auto rounded-xl border border-white/10">
      <table className="w-full text-left text-sm">
        <thead className="bg-white/5"><tr>{["Code", "Label", "Purchases", "Free", "Revenue"].map(h => <th key={h} className="p-3">{h}</th>)}</tr></thead>
        <tbody>{totals.map(r => <tr key={`${r.code}-${r.currency}`} className="border-t border-white/5">
          <td className="p-3 font-mono">{r.code}</td><td className="p-3">{r.label ?? ""}</td><td className="p-3">{r.purchases}</td><td className="p-3">{r.free}</td><td className="p-3 whitespace-nowrap">{money(Number(r.cents), r.currency)} {r.currency}</td>
        </tr>)}</tbody>
      </table>
      {!totals.length && <p className="p-4 text-sm text-slate-400">No completed purchases recorded yet.</p>}
    </div>
    <h2 className="text-lg font-semibold">Latest 100 purchases</h2>
    <ul className="mt-3 divide-y divide-white/10">{purchases.map(p => <li key={p.id} className="py-3 text-sm">
      <Link href={`/admin/books/${p.story_id}`} className="text-[#C4B5FD]">{p.title}</Link>
      <p className="mt-1 break-words text-xs text-slate-400">{p.promo_code ?? "No promo code"} · {p.product_type} · {money(p.amount_cents, p.currency)} · {when(p.paid_at)}</p>
      <p className="break-all font-mono text-xs text-slate-500">{p.id}</p>
    </li>)}</ul>
    {!!pending.length && <section className="mt-6 rounded-xl border border-amber-500/30 p-4">
      <h2 className="font-semibold">Payments awaiting confirmation</h2>
      <p className="mt-2 text-sm text-slate-400">These reserve a code use but do not count as sales. Check PayPal before releasing a reservation. Retrying the same checkout recovers a completed payment without counting it twice.</p>
      <ul className="mt-3 space-y-2 text-xs">{pending.map(p => <li key={p.id} className="break-all">{p.id} · {p.promo_code ?? "No promo code"} · {when(p.updated_at)}</li>)}</ul>
    </section>}
  </>;
}
