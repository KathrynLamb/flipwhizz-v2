// src/app/page.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import Link from "next/link";
import Image from "next/image";
import { Playfair_Display, Lato } from "next/font/google";
import HeroButton from "@/components/HeroButton"; 
import Header from "@/components/Header"; // 👈 IMPORT HERE
import { db } from "@/db"; 
import { projects } from "@/db/schema";

import { stories, bookCovers } from "@/db/schema";
import { and, desc, eq, inArray, sql  } from "drizzle-orm";

const playfair = Playfair_Display({ 
  subsets: ["latin"], 
  variable: "--font-serif",
  weight: ["400", "700", "900"]
});

const lato = Lato({ 
  subsets: ["latin"], 
  variable: "--font-sans",
  weight: ["400", "700"]
});

export default async function Home() {
  const session = await getServerSession(authOptions);

  // --- Public gallery stories (show even if logged out) ---
const publicStories = await db
.select({
  id: stories.id,
  title: stories.title,
  description: stories.description,
  coverSpreadUrl: stories.coverSpreadUrl,
  updatedAt: stories.updatedAt,
})
.from(stories)
.where(eq(stories.public, true))
.orderBy(desc(stories.updatedAt))
.limit(8);

const publicStoryIds = publicStories.map((s) => s.id);

const selectedCovers = publicStoryIds.length
? await db
    .select({
      storyId: bookCovers.storyId,
      imageUrl: bookCovers.imageUrl,
    })
    .from(bookCovers)
    .where(
      and(
        inArray(bookCovers.storyId, publicStoryIds),
        eq(bookCovers.isSelected, true)
      )
    )
: [];

console.log("public stories", publicStories)

const coverByStoryId = new Map(selectedCovers.map((c) => [c.storyId, c.imageUrl]));


  if (!session?.user?.id) {
    return <main className="min-h-screen bg-white" />;
  }

  // Check if user has projects
  let hasProjects = false;

  if (session?.user?.id) {
    const userProjects = await db
      .select({ count: sql<number>`count(*)` })
      .from(projects)
      .where(eq(projects.userId, session.user.id));
    
    hasProjects = userProjects[0].count > 0;
  }
  return (
  <main
  className={`min-h-screen ${playfair.variable} ${lato.variable} font-sans bg-[#FDF8F0] text-slate-900 overflow-x-hidden`}
>
  {/* 
      ========================================
      HERO SECTION
      ========================================
    */}
  <section className="relative w-full min-h-[95vh] flex flex-col">
    {/* 1. BACKGROUND IMAGE */}
    <div className="absolute inset-0 z-0">
      <Image
        src="/LandingPage/hero-forestv2.jpeg"
        alt="Magical forest background"
        fill
        priority
        className="object-cover object-[center_60%] md:object-center"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/30 to-[#0F2236]/80"></div>
    </div>

    {/* 2. NAVBAR (Replaced with Component) */}
    <Header session={session} />

    {/* 3. HERO CONTENT ... (Rest remains same) */}
    <div className="relative z-10 flex-grow flex flex-col justify-center items-center text-center px-4 pb-32 md:pb-40 pt-10">
      <div className="max-w-4xl space-y-8 animate-fade-in-up">
        <h1 className="font-serif text-5xl md:text-7xl lg:text-8xl text-[#FDF8F0] leading-[1.1] drop-shadow-2xl">
          Turn Their Inner World <br />
          <span className="text-[#F4A261]">Into a Tangible Tale</span>
        </h1>

        <p className="mx-auto text-lg md:text-2xl text-[#FDF8F0]/90 max-w-2xl font-light leading-relaxed drop-shadow-lg">
          Beautifully illustrated, deeply personal storybooks created from your child’s
          favorite things, quirks, and dreams.
        </p>

        <div className="flex justify-center pt-4">
          <HeroButton session={session} hasProjects={hasProjects} />
        </div>
      </div>
    </div>

    {/* 4. CURVED DIVIDER (Wave) */}
    <div className="absolute bottom-[-1px] left-0 w-full overflow-hidden leading-none z-20">
      <svg
        className="relative block w-[calc(100%+1.3px)] h-[60px] md:h-[120px]"
        data-name="Layer 1"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 1200 120"
        preserveAspectRatio="none"
      >
        <path
          d="M321.39,56.44c58-10.79,114.16-30.13,172-41.86,82.39-16.72,168.19-17.73,250.45-.39C823.78,31,906.67,72,985.66,92.83c70.05,18.48,146.53,26.09,214.34,3V0H0V27.35A600.21,600.21,0,0,0,321.39,56.44Z"
          fill="#FDF8F0"
          transform="scale(1, -1) translate(0, -120)"
        ></path>
      </svg>
    </div>
  </section>

  {/* ========================================
      PRODUCT / KEEPSAKE
      ======================================== */}
  <section className="py-24 px-6 md:px-12 bg-white">
    <div className="mx-auto max-w-6xl">
      <div className="text-center mb-12">
        <h2 className="font-serif text-4xl text-[#261C15] font-bold">
          A Keepsake, Not Just a File
        </h2>
        <p className="mt-4 text-[#6B5D52]">
          Designed to be printed, held, and read under a duvet with a flashlight.
        </p>
      </div>

      <div className="relative w-full aspect-[16/9] md:aspect-[21/9] bg-[#EEE5D5] rounded-xl shadow-2xl overflow-hidden">
        <Image
          src="/LandingPage/product.jpeg"
          alt="FlipWhizz printed storybook mockup"
          fill
          className="object-cover"
          priority
        />

        <div className="absolute inset-0 bg-black/0 md:bg-gradient-to-t md:from-black/20 md:via-black/0 md:to-black/0" />

        <div className="absolute bottom-6 right-6 hidden md:block max-w-xs text-right">
          <p className="font-serif text-lg text-[#261C15] font-bold italic drop-shadow-sm">
            "For Leo, our brave explorer."
          </p>
        </div>
      </div>
    </div>
  </section>

  {/* ========================================
      GALLERY (PUBLIC STORIES)
      ======================================== */}
  <section id="gallery" className="py-24 px-6 md:px-12 bg-[#FDF8F0]">
    <div className="mx-auto max-w-6xl">
      <h2 className="text-center font-serif text-4xl text-[#261C15] font-bold mb-16">
        Gallery of Wonder
      </h2>

      {/* If you want a nice empty state */}
      {publicStories.length === 0 ? (
        <div className="mx-auto max-w-xl text-center bg-white/60 border border-[#E8DDCF] rounded-2xl p-10">
          <p className="font-serif text-2xl text-[#261C15] font-bold">New stories are landing soon ✨</p>
          <p className="mt-3 text-sm text-[#6B5D52]">
            Make a story and mark it public to have it appear here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
          {publicStories.map((story) => {
            const img =
              coverByStoryId.get(story.id) ||
              story.coverSpreadUrl ||
              null;

            return (
              <div key={story.id} className="flex flex-col gap-4">
                <Link
                  href={`/public/stories/${story.id}`}
                  className="aspect-square rounded-lg shadow-lg hover:scale-105 transition-transform duration-300 cursor-pointer overflow-hidden relative group bg-slate-800 block"
                >
                  {img ? (
                    <Image
                      src={img}
                      alt={story.title}
                      fill
                      className="object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-slate-800 to-slate-600" />
                  )}

                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-90" />

                  <div className="absolute bottom-0 p-4 w-full">
                    <p className="text-white font-serif font-bold text-lg leading-tight line-clamp-2">
                      {story.title}
                    </p>
                    {story.description ? (
                      <p className="text-white/80 text-xs mt-1 line-clamp-2">
                        {story.description}
                      </p>
                    ) : null}
                  </div>
                </Link>

                {/* Optional small “quote” block (keep your original vibe) */}
                <div className="flex items-start gap-3 px-1">
                  <div className="w-8 h-8 rounded-full bg-slate-300 flex-shrink-0" />
                  <p className="text-xs text-[#6B5D52] italic">
                    “A proper keepsake — the kind they’ll want again tomorrow.”
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  </section>

  {/* ========================================
      PRICING
      ======================================== */}
  <section id="pricing" className="py-28 px-6 md:px-12 bg-white relative overflow-hidden">
    <div className="mx-auto max-w-6xl">
      {/* Header */}
      <div className="text-center max-w-3xl mx-auto mb-20">
        <h2 className="font-serif text-4xl md:text-5xl text-[#261C15] font-bold">
          Simple, Honest Pricing
        </h2>
        <p className="mt-6 text-lg text-[#6B5D52] leading-relaxed">
          Each story is crafted once, then yours forever.
          <br />
          No subscriptions. No upsells. Just a beautiful book.
        </p>
      </div>

      {/* Pricing Cards */}
      <div className="grid md:grid-cols-3 gap-8 items-stretch">
        {/* DIGITAL */}
        <div className="rounded-2xl border border-purple-300 bg-purple-50 p-8 shadow-sm flex flex-col">
          <h3 className="font-serif text-2xl text-purple-700 font-bold mb-2">
            Digital Keepsake
          </h3>
          <p className="text-sm text-[#6B5D52] mb-6">
            A beautifully illustrated story, ready to read or print.
          </p>

          <div className="mb-6">
            <span className="text-4xl font-serif font-bold text-purple-700">£14</span>
            <span className="text-[#6B5D52]"> one-off</span>
          </div>

          <ul className="space-y-3 text-sm text-[#4A4038] mb-8">
            <li>• Fully personalised story</li>
            <li>• Custom illustrations</li>
            <li>• Unlimited re-reads</li>
            <li>• High-quality PDF download</li>
          </ul>

          <div className="mt-auto">
            <HeroButton
              session={session}
              hasProjects={hasProjects}
              intent="digital"
              className="w-full bg-purple-400 text-white"
            />
          </div>
        </div>

        {/* PRINTED (FEATURED) */}
        <div className="rounded-2xl border-2 border-purple-500 bg-white p-10 shadow-xl relative flex flex-col">
          <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-purple-500 text-white text-xs font-semibold px-4 py-1 rounded-full">
            Most Loved
          </div>

          <h3 className="font-serif text-2xl text-[#642952] font-bold mb-2">
            Printed Storybook
          </h3>
          <p className="text-sm text-[#6B5D52] mb-6">
            A keepsake to hold, gift, and treasure for years.
          </p>

          <div className="mb-6">
            <span className="text-4xl font-serif font-bold text-[#261C15]">£29</span>
            <span className="text-[#6B5D52]"> one-off</span>
          </div>

          <ul className="space-y-3 text-sm text-[#4A4038] mb-8">
            <li>• Everything in Digital</li>
            <li>• Premium soft-touch cover</li>
            <li>• Beautiful full-colour pages</li>
            <li>• Perfect for bedtime reading</li>
          </ul>

          <HeroButton
            session={session}
            hasProjects={hasProjects}
            intent="print"
            variant="primary"
            className="w-full bg-purple-500"
          />
        </div>

        {/* GIFT */}
        <div className="rounded-2xl border border-purple-300 bg-purple-50 p-8 shadow-sm flex flex-col">
          <h3 className="font-serif text-2xl text-purple-700 font-bold mb-2">
            Gift Edition
          </h3>
          <p className="text-sm text-[#6B5D52] mb-6">
            Made for birthdays, Christmas, and once-in-a-lifetime moments.
          </p>

          <div className="mb-6">
            <span className="text-4xl font-serif font-bold text-[#261C15]">£39</span>
            <span className="text-[#6B5D52]"> one-off</span>
          </div>

          <ul className="space-y-3 text-sm text-[#4A4038] mb-8">
            <li>• Deluxe printed book</li>
            <li>• Personal dedication page</li>
            <li>• Gift-ready presentation</li>
            <li>• Designed to be kept forever</li>
          </ul>

          <div className="mt-auto">
            <HeroButton
              session={session}
              hasProjects={hasProjects}
              intent="gift"
              className="w-full"
            />
          </div>
        </div>
      </div>

      {/* Reassurance */}
      <div className="mt-20 text-center text-sm text-[#6B5D52]">
        <p>
          No subscriptions. No hidden fees.
          <br />
          If your child doesn’t love it, we’ll make it right.
        </p>
      </div>
    </div>
  </section>

  {/* 
      ========================================
      FOOTER
      ========================================
    */}
  <footer className="relative bg-[#0F2236] text-[#FDF8F0] pt-32 pb-12">
    <div className="relative z-10 mx-auto max-w-6xl px-6 md:px-12 flex flex-col md:flex-row justify-between items-end gap-12">
      {/* Left: Links */}
      <div className="flex flex-col gap-4 text-sm font-medium text-[#FDF8F0]/60">
        <Link href="/" className="hover:text-white transition">
          Home
        </Link>
        <Link href="#how-it-works" className="hover:text-white transition">
          How It Works
        </Link>
        <Link href="#gallery" className="hover:text-white transition">
          Gallery
        </Link>
        <Link href="#pricing" className="hover:text-white transition">
          Pricing
        </Link>
        <Link href="/contact" className="hover:text-white transition">
          Contact Us
        </Link>
      </div>

      {/* Middle: Brand */}
      <div className="text-center md:text-right">
        <h4 className="font-serif text-2xl font-bold">FlipWhizz</h4>
        <p className="text-sm opacity-50 mt-1">Made for magic, built to last.</p>
        <p className="text-xs opacity-30 mt-8">© {new Date().getFullYear()} FlipWhizz Ltd.</p>
      </div>

      {/* Right: Placeholder */}
      <div className="w-full md:w-auto flex justify-center md:justify-end">{/* ... */}</div>
    </div>
  </footer>
</main>
);
  }