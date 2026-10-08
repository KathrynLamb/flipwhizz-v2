// src/app/admin/books/[storyId]/page.tsx
//
// The Book page: every control for one book, in tabs.
import { notFound } from "next/navigation";
import { requireAdminPage } from "@/lib/pageGuards";
import { loadBookDetail } from "@/lib/admin/data";
import { loadBookIdentity } from "@/lib/admin/server";
import BookClient, { type BookTab } from "./BookClient";

export const dynamic = "force-dynamic";

const TABS: BookTab[] = ["overview", "pages", "characters", "locations", "redraw", "pdf", "activity"];

export default async function BookPage({
  params,
  searchParams,
}: {
  params: Promise<{ storyId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  await requireAdminPage();
  const { storyId } = await params;
  const { tab } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(storyId)) notFound();

  const detail = await loadBookDetail(storyId);
  if (!detail) notFound();
  const original = detail.book.originalStoryId ? await loadBookIdentity(detail.book.originalStoryId) : null;

  return (
    <BookClient
      detail={detail}
      tab={TABS.includes(tab as BookTab) ? (tab as BookTab) : "overview"}
      original={original ? { id: original.id, title: original.title, kind: original.kind, ownerEmail: original.ownerEmail } : null}
    />
  );
}
