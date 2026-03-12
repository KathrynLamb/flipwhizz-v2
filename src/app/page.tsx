import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import Link from "next/link";
import Image from "next/image";
import { Playfair_Display, Lato } from "next/font/google";
import HeroButton from "@/components/HeroButton";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { db } from "@/db";
import { projects } from "@/db/schema";

import { stories, bookCovers } from "@/db/schema";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import GallerySection from "@/components/GallerySection";

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
          HERO SECTION
          ======================================== */}
      <section className="relative w-full min-h-[85vh] md:min-h-[90vh] flex flex-col">
        <div className="absolute inset-0 z-0">
          <Image
            src="/LandingPage/hero-new.jpg"
            alt="A child's imagination coming to life from their sketchbook"
            fill
            priority
            className="object-cover object-[center_40%] md:object-center mt-8"
          />
        </div>
        <div className="relative z-30">
          <Header session={session} />
        </div>
      </section>

      {/* ========================================
          CTA STRIP
          ======================================== */}
      <section className="relative z-20 -mt-2 pb-16 pt-0">
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
              <h3 className="font-serif text-xl font-bold text-[#261C15]">Tell Us About Them</h3>
              <p className="text-[#6B5D52] text-sm leading-relaxed">
                Share their name, their favourite things, their quirks, and what makes them laugh. The more you share, the more personal it gets.
              </p>
            </div>
            <div className="text-center space-y-4">
              <div className="mx-auto w-16 h-16 rounded-full bg-teal-100 flex items-center justify-center">
                <span className="text-2xl font-serif font-bold text-teal-600">2</span>
              </div>
              <h3 className="font-serif text-xl font-bold text-[#261C15]">We Craft Their Story</h3>
              <p className="text-[#6B5D52] text-sm leading-relaxed">
                Our AI writes a unique narrative and illustrates every page with characters that look and feel like your child&apos;s world.
              </p>
            </div>
            <div className="text-center space-y-4">
              <div className="mx-auto w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center">
                <span className="text-2xl font-serif font-bold text-amber-600">3</span>
              </div>
              <h3 className="font-serif text-xl font-bold text-[#261C15]">Hold It in Your Hands</h3>
              <p className="text-[#6B5D52] text-sm leading-relaxed">
                Read it on screen or order a beautifully printed book — a real keepsake designed to be held, gifted, and read under the duvet.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================
          THIS IS OLIVIA'S BOOK
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
              alt="Real family photos transformed into a personalised illustrated storybook"
              fill
              className="object-cover"
            />
          </div>
        </div>
      </section>

      {/* ========================================
          GALLERY
          ======================================== */}
      <GallerySection
        stories={publicStories}
        coverByStoryId={coverByStoryId}
        session={session}
        hasProjects={hasProjects}
      />

      {/* ========================================
          PRICING
          ======================================== */}
      <section id="pricing" className="py-28 px-6 md:px-12 bg-[#FDF8F0] relative overflow-hidden">
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
              <h3 className="font-serif text-2xl text-purple-700 font-bold mb-2">Digital Keepsake</h3>
              <p className="text-sm text-[#6B5D52] mb-6">A beautifully illustrated story, ready to read or print.</p>
              <div className="mb-6">
                <span className="text-4xl font-serif font-bold text-purple-700">£14</span>
                <span className="text-[#6B5D52]"> one-off</span>
              </div>
              <ul className="space-y-3 text-sm text-[#4A4038] mb-8">
                {["Fully personalised story", "Custom illustrations", "Unlimited re-reads", "High-quality PDF download"].map(f => (
                  <li key={f} className="flex items-start gap-2">
                    <span className="text-purple-400 mt-0.5">✦</span>{f}
                  </li>
                ))}
              </ul>
              <div className="mt-auto">
                <HeroButton session={session} hasProjects={hasProjects} intent="digital" className="w-full" variant="primary" />
              </div>
            </div>

            {/* PRINTED */}
            <div className="rounded-2xl border-2 border-purple-500 bg-white p-10 shadow-xl relative flex flex-col hover:shadow-2xl transition-shadow duration-300 md:-mt-4 md:mb-[-16px]">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-purple-500 text-white text-xs font-semibold px-4 py-1 rounded-full">
                Most Loved
              </div>
              <h3 className="font-serif text-2xl text-[#642952] font-bold mb-2">Printed Storybook</h3>
              <p className="text-sm text-[#6B5D52] mb-6">A keepsake to hold, gift, and treasure for years.</p>
              <div className="mb-6">
                <span className="text-4xl font-serif font-bold text-[#261C15]">£29</span>
                <span className="text-[#6B5D52]"> one-off</span>
              </div>
              <ul className="space-y-3 text-sm text-[#4A4038] mb-8">
                {["Everything in Digital", "Premium soft-touch cover", "Beautiful full-colour pages", "Perfect for bedtime reading"].map(f => (
                  <li key={f} className="flex items-start gap-2">
                    <span className="text-purple-500 mt-0.5">✦</span>{f}
                  </li>
                ))}
              </ul>
              <HeroButton session={session} hasProjects={hasProjects} intent="print" variant="primary" className="w-full" />
            </div>

            {/* GIFT */}
            <div className="rounded-2xl border border-purple-200 bg-white p-8 shadow-sm flex flex-col hover:shadow-lg transition-shadow duration-300">
              <h3 className="font-serif text-2xl text-purple-700 font-bold mb-2">Gift Edition</h3>
              <p className="text-sm text-[#6B5D52] mb-6">Made for birthdays, Christmas, and once-in-a-lifetime moments.</p>
              <div className="mb-6">
                <span className="text-4xl font-serif font-bold text-[#261C15]">£39</span>
                <span className="text-[#6B5D52]"> one-off</span>
              </div>
              <ul className="space-y-3 text-sm text-[#4A4038] mb-8">
                {["Deluxe printed book", "Personal dedication page", "Gift-ready presentation", "Designed to be kept forever"].map(f => (
                  <li key={f} className="flex items-start gap-2">
                    <span className="text-purple-400 mt-0.5">✦</span>{f}
                  </li>
                ))}
              </ul>
              <div className="mt-auto">
                <HeroButton session={session} hasProjects={hasProjects} intent="gift" className="w-full" variant="primary" />
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

      {/* ======================================== FOOTER
          ======================================== */}
      <Footer />
    </main>
  );
}