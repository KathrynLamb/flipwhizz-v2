// src/app/projects/page.tsx
import { db } from "@/db";
import { projects, stories, storyPages } from "@/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Playfair_Display, Lato } from "next/font/google";
import StoriesCard from "@/app/projects/components/StoriesCard";
import CreateStoryButton from "@/app/projects/components/CreateStoryButton";

const playfair = Playfair_Display({ subsets: ["latin"], variable: "--font-serif", weight: ["400","700","900"] });
const lato = Lato({ subsets: ["latin"], variable: "--font-sans", weight: ["400","700"] });

export default async function ProjectsIndexPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    // keep your signed-out UI
    return (
      <main className={`min-h-screen ${playfair.variable} ${lato.variable} font-sans bg-[#FDF8F0] text-slate-900`}>
        {/* ...your existing signed-out content... */}
      </main>
    );
  }

  

const userStories = await db
  .select({
    id: stories.id,
    projectId: stories.projectId,
    title: stories.title,
    description: stories.description,

    status: sql<string>`coalesce(${stories.status}, 'planning')`,
    paymentStatus: sql<string>`coalesce(${stories.paymentStatus}, 'pending')`,

    createdAt: stories.createdAt,
    updatedAt: stories.updatedAt,
    storyConfirmed: sql<boolean>`true`,

    // ✅ COVER IMAGE LOGIC (page image → style guide image → null)
    coverImageUrl: sql<string | null>`
      coalesce(
        (
          select pi.url
          from story_pages sp
          join page_images pi on pi.page_id = sp.id
          where sp.story_id = ${stories.id}
          order by sp.page_number asc
          limit 1
        ),
        (
          select ssg.sample_illustration_url
          from story_style_guide ssg
          where ssg.story_id = ${stories.id}
          limit 1
        )
      )
    `,
  })
  .from(stories)
  .innerJoin(projects, eq(stories.projectId, projects.id))
  .where(eq(projects.userId, session.user.id))
  .orderBy(desc(stories.updatedAt));

  return (
    <main className={`min-h-screen ${playfair.variable} ${lato.variable} font-sans bg-[#FDF8F0] text-slate-900 overflow-x-hidden`}>
      {/* Top bar */}
      <header className="w-full px-6 py-6 md:px-12 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 text-[#261C15]">
          <span className="text-2xl">📖</span>
          <span className="font-serif text-2xl font-bold tracking-wide">FlipWhizz</span>
        </Link>

      <CreateStoryButton />
      </header>

      <section className="px-6 md:px-12 pb-10">
        <div className="mx-auto max-w-6xl">
          <h1 className="font-serif text-4xl md:text-5xl text-[#261C15] font-bold">Your Library</h1>
          <p className="mt-3 text-[#6B5D52] md:text-lg">
            Your stories (the good stuff) — titles, status, pages, and progress.
          </p>
        </div>
      </section>

      <section className="px-6 md:px-12 pb-24">
        <div className="mx-auto max-w-6xl">
          {userStories.length === 0 ? (
            <div className="rounded-3xl border-4 border-[#E6D5B8] bg-[#F3EAD3] p-10 md:p-14 text-center">
              <h2 className="font-serif text-3xl text-[#261C15] font-bold">No stories yet</h2>
              <p className="mt-3 text-[#6B5D52]">Create a project, then start your first story.</p>
              <div className="mt-8 flex justify-center">
                <Link
                  href="/projects/create"
                  className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 font-bold text-[#261C15] shadow-lg ring-1 ring-black/5 hover:bg-white/90 transition"
                >
                  <span className="text-lg">➕</span> Create your first project
                </Link>
              </div>
            </div>
          ) : (
            <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {userStories.map((story) => (
                <StoriesCard story={story} key={story.id} />
         
              ))}
            </ul>
          )}
        </div>
      </section>
    </main>
  );
}
