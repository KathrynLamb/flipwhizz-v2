// src/app/page.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import Link from "next/link";
import Image from "next/image";
import { Playfair_Display, Lato } from "next/font/google";
import HeroButton from "@/components/HeroButton";
import Header from "@/components/Header";
import { db } from "@/db";
import { projects } from "@/db/schema";

import { stories, bookCovers } from "@/db/schema";
import { and, desc, eq, inArray, sql } from "drizzle-orm";

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

export default async function Home() {
  const session = await getServerSession(authOptions);

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

  const coverByStoryId = new Map(
    selectedCovers.map((c) => [c.storyId, c.imageUrl])
  );

  if (!session?.user?.id) {
    return <main className="min-h-screen bg-white" />;
  }

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
      {/* ========================================
          HERO SECTION — image only, no button overlay
          ======================================== */}
      <section className="relative w-full min-h-[85vh] md:min-h-[90vh] flex flex-col">
        <div className="absolute inset-0 z-0">
          <Image
            src="/LandingPage/hero-new.jpeg"
            alt="A child's imagination coming to life from their sketchbook"
            fill
            priority
            className="object-cover object-[center_40%] md:object-center"
          />
        </div>

        <div className="relative z-30">
          <Header session={session} />
        </div>
      </section>

      {/* ========================================
          CTA STRIP — clean break between hero and content
          ======================================== */}
<section className="relative z-20 -mt-12 pb-16 pt-0">
        <div className="flex flex-col items-center gap-5">
          <div className="animate-fade-in-up">
            <HeroButton session={session} hasProjects={hasProjects} />
          </div>
          <div className="text-center space-y-1">
            <p className="text-base text-[#261C15] font-medium">
              See your first illustrated spread for free — no card, no commitment.
            </p>
            <p className="text-sm text-[#6B5D52]">
              The whole thing takes about 5 minutes.
            </p>
          </div>
        </div>
      </section>

      {/* ========================================
          HOW IT WORKS
          ======================================== */}
      <section id="how-it-works" className="py-24 px-6 md:px-12 bg-white">
        <div className="mx-auto max-w-5xl">
          <div className="text-center mb-16">
            <h2 className="font-serif text-4xl md:text-5xl text-[#261C15] font-bold">
              How It Works
            </h2>
            <p className="mt-4 text-lg text-[#6B5D52]">
              Three simple steps to a story they&apos;ll treasure forever.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-12 md:gap-8">
            <div className="text-center space-y-4">
              <div className="mx-auto w-16 h-16 rounded-full bg-purple-100 flex items-center justify-center">
                <span className="text-2xl font-serif font-bold text-purple-600">1</span>
              </div>
              <h3 className="font-serif text-xl font-bold text-[#261C15]">
                Tell Us About Them
              </h3>
              <p className="text-[#6B5D52] text-sm leading-relaxed">
                Share their name, their favourite things, their quirks, and what
                makes them laugh. The more you share, the more personal it gets.
              </p>
            </div>

            <div className="text-center space-y-4">
              <div className="mx-auto w-16 h-16 rounded-full bg-teal-100 flex items-center justify-center">
                <span className="text-2xl font-serif font-bold text-teal-600">2</span>
              </div>
              <h3 className="font-serif text-xl font-bold text-[#261C15]">
                We Craft Their Story
              </h3>
              <p className="text-[#6B5D52] text-sm leading-relaxed">
                Our AI writes a unique narrative and illustrates every page with
                characters that look and feel like your child&apos;s world.
              </p>
            </div>

            <div className="text-center space-y-4">
              <div className="mx-auto w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center">
                <span className="text-2xl font-serif font-bold text-amber-600">3</span>
              </div>
              <h3 className="font-serif text-xl font-bold text-[#261C15]">
                Hold It in Your Hands
              </h3>
              <p className="text-[#6B5D52] text-sm leading-relaxed">
                Read it on screen or order a beautifully printed book — a real
                keepsake designed to be held, gifted, and read under the duvet.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================
          THIS IS OLIVIA'S BOOK — Photo to illustration showcase
          ======================================== */}
      <section className="py-20 md:py-28 px-6 md:px-12 bg-[#FDF8F0]">
        <div className="mx-auto max-w-5xl">
          <div className="text-center mb-12">
            <h2 className="font-serif text-4xl md:text-5xl text-[#261C15] font-bold">
              This Is Olivia&apos;s Book. No One Else&apos;s.
            </h2>
            <p className="mt-4 text-lg text-[#6B5D52]">
              Your photos. Your words. Their one-of-a-kind book.
            </p>
          </div>

          <div className="relative w-full aspect-[21/10] rounded-2xl overflow-hidden shadow-2xl">
            <Image
              src="/LandingPage/photo_to_book.jpeg"
              alt="Real family photos, pet snapshots, and favourite places transformed into a personalised illustrated storybook"
              fill
              className="object-cover"
            />
          </div>
        </div>
      </section>

      {/* ========================================
          GALLERY (PUBLIC STORIES)
          ======================================== */}
      <section id="gallery" className="py-24 px-6 md:px-12 bg-white">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-center font-serif text-4xl text-[#261C15] font-bold mb-16">
            Gallery of Wonder
          </h2>

          {publicStories.length === 0 ? (
            <div className="mx-auto max-w-xl text-center bg-[#FDF8F0]/60 border border-[#E8DDCF] rounded-2xl p-10">
              <p className="font-serif text-2xl text-[#261C15] font-bold">
                New stories are landing soon ✨
              </p>
              <p className="mt-3 text-sm text-[#6B5D52]">
                Make a story and mark it public to have it appear here.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
              {publicStories.map((story) => {
                const img =
                  coverByStoryId.get(story.id) || story.coverSpreadUrl || null;

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

                    <div className="flex items-start gap-3 px-1">
                      <div className="w-8 h-8 rounded-full bg-slate-300 flex-shrink-0" />
                      <p className="text-xs text-[#6B5D52] italic">
                        &quot;A proper keepsake — the kind they&apos;ll want
                        again tomorrow.&quot;
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
      <section
        id="pricing"
        className="py-28 px-6 md:px-12 bg-[#FDF8F0] relative overflow-hidden"
      >
        <div className="mx-auto max-w-6xl">
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

          <div className="grid md:grid-cols-3 gap-8 items-stretch">
            {/* DIGITAL */}
            <div className="rounded-2xl border border-purple-200 bg-white p-8 shadow-sm flex flex-col hover:shadow-lg transition-shadow duration-300">
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
                <li className="flex items-start gap-2">
                  <span className="text-purple-400 mt-0.5">✦</span>
                  Fully personalised story
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-400 mt-0.5">✦</span>
                  Custom illustrations
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-400 mt-0.5">✦</span>
                  Unlimited re-reads
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-400 mt-0.5">✦</span>
                  High-quality PDF download
                </li>
              </ul>
              <div className="mt-auto">
                <HeroButton
                  session={session}
                  hasProjects={hasProjects}
                  intent="digital"
                  className="w-full"
                  variant="primary"
                />
              </div>
            </div>

            {/* PRINTED (FEATURED) */}
            <div className="rounded-2xl border-2 border-purple-500 bg-white p-10 shadow-xl relative flex flex-col hover:shadow-2xl transition-shadow duration-300 md:-mt-4 md:mb-[-16px]">
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
                <li className="flex items-start gap-2">
                  <span className="text-purple-500 mt-0.5">✦</span>
                  Everything in Digital
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-500 mt-0.5">✦</span>
                  Premium soft-touch cover
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-500 mt-0.5">✦</span>
                  Beautiful full-colour pages
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-500 mt-0.5">✦</span>
                  Perfect for bedtime reading
                </li>
              </ul>
              <HeroButton
                session={session}
                hasProjects={hasProjects}
                intent="print"
                variant="primary"
                className="w-full"
              />
            </div>

            {/* GIFT */}
            <div className="rounded-2xl border border-purple-200 bg-white p-8 shadow-sm flex flex-col hover:shadow-lg transition-shadow duration-300">
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
                <li className="flex items-start gap-2">
                  <span className="text-purple-400 mt-0.5">✦</span>
                  Deluxe printed book
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-400 mt-0.5">✦</span>
                  Personal dedication page
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-400 mt-0.5">✦</span>
                  Gift-ready presentation
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-400 mt-0.5">✦</span>
                  Designed to be kept forever
                </li>
              </ul>
              <div className="mt-auto">
                <HeroButton
                  session={session}
                  hasProjects={hasProjects}
                  intent="gift"
                  className="w-full"
                  variant="primary"
                />
              </div>
            </div>
          </div>

          <div className="mt-20 text-center text-sm text-[#6B5D52]">
            <p>
              No subscriptions. No hidden fees.
              <br />
              If your child doesn&apos;t love it, we&apos;ll make it right.
            </p>
          </div>
        </div>
      </section>

      {/* ========================================
          FOOTER
          ======================================== */}
      <footer className="relative bg-[#0F2236] text-[#FDF8F0] pt-32 pb-12">
        <div className="absolute top-[-1px] left-0 w-full overflow-hidden leading-none">
          <svg
            className="relative block w-[calc(100%+1.3px)] h-[60px] md:h-[100px]"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 1200 120"
            preserveAspectRatio="none"
          >
            <path
              d="M321.39,56.44c58-10.79,114.16-30.13,172-41.86,82.39-16.72,168.19-17.73,250.45-.39C823.78,31,906.67,72,985.66,92.83c70.05,18.48,146.53,26.09,214.34,3V0H0V27.35A600.21,600.21,0,0,0,321.39,56.44Z"
              fill="#FDF8F0"
            />
          </svg>
        </div>

        <div className="relative z-10 mx-auto max-w-6xl px-6 md:px-12 flex flex-col md:flex-row justify-between items-end gap-12">
          <div className="flex flex-col gap-4 text-sm font-medium text-[#FDF8F0]/60">
            <Link href="/" className="hover:text-white transition">Home</Link>
            <Link href="#how-it-works" className="hover:text-white transition">How It Works</Link>
            <Link href="#gallery" className="hover:text-white transition">Gallery</Link>
            <Link href="#pricing" className="hover:text-white transition">Pricing</Link>
            <Link href="/contact" className="hover:text-white transition">Contact Us</Link>
          </div>

          <div className="text-center md:text-right">
            <h4 className="font-serif text-2xl font-bold">FlipWhizz</h4>
            <p className="text-sm opacity-50 mt-1">Made for magic, built to last.</p>
            <p className="text-xs opacity-30 mt-8">© {new Date().getFullYear()} FlipWhizz Ltd.</p>
          </div>

          <div className="w-full md:w-auto flex justify-center md:justify-end">{/* ... */}</div>
        </div>
      </footer>
    </main>
  );
}