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
      className={`min-h-screen ${playfair.variable} ${lato.variable} font-sans bg-white text-slate-900 overflow-x-hidden`}
    >
      {/* ========================================
          HERO SECTION
          ======================================== */}
      <section className="relative w-full flex flex-col bg-white">
        {/* Header — renders in normal flow, image sits below */}
        <div className="relative z-30">
          <Header session={session} />
        </div>

        {/* Hero image — below nav, fully visible */}
        <div className="relative w-full">
          {/* Desktop */}
          <div className="hidden md:block relative w-full" style={{ height: "min(75vh, 700px)" }}>
            <Image
              src="/LandingPage/hero-new201.jpg"
              alt="Big Imaginations Deserve Beautiful Books — create one-of-a-kind illustrated children's books about anything"
              fill
              priority
              className="object-cover object-top"
            />
          </div>
          {/* Mobile */}
          <div className="md:hidden relative w-full" style={{ height: "min(65vh, 500px)" }}>
            <Image
              src="/LandingPage/hero-mobile.jpg"
              alt="Big Imaginations Deserve Beautiful Books — create one-of-a-kind illustrated children's books about anything"
              fill
              priority
              className="object-cover object-top"
            />
          </div>
        </div>
      </section>

      {/* ========================================
          CTA STRIP
          ======================================== */}
      <section className="pt-4 pb-12 md:pt-6 md:pb-16 bg-white">
        <div className="flex flex-col items-center gap-4 px-6">
          {/* Primary CTA button — logo gradient */}
          <Link
            href={hasProjects ? "/projects" : "/projects/new"}
            className="group relative px-10 py-4 md:px-14 md:py-5 rounded-full text-base md:text-lg font-bold text-white tracking-wide transition-all duration-300 hover:scale-105 hover:shadow-xl active:scale-[0.98]"
            style={{
              background: "linear-gradient(135deg, #F28B7B, #E88BAE, #9B7DC9)",
              boxShadow: "0 6px 24px rgba(232,139,174,0.35)",
            }}
          >
            <span className="relative z-10">
              {hasProjects ? "Create Another Story" : "Create Your First Story"}
            </span>
          </Link>

          {/* Supporting text */}
          <div className="text-center space-y-1">
            <p className="text-sm md:text-base text-gray-600 font-medium">
              See your first illustrated spread for free — no card, no commitment.
            </p>
            <p className="text-xs md:text-sm text-gray-400">
              The whole thing takes about 5 minutes.
            </p>
          </div>
        </div>
      </section>

      {/* ========================================
          HOW IT WORKS
          ======================================== */}
      <section id="how-it-works" className="py-24 px-6 md:px-12 bg-[#FDF8F0]">
  
      <div className="relative w-full">
          {/* Desktop */}
          <div className="hidden md:block relative w-full" style={{ height: "min(75vh, 700px)" }}>
            <Image
              src="/LandingPage/HowItWorks.jpg"
              alt="Big Imaginations Deserve Beautiful Books — create one-of-a-kind illustrated children's books about anything"
              fill
              priority
              className="object-cover object-top"
            />
          </div>
          {/* Mobile */}
          <div className="md:hidden relative w-full" style={{ height: "min(65vh, 500px)" }}>
            <Image
              src="/LandingPage/hero-mobile.jpg"
              alt="Big Imaginations Deserve Beautiful Books — create one-of-a-kind illustrated children's books about anything"
              fill
              priority
              className="object-cover object-top"
            />
          </div>
        </div>
      </section>

      {/* ========================================
          THIS IS OLIVIA'S BOOK
          ======================================== */}
      <section className="py-20 md:py-28 px-6 md:px-12 bg-white">
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

      {/* ========================================
          FOOTER
          ======================================== */}
      <Footer />
    </main>
  );
}