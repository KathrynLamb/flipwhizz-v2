// src/app/admin/regenerate/page.tsx
//
// Replaced by the Book page (/admin/books/[id]). Old links redirect there.
import { redirect } from "next/navigation";

export default async function RegeneratePage({ searchParams }: { searchParams: Promise<{ storyId?: string }> }) {
  const { storyId } = await searchParams;
  redirect(storyId && /^[0-9a-f-]{36}$/i.test(storyId) ? `/admin/books/${storyId}?tab=redraw` : "/admin/books");
}
