// // src/app/projects/page.tsx
// import { db } from "@/db";
// import { projects, stories, storyPages } from "@/db/schema";
// import { eq, desc, sql } from "drizzle-orm";
// import Link from "next/link";
// import { getServerSession } from "next-auth";
// import { authOptions } from "@/lib/auth";
// import { Playfair_Display, Lato } from "next/font/google";
// import StoriesCard from "@/app/projects/components/StoriesCard";
// import CreateStoryButton from "@/app/projects/components/CreateStoryButton";

// const playfair = Playfair_Display({ subsets: ["latin"], variable: "--font-serif", weight: ["400","700","900"] });
// const lato = Lato({ subsets: ["latin"], variable: "--font-sans", weight: ["400","700"] });

// export default async function ProjectsIndexPage() {
//   const session = await getServerSession(authOptions);

//   if (!session?.user?.id) {
//     // keep your signed-out UI
//     return (
//       <main className={`min-h-screen ${playfair.variable} ${lato.variable} font-sans bg-[#FDF8F0] text-slate-900`}>
//         {/* ...your existing signed-out content... */}
//       </main>
//     );
//   }

// const userStories = await db
//   .select({
//     id: stories.id,
//     projectId: stories.projectId,
//     title: stories.title,
//     description: stories.description,

//     status: sql<string>`coalesce(${stories.status}, 'planning')`,
//     paymentStatus: sql<string>`coalesce(${stories.paymentStatus}, 'pending')`,

//     createdAt: stories.createdAt,
//     updatedAt: stories.updatedAt,
//     storyConfirmed: sql<boolean>`true`,

//     // ✅ COVER IMAGE LOGIC (page image → style guide image → null)
//     coverImageUrl: sql<string | null>`
//       coalesce(
//         (
//           select pi.url
//           from story_pages sp
//           join page_images pi on pi.page_id = sp.id
//           where sp.story_id = ${stories.id}
//           order by sp.page_number asc
//           limit 1
//         ),
//         (
//           select ssg.sample_illustration_url
//           from story_style_guide ssg
//           where ssg.story_id = ${stories.id}
//           limit 1
//         )
//       )
//     `,
//   })
//   .from(stories)
//   .innerJoin(projects, eq(stories.projectId, projects.id))
//   .where(eq(projects.userId, session.user.id))
//   .orderBy(desc(stories.updatedAt));

//   return (
//     <main className={`min-h-screen ${playfair.variable} ${lato.variable} font-sans bg-[#FDF8F0] text-slate-900 overflow-x-hidden`}>
//       {/* Top bar */}
//       <header className="w-full px-6 py-6 md:px-12 flex items-center justify-between">
//         <Link href="/" className="flex items-center gap-2 text-[#261C15]">
//           <span className="text-2xl">📖</span>
//           <span className="font-serif text-2xl font-bold tracking-wide">FlipWhizz</span>
//         </Link>

//       <CreateStoryButton />
//       </header>

//       <section className="px-6 md:px-12 pb-10">
//         <div className="mx-auto max-w-6xl">
//         <h1 className="text-6xl font-black tracking-tight text-black">
//             Your stories
//           </h1>
//           <p className="mt-4 text-lg text-gray-600">
//             Every adventure you’ve created so far ✨
//           </p>

//         </div>
//       </section>

//       <section className="px-6 md:px-12 pb-24">
//         <div className="mx-auto max-w-6xl">
//           {userStories.length === 0 ? (
//             <div className="rounded-3xl border-4 border-[#E6D5B8] bg-[#F3EAD3] p-10 md:p-14 text-center">
//               <h2 className="font-serif text-3xl text-[#261C15] font-bold">No stories yet</h2>
//               <p className="mt-3 text-[#6B5D52]">Create a project, then start your first story.</p>
//               <div className="mt-8 flex justify-center">
//                 <Link
//                   href="/projects/create"
//                   className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 font-bold text-[#261C15] shadow-lg ring-1 ring-black/5 hover:bg-white/90 transition"
//                 >
//                   <span className="text-lg">➕</span> Create your first project
//                 </Link>
//               </div>
//             </div>
//           ) : (
//             <ul className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
//               {userStories.map((story) => (
//                 <StoriesCard story={story} key={story.id} />
//               ))}
//             </ul>
//           )}
//         </div>
//       </section>
//     </main>
//   );
// }

// src/app/projects/page.tsx
import { db } from "@/db";
import { projects, stories } from "@/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Playfair_Display, Lato } from "next/font/google";
import StoriesCard from "@/app/projects/components/StoriesCard";
import CreateStoryButton from "@/app/projects/components/CreateStoryButton";

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-serif",
  weight: ["400", "700", "900"],
});

const lato = Lato({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "700"],
});

export default async function ProjectsIndexPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return (
      <main
        className={`
          min-h-screen
          ${playfair.variable} ${lato.variable}
          font-sans
          bg-gradient-to-br from-[#FDF8F0] via-[#F9F2E6] to-[#F3EAD3]
          text-slate-900
        `}
      >
        {/* signed-out experience unchanged */}
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
    <main
      className={`
        min-h-screen
        ${playfair.variable} ${lato.variable}
        font-sans
        bg-gradient-to-br from-[#FDF8F0] via-[#F9F2E6] to-[#F3EAD3]
        text-slate-900
        overflow-x-hidden
      `}
    >
      {/* Top navigation */}
      <header className="sticky top-0 z-10 backdrop-blur-xl bg-[#FDF8F0]/70 border-b border-black/5">
        <div className="mx-auto max-w-6xl px-6 py-5 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-2xl">📖</span>
            <span className="font-serif text-2xl font-bold tracking-tight">
              FlipWhizz
            </span>
          </Link>

          <CreateStoryButton />
        </div>
      </header>

      {/* Hero */}
      <section className="px-6 pt-14 pb-10">
        <div className="mx-auto max-w-6xl">
          <h1 className="font-serif text-5xl md:text-6xl font-black tracking-tight">
            Your stories
          </h1>
          <p className="mt-4 text-lg text-stone-600 max-w-xl">
            Every world you’ve started building — drafts, experiments, and
            adventures in progress.
          </p>
        </div>
      </section>

      {/* Content */}
      <section className="px-6 pb-24">
        <div className="mx-auto max-w-6xl">
          {userStories.length === 0 ? (
            <div
              className="
                rounded-[2.5rem]
                bg-white/80
                backdrop-blur
                border border-black/5
                shadow-[0_30px_80px_-40px_rgba(0,0,0,0.25)]
                p-10 md:p-14
                text-center
              "
            >
              <h2 className="font-serif text-3xl font-bold mb-3">
                No stories yet
              </h2>
              <p className="text-stone-600 max-w-md mx-auto">
                Create a project, then start shaping your first story — we’ll
                help you every step of the way.
              </p>

              <div className="mt-8 flex justify-center">
                <Link
                  href="/projects/create"
                  className="
                    inline-flex items-center gap-2
                    rounded-full
                    bg-gradient-to-r from-violet-600 to-fuchsia-600
                    px-7 py-3
                    font-bold text-white
                    shadow-lg
                    hover:scale-[1.03]
                    transition
                  "
                >
                  ➕ Create your first story
                </Link>
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

