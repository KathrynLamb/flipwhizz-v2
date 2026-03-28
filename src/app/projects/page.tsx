// src/app/projects/page.tsx
// REPLACES: your existing ProjectsIndexPage
//
// New structure: Reader → World → Books
// Falls back gracefully: stories without a world/reader show in "Standalone Stories"
// Server component — all data fetched server-side

import { db } from "@/db";
import { projects, stories, readers } from "@/db/schema";
import { worlds, worldReaders } from "@/db/schema-worlds";
import { eq, desc, sql, and, isNull, isNotNull } from "drizzle-orm";
import Link from "next/link";
import Image from "next/image";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import CreateStoryButton from "@/app/projects/components/CreateStoryButton";
import HomeContent from "@/app/projects/components/HomeContent";
// import HomeContent from "../components/HomeContent";

export default async function ProjectsIndexPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return <main className="min-h-screen bg-[#FEFCFA]" />;

  const userId = session.user.id;

  // 1. Get all readers for this user
  const userReaders = await db
  .select({
    id: readers.id,
    name: readers.name,
    gender: readers.gender,
    aiSummary: readers.aiSummary,
    interests: readers.interests,    // ADD
    avatarUrl: readers.avatarUrl,    // ADD
    createdAt: readers.createdAt,
  })
  .from(readers)
  .where(eq(readers.userId, userId))
  .orderBy(desc(readers.createdAt));

  // 2. Get all worlds for this user
  const userWorlds = await db
    .select({
      id: worlds.id,
      name: worlds.name,
      description: worlds.description,
      tonality: worlds.tonality,
      themes: worlds.themes,
      coverImageUrl: worlds.coverImageUrl,
      createdAt: worlds.createdAt,
    })
    .from(worlds)
    .where(eq(worlds.userId, userId))
    .orderBy(desc(worlds.updatedAt));

  // 3. Get world-reader links
  const readerWorldLinks = await db
    .select({
      worldId: worldReaders.worldId,
      readerId: worldReaders.readerId,
      role: worldReaders.role,
    })
    .from(worldReaders)
    .where(
      sql`${worldReaders.worldId} IN (SELECT id FROM worlds WHERE user_id = ${userId})`
    );

  // 4. Get all stories with cover images
  const userStories = await db
    .select({
      id: stories.id,
      projectId: stories.projectId,
      title: stories.title,
      description: stories.description,
      status: sql<string>`coalesce(${stories.status}, 'planning')`,
      paymentStatus: sql<string>`coalesce(${stories.paymentStatus}, 'pending')`,
      readerId: stories.readerId,
      worldId: stories.worldId,
      bookNumber: stories.bookNumber,
      coverImageUrl: sql<string | null>`coalesce(
        ${stories.coverSpreadUrl},
        (select sp.image_url from story_pages sp 
         where sp.story_id = ${stories.id} and sp.image_url is not null 
         order by sp.page_number asc limit 1),
        (select c.portrait_image_url from story_characters sc 
         join characters c on c.id = sc.character_id 
         where sc.story_id = ${stories.id} and c.portrait_image_url is not null 
         order by case when sc.role = 'protagonist' then 0 else 1 end asc limit 1)
      )`,
      createdAt: stories.createdAt,
      updatedAt: stories.updatedAt,
    })
    .from(stories)
    .innerJoin(projects, eq(stories.projectId, projects.id))
    .where(eq(projects.userId, userId))
    .orderBy(desc(stories.updatedAt));

  // 5. Assemble the data structure for the client component
  // Build reader → worlds → stories hierarchy
  const readerMap = new Map<
    string,
    {
      id: string;
      name: string | null;
      gender: string | null;
      aiSummary: string | null;
      worlds: Array<{
        id: string;
        name: string;
        description: string | null;
        tonality: string | null;
        themes: string[];
        coverImageUrl: string | null;
        role: string | null;
        stories: typeof userStories;
      }>;
      standaloneStories: typeof userStories;
    }
  >();

  // Initialize readers
  for (const reader of userReaders) {
    readerMap.set(reader.id, {
      id: reader.id,
      name: reader.name,
      gender: reader.gender,
      aiSummary: reader.aiSummary,
      worlds: [],
      standaloneStories: [],
    });
  }

  // Build world lookup: worldId → world data + readerId
  const worldToReader = new Map<string, string>();
  for (const link of readerWorldLinks) {
    worldToReader.set(link.worldId, link.readerId);
  }

  // Attach worlds to readers
  for (const world of userWorlds) {
    const readerId = worldToReader.get(world.id);
    if (readerId && readerMap.has(readerId)) {
      const readerEntry = readerMap.get(readerId)!;
      readerEntry.worlds.push({
        id: world.id,
        name: world.name,
        description: world.description,
        tonality: world.tonality,
        themes: (world.themes as string[]) ?? [],
        coverImageUrl: world.coverImageUrl,
        role:
          readerWorldLinks.find(
            (l) => l.worldId === world.id && l.readerId === readerId
          )?.role ?? null,
        stories: [],
      });
    }
  }

  // Attach stories to worlds (or standalone)
  const orphanStories: typeof userStories = [];

  for (const story of userStories) {
    if (story.worldId) {
      // Find the reader that owns this world
      const readerId = worldToReader.get(story.worldId);
      if (readerId && readerMap.has(readerId)) {
        const readerEntry = readerMap.get(readerId)!;
        const worldEntry = readerEntry.worlds.find(
          (w) => w.id === story.worldId
        );
        if (worldEntry) {
          worldEntry.stories.push(story);
          continue;
        }
      }
    }

    if (story.readerId && readerMap.has(story.readerId)) {
      // Story has a reader but no world
      readerMap.get(story.readerId)!.standaloneStories.push(story);
    } else {
      // Fully orphaned — no reader, no world
      orphanStories.push(story);
    }
  }

  // Sort world stories by book number
  for (const [, reader] of readerMap) {
    for (const world of reader.worlds) {
      world.stories.sort(
        (a, b) => (a.bookNumber ?? 0) - (b.bookNumber ?? 0)
      );
    }
  }

  const readersData = Array.from(readerMap.values());
  const totalStories = userStories.length;

  return (
    <main className="min-h-screen bg-[#FEFCFA] relative overflow-hidden">
      {/* Background blobs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute -top-[20%] -right-[10%] w-[50%] h-[50%] rounded-full blur-[100px] opacity-[0.06]"
          style={{
            background: "linear-gradient(135deg, #E88BAE, #A78BDA)",
          }}
        />
        <div
          className="absolute top-[40%] -left-[15%] w-[40%] h-[40%] rounded-full blur-[80px] opacity-[0.05]"
          style={{
            background: "linear-gradient(135deg, #7DD4A8, #6DBCE0)",
          }}
        />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-20 bg-white/90 backdrop-blur-xl border-b border-gray-100">
        <div className="mx-auto max-w-7xl px-5 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-1 group">
            <Image
              src="/Flipwhizz_logo_NEW.png"
              alt="FlipWhizz"
              width={140}
              height={140}
              priority
              className="transition-transform duration-300 group-hover:rotate-3"
            />
          </Link>
          <CreateStoryButton />
        </div>
      </header>

      {/* Content */}
      <HomeContent
        readers={readersData}
        orphanStories={orphanStories}
        totalStories={totalStories}
      />
    </main>
  );
}