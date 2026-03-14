import { db } from "@/db";
import { projects, stories } from "@/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import Link from "next/link";
import Image from "next/image";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import StoriesCard from "@/app/projects/components/StoriesCard";
import CreateStoryButton from "@/app/projects/components/CreateStoryButton";

export default async function ProjectsIndexPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return <main className="min-h-screen bg-white" />;

  const userStories = await db
    .select({
      id: stories.id, projectId: stories.projectId, title: stories.title, description: stories.description,
      status: sql<string>`coalesce(${stories.status}, 'planning')`,
      paymentStatus: sql<string>`coalesce(${stories.paymentStatus}, 'pending')`,
      createdAt: stories.createdAt, updatedAt: stories.updatedAt,
      storyConfirmed: sql<boolean>`true`,
      coverImageUrl: sql<string | null>`coalesce(${stories.coverSpreadUrl},(select sp.image_url from story_pages sp where sp.story_id = ${stories.id} and sp.image_url is not null order by sp.page_number asc limit 1),(select c.portrait_image_url from story_characters sc join characters c on c.id = sc.character_id where sc.story_id = ${stories.id} and c.portrait_image_url is not null order by case when sc.role = 'protagonist' then 0 else 1 end asc limit 1))`,
    })
    .from(stories)
    .innerJoin(projects, eq(stories.projectId, projects.id))
    .where(eq(projects.userId, session.user.id))
    .orderBy(desc(stories.updatedAt));

  return (
    <main className="min-h-screen bg-[#FEFCFA] relative overflow-hidden">
      {/* Subtle background blobs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-[20%] -right-[10%] w-[50%] h-[50%] rounded-full blur-[100px] opacity-[0.06]" style={{ background: "linear-gradient(135deg, #E88BAE, #A78BDA)" }} />
        <div className="absolute top-[40%] -left-[15%] w-[40%] h-[40%] rounded-full blur-[100px] opacity-[0.05]" style={{ background: "linear-gradient(135deg, #7DD4A8, #6DBCE0)" }} />
        <div className="absolute -bottom-[10%] right-[20%] w-[35%] h-[35%] rounded-full blur-[80px] opacity-[0.05]" style={{ background: "linear-gradient(135deg, #F5A862, #F28B7B)" }} />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-20 bg-white/90 backdrop-blur-xl border-b border-gray-100">
        <div className="mx-auto max-w-7xl px-5 md:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-1 group">
            <Image src="/Flipwhizz_logo_NEW.png" alt="" width={140} height={140} priority className="transition-transform duration-300 group-hover:rotate-3" />
          </Link>
          <CreateStoryButton />
        </div>
      </header>

      {/* Hero */}
      <section className="relative z-10 px-5 md:px-8 pt-10 md:pt-14 pb-6 md:pb-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight leading-tight" style={{ color: "#2D2235" }}>Your Stories</h1>
              <p className="mt-2 text-base md:text-lg text-gray-500 max-w-lg font-medium">Every adventure starts here. What will you create next?</p>
            </div>
            {userStories.length > 0 && (
              <p className="text-sm font-semibold px-3 py-1.5 rounded-full" style={{ background: "rgba(217,69,144,0.08)", color: "#D94590" }}>
                {userStories.length} {userStories.length === 1 ? "story" : "stories"}
              </p>
            )}
          </div>
          <div className="mt-6 h-[3px] rounded-full w-32" style={{ background: "linear-gradient(90deg, #F28B7B, #F5A862, #F5CE62, #7DD4A8, #6DBCE0, #A78BDA)" }} />
        </div>
      </section>

      {/* Content */}
      <section className="relative z-10 px-5 md:px-8 pb-24">
        <div className="mx-auto max-w-7xl">
          {userStories.length === 0 ? (
            <div className="mt-8 rounded-3xl overflow-hidden border-2 border-gray-100">
              <div className="bg-white px-8 py-16 md:py-24 text-center">
                <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-8 text-4xl" style={{ background: "linear-gradient(135deg, #F5CE62, #F5A862)", boxShadow: "0 8px 24px rgba(245,168,98,0.25)" }}>✨</div>
                <h2 className="text-3xl md:text-4xl font-extrabold mb-3 tracking-tight" style={{ color: "#2D2235" }}>No stories yet</h2>
                <p className="text-gray-500 max-w-sm mx-auto mb-10 text-base leading-relaxed">Ready to create something magical? Your first illustrated spread is free.</p>
                <Link href="/projects/create" className="inline-flex items-center gap-2.5 px-8 py-4 rounded-full text-base font-bold text-white transition-all duration-300 hover:scale-105 hover:shadow-xl active:scale-[0.98]" style={{ background: "#D94590", boxShadow: "0 6px 24px rgba(217,69,144,0.3)" }}>
                  Create Your First Story <span className="text-lg">→</span>
                </Link>
              </div>
            </div>
          ) : (
            <ul className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {userStories.map((story) => <StoriesCard key={story.id} story={story} />)}
            </ul>
          )}
        </div>
      </section>
    </main>
  );
}