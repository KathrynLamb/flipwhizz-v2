// src/app/admin/regenerate/page.tsx
//
// Admin-only page to regenerate any book by its story id, choose the image
// model, see the per-spread check report, and update one character on every
// page. Usage: /admin/regenerate?storyId=<uuid>
import { requireAdminPage } from "@/lib/pageGuards";
import { db } from "@/db";
import { stories, projects, users, storyPages, storySpreads, storyCharacters, characters } from "@/db/schema";
import { asc, eq, sql } from "drizzle-orm";
import RegenerateClient, { type SpreadQa, type StoryInfo } from "./RegenerateClient";

export const dynamic = "force-dynamic";

export default async function RegeneratePage({
  searchParams,
}: {
  searchParams: Promise<{ storyId?: string }>;
}) {
  await requireAdminPage();
  const { storyId } = await searchParams;

  let story: StoryInfo | null = null;
  let spreads: SpreadQa[] = [];
  let cast: { id: string; name: string }[] = [];

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

      const rows = await db
        .select({ id: storySpreads.id, index: storySpreads.spreadIndex, qa: storySpreads.qa })
        .from(storySpreads)
        .where(eq(storySpreads.storyId, storyId))
        .orderBy(asc(storySpreads.spreadIndex));
      spreads = rows.map((r) => {
        const qa = (r.qa ?? null) as any;
        return {
          id: r.id,
          index: r.index,
          status: qa?.status ?? null,
          remaining: Array.isArray(qa?.remaining) ? qa.remaining : [],
          textProblems: Array.isArray(qa?.text?.problems) ? qa.text.problems : [],
          fixesApplied: qa?.fixesApplied ?? 0,
          model: qa?.model ?? null,
          finalUrl: qa?.finalUrl ?? null,
          artUrl: qa?.artUrl ?? null,
          at: qa?.at ?? null,
        };
      });

      cast = await db
        .select({ id: characters.id, name: characters.name })
        .from(storyCharacters)
        .innerJoin(characters, eq(characters.id, storyCharacters.characterId))
        .where(eq(storyCharacters.storyId, storyId));
    }
  }

  return <RegenerateClient storyId={storyId ?? ""} story={story} spreads={spreads} cast={cast} />;
}
