// src/app/projects/page.tsx
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

  if (!session?.user?.id) {
    return <main className="min-h-screen bg-white" />;
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
      coverImageUrl: sql<string | null>`
        coalesce(
          ${stories.coverSpreadUrl},
          (
            select sp.image_url
            from story_pages sp
            where sp.story_id = ${stories.id}
              and sp.image_url is not null
            order by sp.page_number asc
            limit 1
          ),
          (
            select c.portrait_image_url
            from story_characters sc
            join characters c on c.id = sc.character_id
            where sc.story_id = ${stories.id}
              and c.portrait_image_url is not null
            order by
              case when sc.role = 'protagonist' then 0 else 1 end asc
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
    <main className="min-h-screen bg-white relative overflow-hidden">
      
      {/* Clean modern background with vibrant accents */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Soft gradient wash */}
        <div className="absolute -top-[30%] left-[20%] w-[70%] h-[60%] bg-gradient-to-br from-pink-200/60 via-purple-200/60 to-blue-200/60 rounded-full blur-[120px]" />
        
        {/* Fun vibrant accent circles */}
        <div className="absolute top-[10%] right-[15%] w-32 h-32 bg-yellow-400 rounded-full opacity-40 blur-2xl" />
        <div className="absolute top-[50%] left-[10%] w-40 h-40 bg-pink-500 rounded-full opacity-30 blur-3xl" />
        <div className="absolute bottom-[20%] right-[25%] w-36 h-36 bg-blue-500 rounded-full opacity-35 blur-2xl" />
        <div className="absolute bottom-[30%] left-[40%] w-24 h-24 bg-orange-400 rounded-full opacity-40 blur-xl" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-gray-200">
          <div className="mx-auto max-w-7xl px-4 h-14 flex items-center justify-between">

            {/* Brand */}
            <Link
              href="/"
              className="flex items-center gap-0.5 md:gap-2 group"
              aria-label="FlipWhizz home"
            >
              <Image
                src="/Flipwhizz_logo.png"
                alt=""
                width={48}
                height={48}
                priority
                className="transition-transform group-hover:scale-105"
              />

              <span className="text-lg font-extrabold tracking-tight bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 bg-clip-text text-transparent">
                FlipWhizz
              </span>
            </Link>

            {/* Primary action */}
            <CreateStoryButton />
          </div>
        </header>


      {/* Hero Section */}
      <section className="relative z-10 px-6 pt-4 pb-4 bg-white">
        <div className="mx-auto max-w-7xl">

          <h1 className="text-2xl md:text-5xl font-black mb-6 bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 bg-clip-text text-transparent leading-tight">
            Your Stories
          </h1>
          
          <p className="text-xl text-gray-600 max-w-2xl font-medium">
            Every adventure starts here. Create, design, and bring your magical worlds to life! ✨
          </p>
        </div>
      </section>

      {/* Content Section */}
      <section className="relative z-10 px-6 pb-32 bg-white">
        <div className="mx-auto max-w-7xl">
          {userStories.length === 0 ? (
            <div className="relative">
              {/* Gradient border wrapper */}
              <div className="bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 rounded-[2.5rem] p-1">
                <div className="bg-white rounded-[2.3rem] p-16 text-center">
                  <div className="w-24 h-24 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-3xl flex items-center justify-center mx-auto mb-8 text-5xl shadow-lg shadow-orange-300/50">
                    ✨
                  </div>
                  
                  <h2 className="text-5xl font-black mb-4 bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 bg-clip-text text-transparent">
                    No Stories Yet
                  </h2>
                  
                  <p className="text-lg text-gray-600 max-w-md mx-auto mb-10 font-medium">
                    Ready to create something magical? Let's start your first story together!
                  </p>

                  <Link
                    href="/projects/create"
                    className="
                      inline-flex items-center gap-3
                      bg-black text-white
                      text-xl font-black
                      px-10 py-5 rounded-2xl
                      hover:scale-110 transition-transform
                      active:scale-95
                      shadow-2xl
                    "
                  >
                    <span>Create Your First Story</span>
                    <span className="text-2xl">🚀</span>
                  </Link>
                </div>
              </div>
            </div>
          ) : (
            <ul className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {userStories.map((story) => (
                <StoriesCard key={story.id} story={story} />
              ))}
            </ul>
          )}
        </div>
      </section>
    </main>
  );
}