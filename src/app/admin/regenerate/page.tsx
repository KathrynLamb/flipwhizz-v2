// src/app/admin/regenerate/page.tsx
//
// Admin-only page to regenerate any book by its story id.
// Usage: /admin/regenerate?storyId=<uuid>
import { requireAdminPage } from "@/lib/pageGuards";
import { db } from "@/db";
import { stories, projects, users, storyPages } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import RegenerateClient from "./RegenerateClient";

export const dynamic = "force-dynamic";

export default async function RegeneratePage({
  searchParams,
}: {
  searchParams: Promise<{ storyId?: string }>;
}) {
  await requireAdminPage();
  const { storyId } = await searchParams;

  let story: null | {
    id: string;
    title: string;
    status: string | null;
    paymentStatus: string | null;
    ownerEmail: string | null;
    drawn: number;
    pages: number;
  } = null;

  if (storyId && /^[0-9a-f-]{36}$/i.test(storyId)) {
    const [row] = await db
      .select({
        id: stories.id,
        title: stories.title,
        status: stories.status,
        paymentStatus: stories.paymentStatus,
        ownerEmail: users.email,
      })
      .from(stories)
      .leftJoin(projects, eq(projects.id, stories.projectId))
      .leftJoin(users, eq(users.id, projects.userId))
      .where(eq(stories.id, storyId))
      .limit(1);

    if (row) {
      const [counts] = await db
        .select({
          drawn: sql<number>`count(*) filter (where ${storyPages.imageUrl} is not null)::int`,
          pages: sql<number>`count(*)::int`,
        })
        .from(storyPages)
        .where(eq(storyPages.storyId, storyId));
      story = { ...row, drawn: counts?.drawn ?? 0, pages: counts?.pages ?? 0 };
    }
  }

  return <RegenerateClient storyId={storyId ?? ""} story={story} />;
}
