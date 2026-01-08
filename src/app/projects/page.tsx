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
      <header className="relative z-10 border-b border-gray-200 bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 bg-clip-text text-transparent leading-tight backdrop-blur-sm">
        <div className="mx-auto max-w-7xl py-2 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-1 group">
            <div className="relative">
              <Image
                src="/Flipwhizz_logo.png"
                alt="FlipWhizz"
                width={120}
                height={120}
                priority
                className="group-hover:scale-110 transition-transform"
              />
            </div>
            <span className="text-2xl font-black tracking-tight bg-gradient-to-r from-pink-500 to-purple-500 bg-clip-text text-transparent">
              FlipWhizz
            </span>
          </Link>

          <CreateStoryButton />
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative z-10 px-6 pt-4 pb-4 bg-white">
        <div className="mx-auto max-w-7xl">
          {/* <div className="inline-flex items-center gap-2 mb-8">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="w-3 h-3 rounded-full bg-gradient-to-r from-pink-500 to-purple-500"
              />
            ))}
          </div> */}

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
            <ul className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
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