// src/app/admin/books/page.tsx
//
// Every book, newest activity first. Search by title, owner email/name or
// story id; filter to paid customer books, books needing attention, books
// drawing now, or your test copies.
import Link from "next/link";
import { requireAdminPage } from "@/lib/pageGuards";
import { listBooks, type BookFilter } from "@/lib/admin/data";
import { Empty, FilterLinks, KindBadge, PageHeader, Pill, SearchBox, thumb, when } from "../ui";

export const dynamic = "force-dynamic";

const FILTERS: { value: BookFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "paid", label: "Paid customers" },
  { value: "attention", label: "Needs attention" },
  { value: "running", label: "Drawing now" },
  { value: "copies", label: "Test copies" },
];

export default async function BooksPage({ searchParams }: { searchParams: Promise<{ q?: string; filter?: string }> }) {
  await requireAdminPage();
  const { q, filter } = await searchParams;
  const f = (FILTERS.find((x) => x.value === filter)?.value ?? "all") as BookFilter;
  const books = await listBooks({ q, filter: f });

  return (
    <>
      <PageHeader title="Books" subtitle="Tap a book for every control it has." />
      <SearchBox action="/admin/books" q={q} placeholder="Search title, owner email or name, or paste a story id" />
      <div className="mb-4">
        <FilterLinks base={q ? `/admin/books?q=${encodeURIComponent(q)}` : "/admin/books"} current={f} options={FILTERS} />
      </div>

      {books.length === 0 ? (
        <Empty>No books match.</Empty>
      ) : (
        <ul className="divide-y divide-white/5 overflow-hidden rounded-xl border border-white/10">
          {books.map((b) => (
            <li key={b.id}>
              <Link href={`/admin/books/${b.id}`} className="flex items-center gap-3 p-3 hover:bg-white/5">
                {b.thumb ? <img src={thumb(b.thumb, 200)} alt="" className="h-12 w-20 shrink-0 rounded object-cover" /> : <div className="h-12 w-20 shrink-0 rounded bg-white/5" />}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-medium text-white">{b.title}</span>
                    <KindBadge kind={b.kind} />
                    {b.running && <Pill tone="violet">drawing</Pill>}
                    {b.flagged > 0 && <Pill tone="red">{`${b.flagged} flagged`}</Pill>}
                  </div>
                  <div className="mt-0.5 truncate text-xs text-slate-500">
                    {b.ownerEmail ?? "no owner"} · {b.drawn}/{b.pages} pages drawn · {b.status ?? "no status"} · {when(b.updatedAt)}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
