// src/app/admin/books/[storyId]/page.tsx
//
// The Book page: every control for one book, in tabs.
import { notFound } from "next/navigation";
import { requireAdminPage } from "@/lib/pageGuards";
import { loadBookDetail } from "@/lib/admin/data";
import { loadBookIdentity } from "@/lib/admin/server";
import { loadBookCosts } from "@/lib/admin/costs";
import BookClient, { type BookTab } from "./BookClient";

export const dynamic = "force-dynamic";

const TABS: BookTab[] = ["overview", "pages", "characters", "locations", "redraw", "costs", "pdf", "activity"];

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
  const [original, costs] = await Promise.all([
    detail.book.originalStoryId ? loadBookIdentity(detail.book.originalStoryId) : Promise.resolve(null),
    // Cheap (indexed on story_id); the Overview shows the total, the Costs tab the detail.
    loadBookCosts(storyId, detail.book.projectId ?? null).catch((err) => {
      console.error("[admin] could not load book costs:", err);
      return null;
    }),
  ]);

  return (
    <BookClient
      detail={detail}
      costs={costs}
      tab={TABS.includes(tab as BookTab) ? (tab as BookTab) : "overview"}
      original={original ? { id: original.id, title: original.title, kind: original.kind, ownerEmail: original.ownerEmail } : null}
    />
  );
}
